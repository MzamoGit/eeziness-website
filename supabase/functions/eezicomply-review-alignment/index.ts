import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const key=Deno.env.get('OPENAI_API_KEY'); if(!key)return json({error:'Alignment intelligence is not activated.'},503);
 const {data:{user},error:ue}=await admin.auth.getUser(token); if(ue||!user)return json({error:'Unauthorised'},401);
 let p:any={}; try{p=await req.json()}catch{return json({error:'Invalid JSON'},400)}
 const reviewId=p.review_id;if(!reviewId)return json({error:'review_id is required'},400);
 const {data:review}=await admin.from('eezicomply_alignment_reviews').select('*').eq('id',reviewId).single();
 if(!review)return json({error:'Review not found'},404); if(review.owner_id!==user.id)return json({error:'Forbidden'},403);
 if(!review.moi_storage_path||!review.sha_storage_path)return json({error:'Upload both the MOI and Shareholders Agreement.'},400);
 await admin.from('eezicomply_alignment_reviews').update({status:'processing',last_error:null,updated_at:new Date().toISOString()}).eq('id',reviewId);

 try{
  const [moiUrl,shaUrl]=await Promise.all([
   admin.storage.from('eezicomply-alignment').createSignedUrl(review.moi_storage_path,180),
   admin.storage.from('eezicomply-alignment').createSignedUrl(review.sha_storage_path,180)
  ]);
  if(!moiUrl.data?.signedUrl||!shaUrl.data?.signedUrl)throw new Error('Could not access uploaded documents');

  const schema={type:'object',additionalProperties:false,properties:{
   executive_summary:{type:'string'},
   overall_commentary:{type:'string'},
   overall_recommendation:{type:'string'},
   alignment_assessment:{type:'string',enum:['substantially_aligned','review_required','material_conflicts_identified']},
   conflicts:{type:'array',items:{type:'object',additionalProperties:false,properties:{
    change_key:{type:'string'},topic:{type:'string'},severity:{type:'string',enum:['critical','material','moderate','low','information']},
    moi_reference:{type:'string'},moi_position:{type:'string'},sha_reference:{type:'string'},sha_position:{type:'string'},
    conflict_type:{type:'string',enum:['direct_contradiction','different_threshold','authority_conflict','missing_from_moi','missing_from_sha','ineffective_sha_provision','commercial_misalignment','drafting_ambiguity','no_conflict']},
    chatgpt_comment:{type:'string'},legal_precedence_position:{type:'string'},why_it_matters:{type:'string'},
    recommended_resolution:{type:'string'},target_document:{type:'string',enum:['moi','sha','both','none']},
    professional_review_recommendation:{type:'string'}
   },required:['change_key','topic','severity','moi_reference','moi_position','sha_reference','sha_position','conflict_type','chatgpt_comment','legal_precedence_position','why_it_matters','recommended_resolution','target_document','professional_review_recommendation']}},
   comparison_map:{type:'array',items:{type:'object',additionalProperties:false,properties:{
    topic:{type:'string'},moi_position:{type:'string'},sha_position:{type:'string'},alignment_status:{type:'string',enum:['aligned','different_but_compatible','conflict','not_addressed']},comment:{type:'string'}
   },required:['topic','moi_position','sha_position','alignment_status','comment']}},
   priority_actions:{type:'array',items:{type:'object',additionalProperties:false,properties:{priority:{type:'integer'},action:{type:'string'},reason:{type:'string'}},required:['priority','action','reason']}},
   questions_for_shareholders:{type:'array',items:{type:'string'}},
   limitations:{type:'array',items:{type:'string'}}
  },required:['executive_summary','overall_commentary','overall_recommendation','alignment_assessment','conflicts','comparison_map','priority_actions','questions_for_shareholders','limitations']};

  const ai=new OpenAI({apiKey:key});
  const response=await ai.responses.create({
   model:'gpt-5',
   reasoning:{effort:'high'},
   instructions:`You are EeziComply's senior South African MOI ↔ Shareholders' Agreement alignment review engine.

Compare the two documents clause-by-clause and topic-by-topic. This must read like a strong ChatGPT professional review, not a mechanical diff.

MANDATORY ANALYSIS:
- identify contradictions, different approval thresholds, board appointment/composition conflicts, reserved-matter inconsistencies, board-versus-shareholder authority conflicts, transfer/pre-emption differences, funding/distribution mismatches, inconsistent exit/deadlock arrangements, and provisions in the SHA that may be ineffective or vulnerable because the MOI or Companies Act takes precedence;
- identify SHA provisions that should also appear in the MOI if enforceability or company-level effect depends on the MOI;
- explain where documents differ but remain compatible;
- recommend WHICH document should change and WHY;
- distinguish legal requirement, enforceability concern, governance recommendation and commercial choice;
- never invent legislation or section numbers;
- do not assume the company's intended commercial bargain where the documents conflict. If intention matters, ask a plain-language shareholder question instead of guessing.

OUTPUT STANDARD:
- Every substantive conflict must include ChatGPT-style commentary, a specific recommended resolution and professional-review recommendation.
- target_document must state whether the MOI, SHA, both or neither should change.
- Professional review is mandatory for every substantive suggestion, but must not replace useful analysis.
- If a SHA clause may be ineffective because of the MOI/Companies Act, explain that clearly but cautiously.
- Focus on board rights, reserved matters, vetoes, voting thresholds, share transfers, pre-emption, tag/drag, funding, distributions, deadlock, defaults, valuation, exit and amendment mechanics.`,
   input:[{role:'user',content:[
    {type:'input_text',text:`Company: ${review.organisation_name||'Not supplied'}\nMOI: ${review.moi_filename||'MOI'}\nSHA: ${review.sha_filename||"Shareholders' Agreement"}\nPerform a full alignment review and recommend document-specific resolutions.`},
    {type:'input_file',file_url:moiUrl.data.signedUrl},
    {type:'input_file',file_url:shaUrl.data.signedUrl}
   ]}],
   text:{verbosity:'high',format:{type:'json_schema',name:'eezicomply_alignment_review',strict:true,schema}}
  } as any,{signal:AbortSignal.timeout(160000)});

  const result=JSON.parse(response.output_text||'{}');
  const changes=(result.conflicts||[]).filter((c:any)=>c.conflict_type!=='no_conflict'&&c.target_document!=='none');
  if(changes.length){
   await admin.from('eezicomply_alignment_change_decisions').upsert(changes.map((c:any)=>({
    review_id:reviewId,owner_id:user.id,change_key:c.change_key,topic:c.topic,target_document:c.target_document,
    proposed_resolution:c.recommended_resolution,decision:'pending',updated_at:new Date().toISOString()
   })),{onConflict:'review_id,change_key',ignoreDuplicates:false});
  }
  await admin.from('eezicomply_alignment_reviews').update({status:'complete',review_json:result,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',reviewId);
  return json({ok:true,review_id:reviewId,result});
 }catch(e:any){
  const message=String(e?.message||e);await admin.from('eezicomply_alignment_reviews').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',reviewId);
  return json({error:message},500);
 }
});