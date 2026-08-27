import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const key=Deno.env.get('OPENAI_API_KEY');if(!key)return json({error:'Alignment drafting is not activated.'},503);
 const {data:{user},error:ue}=await admin.auth.getUser(token);if(ue||!user)return json({error:'Unauthorised'},401);
 let p:any={};try{p=await req.json()}catch{return json({error:'Invalid JSON'},400)}
 const reviewId=p.review_id;if(!reviewId)return json({error:'review_id is required'},400);
 const {data:review}=await admin.from('eezicomply_alignment_reviews').select('*').eq('id',reviewId).single();
 if(!review)return json({error:'Review not found'},404);if(review.owner_id!==user.id)return json({error:'Forbidden'},403);
 const {data:decisions}=await admin.from('eezicomply_alignment_change_decisions').select('*').eq('review_id',reviewId).order('created_at');
 const pending=(decisions||[]).filter((d:any)=>d.decision==='pending');if(pending.length)return json({error:'Accept or reject every proposed alignment change first.',code:'PENDING_DECISIONS'},400);
 const accepted=(decisions||[]).filter((d:any)=>d.decision==='accepted');if(!accepted.length)return json({error:'No alignment changes were accepted.',code:'NO_ACCEPTED_CHANGES'},400);

 const [moiUrl,shaUrl]=await Promise.all([
  admin.storage.from('eezicomply-alignment').createSignedUrl(review.moi_storage_path,180),
  admin.storage.from('eezicomply-alignment').createSignedUrl(review.sha_storage_path,180)
 ]);
 if(!moiUrl.data?.signedUrl||!shaUrl.data?.signedUrl)return json({error:'Could not access source documents'},500);

 const schema={type:'object',additionalProperties:false,properties:{
  revised_moi:{type:'string'},revised_sha:{type:'string'},drafting_note:{type:'string'},
  accepted_change_summary:{type:'array',items:{type:'object',additionalProperties:false,properties:{change_key:{type:'string'},target_document:{type:'string'},incorporated_as:{type:'string'}},required:['change_key','target_document','incorporated_as']}},
  next_steps:{type:'array',items:{type:'object',additionalProperties:false,properties:{
   title:{type:'string'},explanation:{type:'string'},actions:{type:'array',items:{type:'string'}},responsible_person:{type:'string'},evidence_to_keep:{type:'array',items:{type:'string'}},completion_test:{type:'string'},professional_review_recommendation:{type:'string'}
  },required:['title','explanation','actions','responsible_person','evidence_to_keep','completion_test','professional_review_recommendation']}},
  professional_review_recommendation:{type:'string'}
 },required:['revised_moi','revised_sha','drafting_note','accepted_change_summary','next_steps','professional_review_recommendation']};

 const ai=new OpenAI({apiKey:key});
 const response=await ai.responses.create({
  model:'gpt-5',reasoning:{effort:'high'},
  instructions:`You are EeziComply's senior South African governance drafting engine.

Prepare COMPLETE revised working drafts of BOTH the MOI and Shareholders' Agreement using only the alignment resolutions accepted by the user.

RULES:
- Preserve unaffected drafting as far as practical.
- Do not incorporate rejected proposals.
- Make the two documents tell the same governance story.
- Where an accepted resolution targets only one document, do not unnecessarily rewrite the other.
- Resolve consequential numbering, definitions and cross-references.
- Never invent facts; use [TO BE CONFIRMED] where genuinely necessary.
- Disclose unavoidable consequential edits.
- Do not silently alter economic rights beyond accepted resolutions.
- Recommend professional review of every substantive implementation step.

NEXT STEPS:
Give a detailed explanatory checklist covering professional legal/company-secretarial review, shareholder intention confirmation, approvals/resolutions, execution, MOI/CIPC filing if applicable, effective-date coordination between documents, statutory records, updated registers, signed final copies, stakeholder communication and compliance-calendar follow-up. Each step must explain why, what, who, evidence to keep, completion test, and professional review.`,
  input:[{role:'user',content:[
   {type:'input_text',text:`Company: ${review.organisation_name||'Not supplied'}
Accepted alignment resolutions:
${accepted.map((d:any)=>`- ${d.change_key} | topic=${d.topic} | target=${d.target_document} | resolution=${d.proposed_resolution} | user note=${d.user_note||''}`).join('\n')}

Rejected resolutions — DO NOT incorporate:
${(decisions||[]).filter((d:any)=>d.decision==='rejected').map((d:any)=>`- ${d.change_key} | ${d.topic}`).join('\n')||'(none)'}

Prepare complete aligned working drafts and the implementation checklist.`},
   {type:'input_file',file_url:moiUrl.data.signedUrl},
   {type:'input_file',file_url:shaUrl.data.signedUrl}
  ]}],
  text:{verbosity:'high',format:{type:'json_schema',name:'eezicomply_aligned_documents',strict:true,schema}}
 } as any,{signal:AbortSignal.timeout(180000)});

 const result=JSON.parse(response.output_text||'{}');
 await admin.from('eezicomply_alignment_reviews').update({
  revised_moi_text:result.revised_moi,revised_sha_text:result.revised_sha,next_steps_json:result.next_steps,
  revision_generated_at:new Date().toISOString(),updated_at:new Date().toISOString()
 }).eq('id',reviewId);
 return json({ok:true,review_id:reviewId,...result});
});