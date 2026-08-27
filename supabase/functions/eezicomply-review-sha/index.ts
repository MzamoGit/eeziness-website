import OpenAI from 'npm:openai';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);

  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('OPENAI_API_KEY');
  if(!key)return json({error:"Shareholders' Agreement Review intelligence is not activated."},503);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:ue}=await admin.auth.getUser(token);
  if(ue||!user)return json({error:'Unauthorised'},401);

  let p:any={};try{p=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const reviewId=p.review_id;if(!reviewId)return json({error:'review_id is required'},400);

  const {data:review,error:re}=await admin.from('eezicomply_sha_reviews').select('*').eq('id',reviewId).single();
  if(re||!review)return json({error:'Review not found'},404);
  if(review.owner_id!==user.id)return json({error:'Forbidden'},403);
  if(!review.storage_path)return json({error:"Shareholders' Agreement has not been uploaded"},400);

  await admin.from('eezicomply_sha_reviews').update({status:'processing',last_error:null,updated_at:new Date().toISOString()}).eq('id',reviewId);

  try{
    const {data:signed,error:se}=await admin.storage.from('eezicomply-sha').createSignedUrl(review.storage_path,180);
    if(se||!signed?.signedUrl)throw new Error(se?.message||'Could not access uploaded agreement');

    const schema={type:'object',additionalProperties:false,properties:{
      executive_summary:{type:'string'},
      overall_commentary:{type:'string'},
      overall_recommendation:{type:'string'},
      overall_assessment:{type:'string',enum:['generally_balanced','review_required','material_issues_identified']},
      agreement_profile:{type:'object',additionalProperties:false,properties:{
        apparent_parties:{type:'array',items:{type:'string'}},
        agreement_purpose:{type:'string'},
        notable_features:{type:'array',items:{type:'string'}}
      },required:['apparent_parties','agreement_purpose','notable_features']},
      findings:{type:'array',items:{type:'object',additionalProperties:false,properties:{
        title:{type:'string'},
        category:{type:'string',enum:['governance','board_composition','reserved_matters','shareholder_rights','minority_protection','funding_obligations','distributions','information_rights','transfer_restrictions','preemption','tag_along','drag_along','deadlock','default','exit','valuation','restraint','confidentiality','dispute_resolution','termination','other']},
        classification:{type:'string',enum:['legal_requirement','governance_recommendation','commercial_choice','information']},
        severity:{type:'string',enum:['critical','material','moderate','low','information']},
        clause_reference:{type:'string'},
        current_position:{type:'string'},
        chatgpt_comment:{type:'string'},
        why_it_matters:{type:'string'},
        legal_position:{type:'string'},
        recommendation:{type:'string'},
        professional_review_recommendation:{type:'string'},
        recommended_action:{type:'string'},
        amendment_likely_required:{type:'boolean'}
      },required:['title','category','classification','severity','clause_reference','current_position','chatgpt_comment','why_it_matters','legal_position','recommendation','professional_review_recommendation','recommended_action','amendment_likely_required']}},
      key_governance_map:{type:'object',additionalProperties:false,properties:{
        board_composition_and_appointment:{type:'string'},
        reserved_matters_and_vetoes:{type:'string'},
        shareholder_voting:{type:'string'},
        funding_obligations:{type:'string'},
        information_rights:{type:'string'},
        transfer_and_preemption:{type:'string'},
        tag_and_drag:{type:'string'},
        deadlock:{type:'string'},
        default_and_remedies:{type:'string'},
        exit_and_valuation:{type:'string'}
      },required:['board_composition_and_appointment','reserved_matters_and_vetoes','shareholder_voting','funding_obligations','information_rights','transfer_and_preemption','tag_and_drag','deadlock','default_and_remedies','exit_and_valuation']},
      priority_actions:{type:'array',items:{type:'object',additionalProperties:false,properties:{
        priority:{type:'integer',minimum:1},action:{type:'string'},reason:{type:'string'}
      },required:['priority','action','reason']}},
      proposed_changes:{type:'array',items:{type:'object',additionalProperties:false,properties:{
        change_key:{type:'string'},title:{type:'string'},clause_reference:{type:'string'},current_position:{type:'string'},
        proposed_change:{type:'string'},reason:{type:'string'},classification:{type:'string',enum:['required','recommended','optional']},
        priority:{type:'string',enum:['high','medium','low']},professional_review_recommendation:{type:'string'}
      },required:['change_key','title','clause_reference','current_position','proposed_change','reason','classification','priority','professional_review_recommendation']}},
      questions_for_shareholders:{type:'array',items:{type:'string'}},
      limitations:{type:'array',items:{type:'string'}}
    },required:['executive_summary','overall_commentary','overall_recommendation','overall_assessment','agreement_profile','findings','key_governance_map','priority_actions','proposed_changes','questions_for_shareholders','limitations']};

    const ai=new OpenAI({apiKey:key});
    const response=await ai.responses.create({
      model:'gpt-5',
      reasoning:{effort:'medium'},
      instructions:`You are EeziComply's senior South African Shareholders' Agreement review engine.

Review the uploaded Shareholders' Agreement as a standalone agreement. The output must read like a strong ChatGPT professional document review: natural, analytical, nuanced, commercially aware and specific.

REVIEW STANDARD:
- Explain what material clauses actually do in practical terms.
- Identify unusual or one-sided provisions, hidden vetoes, minority risks, majority constraints, funding exposure, transfer restrictions, deadlock traps, valuation problems, default consequences and exit risks.
- Distinguish clearly between legal requirements, governance recommendations, commercial choices and information.
- Do not label a negotiated commercial bargain as unlawful merely because it is aggressive or unusual.
- Where a clause is unusual but legitimate, explain the trade-off.
- Consider interactions between clauses rather than reviewing each in isolation.
- Use clause/page references wherever possible.
- Do not invent legislation or section numbers. If uncertain, explain the legal principle without fabricating a citation.
- Do not infer MOI terms. This is a standalone SHA review; any possible MOI dependency should be identified as something to check in a later alignment review.

COMMENTS AND RECOMMENDATIONS:
- Every material finding must include substantive chatgpt_comment, recommendation and recommended_action.
- Every substantive advice item or suggestion must also include a professional_review_recommendation. Identify the appropriate legal, tax, accounting, company-secretarial or governance professional where practical.
- Professional review must not replace useful analysis.

PROPOSED CHANGES:
- For every amendment recommended, create a proposed_changes item with specific replacement/amending language or a sufficiently detailed drafting instruction for later redrafting.
- Classify each as required, recommended or optional.
- Make the proposed change specific enough that a later drafting step can incorporate it without guessing.
- Do not force optional commercial preferences on the user.

Focus particularly on board control, reserved matters, veto rights, funding obligations, information rights, minority protection, transfer restrictions, pre-emption, tag/drag, deadlock, defaults/remedies, valuation and exit.`,
      input:[{role:'user',content:[
        {type:'input_text',text:`Company: ${review.organisation_name||'Not supplied'}\nFilename: ${review.original_filename||"Shareholders' Agreement"}\nPerform a complete standalone Shareholders' Agreement review.`},
        {type:'input_file',file_url:signed.signedUrl}
      ]}],
      text:{verbosity:'high',format:{type:'json_schema',name:'eezicomply_sha_review',strict:true,schema}}
    } as any,{signal:AbortSignal.timeout(130000)});

    const result=JSON.parse(response.output_text||'{}');
    const proposed=Array.isArray(result.proposed_changes)?result.proposed_changes:[];
    if(proposed.length){
      await admin.from('eezicomply_sha_change_decisions').upsert(
        proposed.map((c:any)=>({
          review_id:reviewId,owner_id:user.id,change_key:c.change_key,title:c.title,
          clause_reference:c.clause_reference||null,proposed_change:c.proposed_change,decision:'pending',
          updated_at:new Date().toISOString()
        })),{onConflict:'review_id,change_key',ignoreDuplicates:false}
      );
    }

    await admin.from('eezicomply_sha_reviews').update({
      status:'complete',review_json:result,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',reviewId);

    return json({ok:true,review_id:reviewId,result});
  }catch(e:any){
    const message=String(e?.message||e);
    await admin.from('eezicomply_sha_reviews').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',reviewId);
    return json({error:message},500);
  }
});