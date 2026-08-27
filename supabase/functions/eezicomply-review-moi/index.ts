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

    // First identify whether this is a prescribed standard short-form MOI.
    const detector=new OpenAI({apiKey:openaiKey});
    const detectSchema={type:'object',additionalProperties:false,properties:{
      detected_form:{type:'string',enum:['cor15_1a_private_short_form','cor15_1c_npc_short_form','other_or_customised','uncertain']},
      confidence:{type:'number',minimum:0,maximum:1},
      explanation:{type:'string'},
      company_type:{type:'string'}
    },required:['detected_form','confidence','explanation','company_type']};

    const detectResponse=await detector.responses.create({
      model:'gpt-5',
      reasoning:{effort:'low'},
      instructions:`Identify whether the uploaded South African Memorandum of Incorporation is the prescribed standard short-form CoR 15.1A for a private company or CoR 15.1C for a non-profit company without members. Do not classify a document as a prescribed short form merely because it is short. Look for the prescribed form identity, structure and headings. If it is customised, a long form, an amended bespoke MOI or uncertain, say so.`,
      input:[{role:'user',content:[
        {type:'input_text',text:`Filename: ${review.original_filename||'MOI'}\nIdentify the MOI form before substantive review.`},
        {type:'input_file',file_url:signed.signedUrl}
      ]}],
      text:{verbosity:'low',format:{type:'json_schema',name:'eezicomply_moi_form_detection',strict:true,schema:detectSchema}}
    } as any,{signal:AbortSignal.timeout(60000)});

    const detection=JSON.parse(detectResponse.output_text||'{}');
    const isShortForm=['cor15_1a_private_short_form','cor15_1c_npc_short_form'].includes(detection.detected_form)&&Number(detection.confidence||0)>=0.80;

    if(isShortForm){
      const formName=detection.detected_form==='cor15_1a_private_short_form'?'CoR 15.1A':'CoR 15.1C';
      const questions=detection.detected_form==='cor15_1a_private_short_form' ? [
        {key:'shareholder_count',question:'How many shareholders does the company currently have?',answer_type:'number'},
        {key:'unrelated_shareholders',question:'Are any of the shareholders unrelated investors or business partners rather than members of the same family/group?',answer_type:'yes_no'},
        {key:'minority_investors',question:'Does any minority shareholder expect special protection over important company decisions?',answer_type:'yes_no'},
        {key:'board_seats',question:'Does any shareholder or investor expect a right to appoint or nominate a director?',answer_type:'yes_no'},
        {key:'reserved_matters',question:'Are there important decisions that you believe should need special or unanimous shareholder approval?',answer_type:'yes_no'},
        {key:'transfer_controls',question:'Do the shareholders want special restrictions on selling or transferring shares?',answer_type:'yes_no'},
        {key:'funding_obligations',question:'Do shareholders have agreed obligations to provide future funding, guarantees or shareholder loans?',answer_type:'yes_no'},
        {key:'deadlock_risk',question:'Could a disagreement between shareholders materially prevent the company from making important decisions?',answer_type:'yes_no'},
        {key:'external_investment',question:'Is the company expecting external investment, a funding round or a new shareholder in the foreseeable future?',answer_type:'yes_no'},
        {key:'sha_exists',question:'Does the company have, or is it negotiating, a Shareholders’ Agreement?',answer_type:'yes_no'},
        {key:'different_share_rights',question:'Do different shareholders have, or expect to have, different economic, voting or control rights?',answer_type:'yes_no'}
      ] : [
        {key:'members_expected',question:'Does the NPC have members, or do you expect it to have members in future?',answer_type:'yes_no'},
        {key:'special_board_rights',question:'Do any founders, funders or stakeholders expect special rights to appoint or remove directors?',answer_type:'yes_no'},
        {key:'special_approval_matters',question:'Are there important decisions that should require special approval beyond the ordinary board process?',answer_type:'yes_no'},
        {key:'funder_governance',question:'Do funders, donors or strategic partners require specific governance protections or reporting rights?',answer_type:'yes_no'},
        {key:'complex_governance',question:'Does the organisation have a governance structure that is more complex than a small board managing the NPC directly?',answer_type:'yes_no'},
        {key:'pbo_or_18a',question:'Is the NPC applying for, or does it already have, PBO or Section 18A status?',answer_type:'yes_no'},
        {key:'npo_registration',question:'Is the NPC also registered, or intended to be registered, as an NPO with the Department of Social Development?',answer_type:'yes_no'},
        {key:'constitution_exists',question:'Does the organisation also use a separate Constitution or governance document?',answer_type:'yes_no'}
      ];

      const shortResult={
        executive_summary:`EeziComply detected the prescribed standard short-form ${formName}. This is not a bespoke MOI, so the useful review is whether the standard governance framework remains suitable for how the organisation is actually owned and managed.`,
        overall_commentary:`A short-form MOI should not attract artificial drafting criticisms simply because it does not contain detailed negotiated governance provisions. EeziComply will therefore assess suitability rather than manufacture clause defects.`,
        overall_recommendation:`Answer the short business questions below. EeziComply will then tell you whether retaining the standard MOI is sensible or whether a customised replacement MOI should be considered. Any recommendation should be reviewed by an appropriately qualified legal or company-secretarial professional before reliance or filing.`,
        overall_assessment:'review_required',
        document_profile:{company_type:detection.company_type||'',moi_form:formName,notable_features:['Prescribed standard short-form MOI','Suitability review required rather than bespoke clause review']},
        findings:[],
        key_governance_map:{
          board_appointment_and_removal:'Largely governed by the prescribed short-form/default statutory framework unless supplemented elsewhere.',
          board_powers:'Largely governed by the prescribed short-form/default statutory framework.',
          shareholder_reserved_matters:'No bespoke reserved-matters regime identified in the standard form.',
          approval_thresholds:'Standard/default thresholds generally apply unless another valid governance arrangement changes the position.',
          share_transfers_and_preemption:'No bespoke negotiated transfer regime should be assumed from the standard form alone.',
          distributions:'Standard statutory/default position applies.',
          meeting_and_voting_rules:'Standard statutory/default framework applies.',
          amendment_rules:'A move to bespoke governance generally requires a proper MOI amendment/substitution process.'
        },
        priority_actions:[{priority:1,action:'Complete the short-form suitability questions',reason:'The correct recommendation depends on the company’s actual ownership, investor and governance needs rather than the length of the prescribed form.'}],
        proposed_changes:[],
        questions_for_company:questions.map((q:any)=>q.question),
        limitations:['Suitability cannot be concluded until the company answers the short-form governance questions.']
      };

      await admin.from('eezicomply_moi_reviews').update({
        status:'complete',
        review_mode:'short_form_suitability',
        detected_form:detection.detected_form,
        form_detection_confidence:detection.confidence,
        review_json:shortResult,
        updated_at:new Date().toISOString(),
        completed_at:new Date().toISOString()
      }).eq('id',reviewId);

      await admin.from('eezicomply_review_events').insert({
        review_id:reviewId,owner_id:user.id,event_type:'short_form_detected',
        event_data:{detected_form:detection.detected_form,confidence:detection.confidence}
      });

      return json({ok:true,review_id:reviewId,short_form_detected:true,detected_form:detection.detected_form,form_name:formName,detection,questions,result:shortResult});
    }

    await admin.from('eezicomply_moi_reviews').update({
      review_mode:'customised_moi_review',
      detected_form:detection.detected_form||'other_or_customised',
      form_detection_confidence:detection.confidence||null,
      updated_at:new Date().toISOString()
    }).eq('id',reviewId);

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
          professional_review_recommendation:{type:'string'},
          recommended_action:{type:'string'},
          amendment_likely_required:{type:'boolean'},
          professional_verification_required:{type:'boolean'}
        },required:['title','category','classification','severity','clause_reference','current_position','chatgpt_comment','why_it_matters','companies_act_position','recommendation','professional_review_recommendation','recommended_action','amendment_likely_required','professional_verification_required']}},
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
        proposed_changes:{type:'array',items:{type:'object',additionalProperties:false,properties:{
          change_key:{type:'string'},
          title:{type:'string'},
          clause_reference:{type:'string'},
          current_position:{type:'string'},
          proposed_change:{type:'string'},
          reason:{type:'string'},
          classification:{type:'string',enum:['required','recommended','optional']},
          priority:{type:'string',enum:['high','medium','low']},
          professional_verification_required:{type:'boolean'},
          professional_review_recommendation:{type:'string'}
        },required:['change_key','title','clause_reference','current_position','proposed_change','reason','classification','priority','professional_verification_required','professional_review_recommendation']}},
        questions_for_company:{type:'array',items:{type:'string'}},
        limitations:{type:'array',items:{type:'string'}}
      },
      required:['executive_summary','overall_commentary','overall_recommendation','overall_assessment','document_profile','findings','key_governance_map','priority_actions','proposed_changes','questions_for_company','limitations']
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
- For EVERY substantive finding and EVERY proposed change, include a professional_review_recommendation telling the user to have the advice/change reviewed by an appropriately qualified professional before relying on, adopting or filing it. Name the most relevant type of professional where practical (for example legal, tax, accounting, company-secretarial or governance).
- Explain the practical consequence in plain language.
- Use the MOI's own clause/page references wherever possible.
- Never invent a Companies Act section number. Cite a section number only when you are confident. If uncertain, state the Companies Act principle without fabricating a citation and mark professional verification required.
- Flag contradictions inside the MOI, ambiguous drafting and clauses that may be ineffective because the Companies Act takes precedence.
- This is NOT an MOI-versus-shareholders-agreement comparison. Do not infer SHA terms.
- The output must say when an issue probably requires amendment versus when the company merely needs to understand the chosen governance position.
- Recommend qualified legal/professional review for material legal conclusions, but do not make the entire output useless by disclaiming everything.
- This professional-review rule is mandatory even where the issue appears low-risk or the recommendation is only a governance improvement. Keep it proportionate and concise.
- Do not merely repeat clause wording. Add judgement, context and practical interpretation.
- Where a clause is acceptable but unusual, say so explicitly and explain the trade-off rather than manufacturing a problem.
- Where several clauses interact, comment on the combined effect.
- The overall_commentary should read like the opening analysis ChatGPT would give after reading the full MOI.
- The overall_recommendation should tell management what to do next, in priority order, in clear prose.
- For every amendment you recommend, create a proposed_changes item with a stable change_key and usable replacement drafting. Do not merely say "amend clause". Draft the substance of the change the user could accept.
- proposed_changes must distinguish required, recommended and optional changes. Do not force optional governance preferences on the user.
- A proposed change should be sufficiently specific that, if accepted, a later drafting step can incorporate it into a complete revised MOI without guessing the intended amendment.
- Be specific and decision-useful. Depth is preferable to superficial brevity.`,
      input:[{role:'user',content:[
        {type:'input_text',text:`Organisation: ${review.organisation_name||'Not supplied'}\nFilename: ${review.original_filename||'MOI'}\nPerform a complete standalone MOI governance and compliance review.`},
        {type:'input_file',file_url:signed.signedUrl}
      ]}],
      text:{verbosity:'medium',format:{type:'json_schema',name:'eezicomply_moi_review',strict:true,schema}}
    } as any,{signal:AbortSignal.timeout(130000)});

    const result=JSON.parse(response.output_text||'{}');

    const proposedChanges=Array.isArray(result.proposed_changes)?result.proposed_changes:[];
    if(proposedChanges.length){
      await admin.from('eezicomply_moi_change_decisions').upsert(
        proposedChanges.map((c:any)=>({
          review_id:reviewId,
          owner_id:user.id,
          change_key:c.change_key,
          title:c.title,
          clause_reference:c.clause_reference||null,
          proposed_change:c.proposed_change,
          decision:'pending',
          updated_at:new Date().toISOString()
        })),
        {onConflict:'review_id,change_key',ignoreDuplicates:false}
      );
    }

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
