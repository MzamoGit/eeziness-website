import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);

  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('OPENAI_API_KEY');
  if(!key)return json({error:'Short-form MOI suitability intelligence is not activated.'},503);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:ue}=await admin.auth.getUser(token);
  if(ue||!user)return json({error:'Unauthorised'},401);

  let p:any={};try{p=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const reviewId=p.review_id,answers=p.answers;
  if(!reviewId||!answers||typeof answers!=='object')return json({error:'review_id and answers are required'},400);

  const {data:review,error:re}=await admin.from('eezicomply_moi_reviews').select('*').eq('id',reviewId).single();
  if(re||!review)return json({error:'Review not found'},404);
  if(review.owner_id!==user.id)return json({error:'Forbidden'},403);
  if(review.review_mode!=='short_form_suitability')return json({error:'This review is not in short-form suitability mode.'},400);
  if(!['cor15_1a_private_short_form','cor15_1c_npc_short_form'].includes(review.detected_form))return json({error:'A recognised prescribed short-form MOI was not detected.'},400);

  const schema={type:'object',additionalProperties:false,properties:{
    executive_summary:{type:'string'},
    suitability_outcome:{type:'string',enum:['retain_standard_moi','retain_with_monitoring','customised_moi_recommended','customised_moi_strongly_recommended']},
    overall_commentary:{type:'string'},
    overall_recommendation:{type:'string'},
    standard_moi_profile:{type:'object',additionalProperties:false,properties:{
      detected_form:{type:'string'},what_it_means:{type:'string'},why_it_may_be_suitable:{type:'string'},what_it_does_not_customise:{type:'array',items:{type:'string'}}
    },required:['detected_form','what_it_means','why_it_may_be_suitable','what_it_does_not_customise']},
    suitability_factors:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      factor:{type:'string'},answer:{type:'string'},comment:{type:'string'},impact:{type:'string',enum:['supports_retention','neutral','supports_customisation']},
      professional_review_recommendation:{type:'string'}
    },required:['factor','answer','comment','impact','professional_review_recommendation']}},
    findings:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      title:{type:'string'},classification:{type:'string',enum:['legal_requirement','governance_recommendation','commercial_choice','information']},
      severity:{type:'string',enum:['critical','material','moderate','low','information']},chatgpt_comment:{type:'string'},why_it_matters:{type:'string'},
      recommendation:{type:'string'},professional_review_recommendation:{type:'string'}
    },required:['title','classification','severity','chatgpt_comment','why_it_matters','recommendation','professional_review_recommendation']}},
    proposed_changes:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      change_key:{type:'string'},title:{type:'string'},clause_reference:{type:'string'},current_position:{type:'string'},proposed_change:{type:'string'},
      reason:{type:'string'},classification:{type:'string',enum:['required','recommended','optional']},priority:{type:'string',enum:['high','medium','low']},
      professional_verification_required:{type:'boolean'},professional_review_recommendation:{type:'string'}
    },required:['change_key','title','clause_reference','current_position','proposed_change','reason','classification','priority','professional_verification_required','professional_review_recommendation']}},
    trigger_events_for_future_review:{type:'array',items:{type:'string'}},
    alignment_review_recommended:{type:'boolean'},
    alignment_review_reason:{type:'string'},
    priority_actions:{type:'array',items:{type:'object',additionalProperties:false,properties:{priority:{type:'integer'},action:{type:'string'},reason:{type:'string'}},required:['priority','action','reason']}},
    limitations:{type:'array',items:{type:'string'}}
  },required:['executive_summary','suitability_outcome','overall_commentary','overall_recommendation','standard_moi_profile','suitability_factors','findings','proposed_changes','trigger_events_for_future_review','alignment_review_recommended','alignment_review_reason','priority_actions','limitations']};

  const ai=new OpenAI({apiKey:key});
  const formName=review.detected_form==='cor15_1a_private_short_form'?'CoR 15.1A':'CoR 15.1C';

  const response=await ai.responses.create({
    model:'gpt-5',
    reasoning:{effort:'medium'},
    instructions:`You are EeziComply's South African standard short-form MOI suitability review engine.

The uploaded MOI has already been identified as the prescribed standard short-form ${formName}. Do NOT criticise it for being short or for lacking bespoke negotiated provisions. The task is to answer the real business question: is the standard MOI still suitable for how this company/NPC is actually owned, governed and expected to evolve?

MANDATORY PRINCIPLES:
- A valid positive outcome is "retain_standard_moi". Do not manufacture amendments.
- Base suitability on the user's plain-language business/governance answers.
- Distinguish legal requirements, governance recommendations, commercial choices and information.
- If the organisation is simple and no bespoke rights are needed, say that retaining the prescribed MOI is sensible.
- If bespoke shareholder, investor, board, transfer, funding, minority-protection, deadlock, funder-governance or other special rights are needed, explain why a customised MOI should be considered.
- If a Shareholders' Agreement exists or is being negotiated, consider whether an MOI ↔ SHA Alignment Review should be recommended.
- For a private company, especially consider multiple unrelated shareholders, minority protections, board nomination rights, reserved matters, transfer restrictions, funding obligations, deadlock, external investment and differentiated share/control rights.
- For an NPC, especially consider whether the organisation actually needs members, bespoke board/funder rights, special approval matters, PBO/Section 18A requirements, NPO registration needs and any separate Constitution.
- Do not ask the user to make legal judgements.
- Never invent Companies Act sections or CIPC form numbers.
- Every substantive suggestion must include a proportionate professional-review recommendation.
- Professional review must not replace useful practical analysis.

PROPOSED CHANGES:
- Only propose changes where the answers create a real reason for bespoke governance.
- Each proposed change must contain sufficiently specific drafting substance for the user to accept or reject.
- Use clause_reference "Replacement/customised MOI" where the standard form does not have a bespoke clause to amend.
- Classify each change as required, recommended or optional.
- If no customisation is justified, return an empty proposed_changes array.

POSITIVE OUTCOME:
If retaining the standard MOI is appropriate, say so clearly and explain why. Provide trigger events that should cause the company to review the position again.

STANDARD MOI LIMIT:
If changes are accepted later, EeziComply must prepare a complete customised/replacement MOI rather than pretending to edit the prescribed short-form template.`,
    input:`Organisation: ${review.organisation_name||'Not supplied'}
Detected form: ${formName}
User answers:
${JSON.stringify(answers,null,2)}

Produce the short-form MOI suitability assessment.`,
    text:{verbosity:'high',format:{type:'json_schema',name:'eezicomply_short_form_moi_suitability',strict:true,schema}}
  } as any,{signal:AbortSignal.timeout(120000)});

  const result=JSON.parse(response.output_text||'{}');
  const proposed=Array.isArray(result.proposed_changes)?result.proposed_changes:[];

  await admin.from('eezicomply_moi_change_decisions').delete().eq('review_id',reviewId);
  if(proposed.length){
    const ins=await admin.from('eezicomply_moi_change_decisions').insert(proposed.map((c:any)=>({
      review_id:reviewId,owner_id:user.id,change_key:c.change_key,title:c.title,
      clause_reference:c.clause_reference||'Replacement/customised MOI',proposed_change:c.proposed_change,decision:'pending',
      updated_at:new Date().toISOString()
    })));
    if(ins.error)return json({error:ins.error.message},500);
  }

  const retain=['retain_standard_moi','retain_with_monitoring'].includes(result.suitability_outcome);
  await admin.from('eezicomply_moi_reviews').update({
    short_form_answers:answers,
    short_form_assessment_json:result,
    review_json:result,
    retain_standard_moi:retain,
    status:'complete',
    completed_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('id',reviewId);

  await admin.from('eezicomply_review_events').insert({
    review_id:reviewId,owner_id:user.id,event_type:'short_form_suitability_completed',
    event_data:{suitability_outcome:result.suitability_outcome,proposed_changes:proposed.length,alignment_review_recommended:result.alignment_review_recommended}
  });

  return json({ok:true,review_id:reviewId,result});
});