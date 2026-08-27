import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);

  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('OPENAI_API_KEY');
  if(!key) return json({error:'Revised MOI drafting is not activated.'},503);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:ue}=await admin.auth.getUser(token);
  if(ue||!user)return json({error:'Unauthorised'},401);

  let p:any={};try{p=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const reviewId=p.review_id;if(!reviewId)return json({error:'review_id is required'},400);

  const {data:review,error:re}=await admin.from('eezicomply_moi_reviews').select('*').eq('id',reviewId).single();
  if(re||!review)return json({error:'Review not found'},404);
  if(review.owner_id!==user.id)return json({error:'Forbidden'},403);

  const {data:decisions,error:de}=await admin.from('eezicomply_moi_change_decisions').select('*').eq('review_id',reviewId).order('created_at');
  if(de)return json({error:de.message},500);
  const accepted=(decisions||[]).filter((d:any)=>d.decision==='accepted');
  const pending=(decisions||[]).filter((d:any)=>d.decision==='pending');
  if(pending.length)return json({error:'Decide whether to accept or reject every proposed change before generating the revised MOI.',code:'PENDING_DECISIONS'},400);
  if(!accepted.length)return json({error:'No changes were accepted. A revised MOI cannot be generated without at least one accepted amendment.',code:'NO_ACCEPTED_CHANGES'},400);
  if(!review.storage_path)return json({error:'Original MOI document is unavailable.'},400);

  const {data:signed,error:se}=await admin.storage.from('eezicomply-moi').createSignedUrl(review.storage_path,180);
  if(se||!signed?.signedUrl)return json({error:se?.message||'Could not access original MOI'},500);

  const schema={type:'object',additionalProperties:false,properties:{
    revised_moi:{type:'string'},
    drafting_note:{type:'string'},
    accepted_change_summary:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      change_key:{type:'string'},incorporated_as:{type:'string'}
    },required:['change_key','incorporated_as']}},
    next_steps:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      title:{type:'string'},
      explanation:{type:'string'},
      actions:{type:'array',items:{type:'string'}},
      responsible_person:{type:'string'},
      evidence_to_keep:{type:'array',items:{type:'string'}},
      completion_test:{type:'string'}
    },required:['title','explanation','actions','responsible_person','evidence_to_keep','completion_test']}},
    cautions:{type:'array',items:{type:'string'}},
    professional_review_recommendation:{type:'string'}
  },required:['revised_moi','drafting_note','accepted_change_summary','next_steps','cautions','professional_review_recommendation']};

  const ai=new OpenAI({apiKey:key});
  const response=await ai.responses.create({
    model:'gpt-5',
    reasoning:{effort:'high'},
    instructions:`You are EeziComply's senior South African company-secretarial drafting engine.

Prepare a COMPLETE revised Memorandum of Incorporation, not a list of amendments.

MANDATORY DRAFTING RULES:
- First inspect review.review_mode and review.detected_form supplied in the case data.
- If review_mode is short_form_suitability and the source is CoR 15.1A or CoR 15.1C, DO NOT pretend to edit the prescribed short-form template. Prepare a COMPLETE customised/replacement MOI that carries forward the company's established facts and incorporates only the accepted bespoke governance changes. The output must clearly state that it is a working replacement/customised MOI for professional review and the appropriate amendment/substitution process.
- Otherwise, use the original MOI as the base document.
- Incorporate ONLY the changes expressly accepted by the user.
- Do not silently add rejected changes, pending changes, or your own preferred governance drafting.
- Preserve unaffected clauses and the document's internal structure as far as practical.
- Resolve consequential numbering, cross-references and definitions created by accepted amendments.
- If an accepted change is technically impossible to incorporate without an additional consequential edit, make only the minimum consequential edit necessary and disclose it in drafting_note.
- Do not invent company facts. If a required factual placeholder is genuinely missing, preserve a clearly marked [TO BE CONFIRMED] placeholder rather than guessing.
- The revised_moi must be usable as a complete working draft for professional review/adoption, not merely an amendment schedule.
- State prominently in drafting_note that the working draft should be reviewed by an appropriately qualified professional before adoption or filing where material legal changes are involved.

NEXT-STEP CHECKLIST STANDARD:
Produce a detailed explanatory checklist tailored to the accepted amendments and South African company-secretarial process.
Cover, where applicable:
1. Internal verification of the revised draft.
2. Board/shareholder approvals required by the existing MOI and Companies Act.
3. Preparation and signature of resolutions or notices.
4. Whether a CIPC MOI amendment/substitution filing is required. For a prescribed short-form MOI moving to bespoke governance, explain that a proper replacement/substitution process is required rather than simply editing the prescribed form.
5. Which CIPC forms/supporting documents may be relevant, but never invent a form number if uncertain.
6. Signature/execution requirements.
7. Filing sequence and what evidence/confirmation to retain.
8. Updating the company's statutory records after filing.
9. Updating share registers, governance records, mandates or related agreements where affected.
10. Checking any Shareholders' Agreement for consistency with the revised MOI.
11. Communicating material governance changes to directors/shareholders and relevant stakeholders.
12. Any post-filing compliance calendar actions.
Each checklist item must explain WHY it is needed, exactly WHAT the user should do, WHO should do it, what evidence to keep, and how the user knows the step is complete.
Do not treat professional review as a substitute for giving practical guidance.
GLOBAL PROFESSIONAL-REVIEW RULE:
- Every substantive drafting recommendation and every next-step instruction must be framed so the user is also advised to obtain review by an appropriately qualified professional before relying on, adopting, signing or filing it.
- The final output must include one clear professional_review_recommendation identifying the most relevant professional review required for the revised MOI and implementation steps.
- Keep the recommendation proportionate and specific; do not use generic disclaimers as a substitute for substantive guidance.`,
    input:[{role:'user',content:[
      {type:'input_text',text:`Company: ${review.organisation_name||'Not supplied'}
Review mode: ${review.review_mode||'customised_moi_review'}
Detected form: ${review.detected_form||'unknown'}
Short-form suitability assessment: ${JSON.stringify(review.short_form_assessment_json||{})}

Accepted changes:
${accepted.map((d:any)=>`- ${d.change_key} | ${d.title} | Clause ${d.clause_reference||'not identified'} | Proposed change: ${d.proposed_change} | User note: ${d.user_note||''}`).join('\n')}

Rejected changes for context only — DO NOT incorporate:
${(decisions||[]).filter((d:any)=>d.decision==='rejected').map((d:any)=>`- ${d.change_key} | ${d.title}`).join('\n')||'(none)'}

Prepare the complete revised MOI and the detailed explanatory implementation checklist.`},
      {type:'input_file',file_url:signed.signedUrl}
    ]}],
    text:{verbosity:'high',format:{type:'json_schema',name:'eezicomply_revised_moi',strict:true,schema}}
  } as any,{signal:AbortSignal.timeout(160000)});

  const result=JSON.parse(response.output_text||'{}');
  await admin.from('eezicomply_moi_reviews').update({
    revised_moi_text:result.revised_moi,
    next_steps_json:result.next_steps,
    revision_generated_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('id',reviewId);

  await admin.from('eezicomply_review_events').insert({
    review_id:reviewId,owner_id:user.id,event_type:'revised_moi_generated',
    event_data:{accepted_changes:accepted.map((x:any)=>x.change_key)}
  });

  return json({ok:true,review_id:reviewId,...result});
});