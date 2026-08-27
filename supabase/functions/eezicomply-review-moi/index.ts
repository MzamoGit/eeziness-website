import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);

  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const url=Deno.env.get('SUPABASE_URL')!;
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey=Deno.env.get('OPENAI_API_KEY');
  if(!openaiKey) return json({error:'MOI Review intelligence is not activated.'},503);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return json({error:'Unauthorised'},401);

  let payload:any={};
  try{payload=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const reviewId=payload.review_id;
  if(!reviewId) return json({error:'review_id is required'},400);

  const {data:review,error:reviewError}=await admin
    .from('eezicomply_moi_reviews')
    .select('*')
    .eq('id',reviewId)
    .single();

  if(reviewError||!review) return json({error:'Review not found'},404);
  if(review.owner_id!==user.id) return json({error:'Forbidden'},403);
  if(!review.storage_path) return json({error:'MOI document has not been uploaded'},400);

  await admin.from('eezicomply_moi_reviews').update({
    status:'processing',last_error:null,updated_at:new Date().toISOString()
  }).eq('id',reviewId);

  await admin.from('eezicomply_review_events').insert({
    review_id:reviewId,owner_id:user.id,event_type:'review_started'
  });

  try{
    const {data:signed,error:signedError}=await admin.storage
      .from('eezicomply-moi')
      .createSignedUrl(review.storage_path,180);
    if(signedError||!signed?.signedUrl) throw new Error(signedError?.message||'Could not access uploaded MOI');

    const schema={
      type:'object',
      additionalProperties:false,
      properties:{
        executive_summary:{type:'string'},
        overall_commentary:{type:'string'},
        overall_recommendation:{type:'string'},
        overall_assessment:{type:'string',enum:['generally_sound','review_required','material_issues_identified']},
        document_profile:{type:'object',additionalProperties:false,properties:{
          company_type:{type:'string'},
          moi_form:{type:'string'},
          notable_features:{type:'array',items:{type:'string'}}
        },required:['company_type','moi_form','notable_features']},
        findings:{type:'array',items:{type:'object',additionalProperties:false,properties:{
          title:{type:'string'},
          category:{type:'string',enum:['legal_compliance','governance','shareholder_rights','board_powers','reserved_matters','approval_thresholds','transfers','capital_and_securities','distributions','meetings','amendment','other']},
          classification:{type:'string',enum:['legal_requirement','governance_recommendation','commercial_choice','information']},
          severity:{type:'string',enum:['critical','material','moderate','low','information']},
          clause_reference:{type:'string'},
          current_position:{type:'string'},
          chatgpt_comment:{type:'string'},
          why_it_matters:{type:'string'},
          companies_act_position:{type:'string'},
          recommendation:{type:'string'},
          recommended_action:{type:'string'},
          amendment_likely_required:{type:'boolean'},
          professional_verification_required:{type:'boolean'}
        },required:['title','category','classification','severity','clause_reference','current_position','chatgpt_comment','why_it_matters','companies_act_position','recommendation','recommended_action','amendment_likely_required','professional_verification_required']}},
        key_governance_map:{type:'object',additionalProperties:false,properties:{
          board_appointment_and_removal:{type:'string'},
          board_powers:{type:'string'},
          shareholder_reserved_matters:{type:'string'},
          approval_thresholds:{type:'string'},
          share_transfers_and_preemption:{type:'string'},
          distributions:{type:'string'},
          meeting_and_voting_rules:{type:'string'},
          amendment_rules:{type:'string'}
        },required:['board_appointment_and_removal','board_powers','shareholder_reserved_matters','approval_thresholds','share_transfers_and_preemption','distributions','meeting_and_voting_rules','amendment_rules']},
        priority_actions:{type:'array',items:{type:'object',additionalProperties:false,properties:{
          priority:{type:'integer',minimum:1},
          action:{type:'string'},
          reason:{type:'string'}
        },required:['priority','action','reason']}},
        questions_for_company:{type:'array',items:{type:'string'}},
        limitations:{type:'array',items:{type:'string'}}
      },
      required:['executive_summary','overall_commentary','overall_recommendation','overall_assessment','document_profile','findings','key_governance_map','priority_actions','questions_for_company','limitations']
    };

    const client=new OpenAI({apiKey:openaiKey});
    const response=await client.responses.create({
      model:'gpt-5',
      reasoning:{effort:'medium'},
      instructions:`You are EeziComply's senior South African company-secretarial and governance review engine.

Review the uploaded Memorandum of Incorporation as a standalone document. Your job is to help a company understand what its MOI actually does, where it creates legal/compliance risk, where it contains unusual or commercially important governance choices, and what should be reviewed or amended.

STRICT RULES:
- Distinguish clearly between: (1) legal requirement, (2) governance recommendation, (3) commercial/shareholder choice, and (4) information.
- Do not label a negotiated commercial choice as unlawful merely because another drafting approach may be more common.
- Identify unusual provisions, restrictions, reserved matters, director/shareholder powers, board appointment/removal rights, voting and approval thresholds, transfer restrictions, pre-emption rights, capital/securities provisions, distribution rules, meeting rules and MOI amendment requirements.
- Write the review in the same standard a strong ChatGPT professional review would use: natural, analytical, nuanced and specific rather than checklist-like.
- For every material finding, include a substantive "chatgpt_comment" explaining what you notice in the drafting, how you interpret it, and the practical significance.
- For every material finding, include a "recommendation" written as direct professional advice to the company, not merely a system action label.
- Explain the practical consequence in plain language.
- Use the MOI's own clause/page references wherever possible.
- Never invent a Companies Act section number. Cite a section number only when you are confident. If uncertain, state the Companies Act principle without fabricating a citation and mark professional verification required.
- Flag contradictions inside the MOI, ambiguous drafting and clauses that may be ineffective because the Companies Act takes precedence.
- This is NOT an MOI-versus-shareholders-agreement comparison. Do not infer SHA terms.
- The output must say when an issue probably requires amendment versus when the company merely needs to understand the chosen governance position.
- Recommend qualified legal/professional review for material legal conclusions, but do not make the entire output useless by disclaiming everything.
- Do not merely repeat clause wording. Add judgement, context and practical interpretation.
- Where a clause is acceptable but unusual, say so explicitly and explain the trade-off rather than manufacturing a problem.
- Where several clauses interact, comment on the combined effect.
- The overall_commentary should read like the opening analysis ChatGPT would give after reading the full MOI.
- The overall_recommendation should tell management what to do next, in priority order, in clear prose.
- Be specific and decision-useful. Depth is preferable to superficial brevity.`,
      input:[{role:'user',content:[
        {type:'input_text',text:`Organisation: ${review.organisation_name||'Not supplied'}\nFilename: ${review.original_filename||'MOI'}\nPerform a complete standalone MOI governance and compliance review.`},
        {type:'input_file',file_url:signed.signedUrl}
      ]}],
      text:{verbosity:'medium',format:{type:'json_schema',name:'eezicomply_moi_review',strict:true,schema}}
    } as any,{signal:AbortSignal.timeout(130000)});

    const result=JSON.parse(response.output_text||'{}');

    await admin.from('eezicomply_moi_reviews').update({
      status:'complete',
      review_json:result,
      completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq('id',reviewId);

    await admin.from('eezicomply_review_events').insert({
      review_id:reviewId,owner_id:user.id,event_type:'review_completed',
      event_data:{overall_assessment:result.overall_assessment,findings:(result.findings||[]).length}
    });

    return json({ok:true,review_id:reviewId,result});
  }catch(e:any){
    const message=String(e?.message||e);
    await admin.from('eezicomply_moi_reviews').update({
      status:'failed',last_error:message,updated_at:new Date().toISOString()
    }).eq('id',reviewId);
    await admin.from('eezicomply_review_events').insert({
      review_id:reviewId,owner_id:user.id,event_type:'review_failed',event_data:{message}
    });
    return json({error:message},500);
  }
});
