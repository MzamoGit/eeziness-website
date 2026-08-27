import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);

  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('OPENAI_API_KEY');
  if(!key)return json({error:'Revised SHA drafting is not activated.'},503);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:ue}=await admin.auth.getUser(token);if(ue||!user)return json({error:'Unauthorised'},401);
  let p:any={};try{p=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const reviewId=p.review_id;if(!reviewId)return json({error:'review_id is required'},400);

  const {data:review}=await admin.from('eezicomply_sha_reviews').select('*').eq('id',reviewId).single();
  if(!review)return json({error:'Review not found'},404);
  if(review.owner_id!==user.id)return json({error:'Forbidden'},403);

  const {data:decisions,error:de}=await admin.from('eezicomply_sha_change_decisions').select('*').eq('review_id',reviewId).order('created_at');
  if(de)return json({error:de.message},500);
  const accepted=(decisions||[]).filter((d:any)=>d.decision==='accepted');
  const pending=(decisions||[]).filter((d:any)=>d.decision==='pending');
  if(pending.length)return json({error:'Accept or reject every proposed change before generating the revised agreement.',code:'PENDING_DECISIONS'},400);
  if(!accepted.length)return json({error:'No changes were accepted.',code:'NO_ACCEPTED_CHANGES'},400);

  const {data:signed,error:se}=await admin.storage.from('eezicomply-sha').createSignedUrl(review.storage_path,180);
  if(se||!signed?.signedUrl)return json({error:se?.message||'Could not access original agreement'},500);

  const schema={type:'object',additionalProperties:false,properties:{
    revised_sha:{type:'string'},
    drafting_note:{type:'string'},
    accepted_change_summary:{type:'array',items:{type:'object',additionalProperties:false,properties:{change_key:{type:'string'},incorporated_as:{type:'string'}},required:['change_key','incorporated_as']}},
    next_steps:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      title:{type:'string'},explanation:{type:'string'},actions:{type:'array',items:{type:'string'}},
      responsible_person:{type:'string'},evidence_to_keep:{type:'array',items:{type:'string'}},
      completion_test:{type:'string'},professional_review_recommendation:{type:'string'}
    },required:['title','explanation','actions','responsible_person','evidence_to_keep','completion_test','professional_review_recommendation']}},
    cautions:{type:'array',items:{type:'string'}},
    professional_review_recommendation:{type:'string'}
  },required:['revised_sha','drafting_note','accepted_change_summary','next_steps','cautions','professional_review_recommendation']};

  const ai=new OpenAI({apiKey:key});
  const response=await ai.responses.create({
    model:'gpt-5',
    reasoning:{effort:'high'},
    instructions:`You are EeziComply's senior South African Shareholders' Agreement drafting engine.

Prepare a COMPLETE revised Shareholders' Agreement based on the original agreement and ONLY the changes accepted by the user.

RULES:
- Preserve unaffected provisions as far as practical.
- Do not incorporate rejected changes or your own preferred commercial terms.
- Resolve consequential numbering, definitions and cross-references created by accepted changes.
- If a factual item is missing, use [TO BE CONFIRMED] rather than inventing it.
- Make only minimum unavoidable consequential edits and disclose them.
- The output must be a complete working draft, not an amendment schedule.
- Do not silently alter economic rights, voting power, valuation, exit rights or funding obligations beyond accepted changes.

NEXT-STEP CHECKLIST:
Explain in detail what must happen after drafting, including as applicable: shareholder negotiation/confirmation, legal review, board/shareholder approvals, execution formalities, signature process, effective-date mechanics, updates to governance records, review of the MOI for consistency, any required corporate records or resolutions, communication to affected parties and future compliance follow-up.
Each step must state why it matters, what to do, who should do it, evidence to keep, completion test and professional_review_recommendation.

GLOBAL RULE:
Every substantive suggestion or implementation step must recommend appropriate professional review before reliance, signature or implementation. This must remain useful and specific, not a generic disclaimer.`,
    input:[{role:'user',content:[
      {type:'input_text',text:`Company: ${review.organisation_name||'Not supplied'}
Accepted changes:
${accepted.map((d:any)=>`- ${d.change_key} | ${d.title} | Clause ${d.clause_reference||'not identified'} | ${d.proposed_change} | User note: ${d.user_note||''}`).join('\n')}

Rejected changes — DO NOT incorporate:
${(decisions||[]).filter((d:any)=>d.decision==='rejected').map((d:any)=>`- ${d.change_key} | ${d.title}`).join('\n')||'(none)'}

Prepare the complete revised Shareholders' Agreement and implementation checklist.`},
      {type:'input_file',file_url:signed.signedUrl}
    ]}],
    text:{verbosity:'high',format:{type:'json_schema',name:'eezicomply_revised_sha',strict:true,schema}}
  } as any,{signal:AbortSignal.timeout(160000)});

  const result=JSON.parse(response.output_text||'{}');
  await admin.from('eezicomply_sha_reviews').update({
    revised_sha_text:result.revised_sha,next_steps_json:result.next_steps,
    revision_generated_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq('id',reviewId);

  return json({ok:true,review_id:reviewId,...result});
});