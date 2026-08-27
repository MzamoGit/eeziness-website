import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const outputText=(p:any)=>typeof p?.output_text==="string"?p.output_text:(p?.output||[]).flatMap((x:any)=>x?.content||[]).find((x:any)=>x?.type==="output_text")?.text||"";

function admin(){
  const j=Deno.env.get("SUPABASE_SECRET_KEYS");
  const k=j?JSON.parse(j)?.default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!k)throw Error("Server secret unavailable");
  return createClient(Deno.env.get("SUPABASE_URL")??"",k,{auth:{persistSession:false,autoRefreshToken:false}});
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return J({error:"Method not allowed"},405);

  try{
    const auth=req.headers.get("Authorization");
    if(!auth)return J({error:"Authentication required"},401);
    const token=auth.replace(/^Bearer\s+/i,"");
    const a=admin();
    const {data:{user},error:ue}=await a.auth.getUser(token);
    if(ue||!user)return J({error:"Invalid session"},401);

    const body=await req.json();
    const question=String(body?.question||"").trim();
    if(!question)return J({error:"question is required"},400);
    if(question.length>8000)return J({error:"Question is too long"},400);

    const companyId=body?.company_id||body?.companyId||null;
    const filingId=body?.filing_id||body?.filingId||null;
    const reviewType=body?.review_type||null;
    const reviewId=body?.review_id||null;

    let company:any=null, filing:any=null, uboContext:any=null, reviewContext:any=null, outputs:any[]=[];
    let contextType="general";

    if(companyId){
      const {data,error}=await a.from("eezicomply_companies").select("*").eq("id",companyId).eq("user_id",user.id).single();
      if(error||!data)return J({error:"Company not found"},404);
      company=data;contextType="company";
    }

    if(filingId){
      const {data:f,error:fe}=await a.from("eezicomply_filings").select("*").eq("id",filingId).eq("user_id",user.id).single();
      if(fe||!f)return J({error:"Filing not found"},404);
      filing=f;
      if(!company){
        const {data:c}=await a.from("eezicomply_companies").select("*").eq("id",f.company_id).eq("user_id",user.id).single();
        company=c||null;
      }
      const [docs,owners,links,controls,payments]=await Promise.all([
        a.from("eezicomply_documents").select("document_type,display_name,status,ai_read_status,confirmed_by_user,discrepancies,extracted_data").eq("filing_id",filingId),
        a.from("eezicomply_beneficial_owners").select("*").eq("filing_id",filingId),
        a.from("eezicomply_ownership_links").select("*").eq("filing_id",filingId).order("created_at"),
        a.from("eezicomply_filing_controls").select("*").eq("filing_id",filingId).maybeSingle(),
        a.from("eezicomply_payments").select("status").eq("filing_id",filingId).in("status",["paid","waived"])
      ]);
      const unlocked=(payments.data||[]).length>0||["paid","waived"].includes(String(f.payment_status||""));
      uboContext={
        unlocked,
        filing:{
          status:f.status,current_step:f.current_step,route_type:unlocked?f.route_type:null,route_label:unlocked?f.route_label:null,
          review_status:f.review_status,review_reasons:f.review_reasons,ownership_chain_resolved:f.ownership_chain_resolved
        },
        documents:docs.data||[],
        beneficial_owners:unlocked?(owners.data||[]):[],
        ownership_chain:unlocked?(links.data||[]):[],
        controls:unlocked?controls.data:null
      };
      contextType="ubo";
    }

    if(reviewType&&reviewId){
      const map:any={
        moi:"eezicomply_moi_reviews",
        sha:"eezicomply_sha_reviews",
        alignment:"eezicomply_alignment_reviews"
      };
      const table=map[reviewType];
      if(!table)return J({error:"Invalid review_type"},400);
      const {data:r,error:re}=await a.from(table).select("*").eq("id",reviewId).eq("owner_id",user.id).single();
      if(re||!r)return J({error:"Review not found"},404);
      reviewContext=r;
      if(!company&&r.company_id){
        const {data:c}=await a.from("eezicomply_companies").select("*").eq("id",r.company_id).eq("user_id",user.id).single();
        company=c||null;
      }
      contextType=reviewType+"_review";
    }

    if(company?.id){
      const {data:o}=await a.from("eezicomply_governance_outputs")
        .select("document_kind,file_format,version,document_status,display_name,created_at")
        .eq("company_id",company.id).eq("is_current",true).order("created_at",{ascending:false}).limit(20);
      outputs=o||[];
    }

    const {data:knowledge}=await a.from("eezicomply_knowledge")
      .select("slug,title,body,source_label,source_url,effective_date,rules_version")
      .eq("active",true).order("slug");

    const apiKey=Deno.env.get("OPENAI_API_KEY");
    if(!apiKey)return J({error:"AI_NOT_CONFIGURED",message:"Ask EeziComply is installed but the OpenAI API secret is not configured."},503);

    const companyContext=company?{
      id:company.id,
      registered_name:company.registered_name,
      registration_number:company.registration_number,
      entity_type:company.entity_type,
      director_member_count:company.director_member_count,
      incorporation_date:company.incorporation_date,
      anniversary_date:company.anniversary_date,
      contact_email:company.contact_email,
      contact_number:company.contact_number
    }:null;

    const reviewSummary=reviewContext?{
      review_type:reviewType,
      organisation_name:reviewContext.organisation_name,
      status:reviewContext.status,
      review_mode:reviewContext.review_mode||null,
      detected_form:reviewContext.detected_form||null,
      review_json:reviewContext.review_json||null,
      short_form_assessment_json:reviewContext.short_form_assessment_json||null,
      revised_moi_text:reviewContext.revised_moi_text||null,
      revised_sha_text:reviewContext.revised_sha_text||null,
      next_steps_json:reviewContext.next_steps_json||null
    }:null;

    const instructions=`You are Ask EeziComply, the high-quality AI company-secretarial, governance and compliance assistant inside EeziComply for South African SMEs.

QUALITY STANDARD:
- Respond at the standard of a strong ChatGPT professional advisory answer, not a short help-centre response.
- Give enough detail to answer the user's actual question completely. Use clear headings or bullets when useful.
- Explain the reasoning and practical consequence in plain English. Avoid unexplained legal jargon.
- If the question is narrow, be concise; if it is substantive, be detailed.
- Where the supplied company/review context supports it, answer specifically for this company rather than generically.
- Never invent company facts, legal provisions, CIPC outcomes, legislation sections, clause references, dates, ownership percentages or document content.
- If information is missing, say exactly what is missing and what the user should confirm.
- Distinguish clearly between legal requirements, governance recommendations, commercial choices and practical/process guidance.
- If a document or review contains an accepted/rejected recommendation, respect that user decision and do not silently reverse it.
- If documents conflict, explain the conflict and what needs to be resolved. Never silently overwrite one source with another.
- For a short-form MOI, do not manufacture deficiencies merely because the prescribed form is brief. Focus on suitability.
- For MOI/SHA alignment, explain which document should change and why when the review context supports that conclusion.
- Never ask for CIPC passwords or OTPs.
- Answer in the user's language where reasonably possible.

PROFESSIONAL REVIEW RULE:
Every substantive piece of advice, suggestion, recommendation, amendment idea, legal interpretation or next-step instruction must also recommend review by an appropriately qualified professional before the user relies on, adopts, signs, implements or files it. Name the relevant type of professional where practical (legal, company-secretarial, tax, accounting or governance). This must be proportionate and should not replace the actual advice.

UBO PAYWALL RULE:
If UBO context says unlocked=false, do not reveal or infer the personalised UBO filing route/classification, declared natural persons, reconstructed ownership chain or detailed ownership/control conclusions. You may still explain missing information, discrepancies, document requirements and general concepts. If unlocked=true, you may explain case-specific UBO conclusions supported by the supplied data.

SOURCE PRIORITY:
1. Current company/review/filing context supplied below.
2. Approved EeziComply knowledge supplied below.
3. General South African company-secretarial/governance knowledge, but be cautious with exact legal citations unless confident.
If sources are insufficient, say so.

CONTEXT TYPE: ${contextType}
COMPANY: ${JSON.stringify(companyContext)}
UBO CONTEXT: ${JSON.stringify(uboContext)}
REVIEW CONTEXT: ${JSON.stringify(reviewSummary)}
CURRENT PROFESSIONAL OUTPUTS: ${JSON.stringify(outputs)}
APPROVED KNOWLEDGE: ${JSON.stringify(knowledge||[])}`;

    const schema={
      type:"object",additionalProperties:false,
      properties:{
        answer:{type:"string"},
        confidence:{type:"string",enum:["low","medium","high"]},
        suggested_actions:{type:"array",items:{type:"string"}},
        source_context:{type:"array",items:{type:"string"}},
        professional_review_recommendation:{type:"string"},
        needs_human_review:{type:"boolean"},
        missing_information:{type:"array",items:{type:"string"}}
      },
      required:["answer","confidence","suggested_actions","source_context","professional_review_recommendation","needs_human_review","missing_information"]
    };

    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"gpt-5.6-luna",
        reasoning:{effort:"medium"},
        instructions,
        input:question,
        max_output_tokens:3500,
        store:false,
        text:{verbosity:"high",format:{type:"json_schema",name:"ask_eezicomply_answer",strict:true,schema}}
      })
    });

    const p=await r.json();
    if(!r.ok)return J({error:"AI_REQUEST_FAILED",message:p?.error?.message||"Ask EeziComply could not answer."},502);

    let result:any;
    try{result=JSON.parse(outputText(p))}catch{return J({error:"AI_RESPONSE_PARSE_FAILED"},502)}

    await a.from("eezicomply_ai_interactions").insert({
      user_id:user.id,
      filing_id:filingId||null,
      company_id:company?.id||companyId||null,
      review_type:reviewType||null,
      review_id:reviewId||null,
      context_type:contextType,
      question,
      answer:result.answer,
      language:String(body?.language||"auto"),
      model:"gpt-5.6-luna",
      confidence:result.confidence,
      sources:result.source_context||[],
      suggested_actions:result.suggested_actions||[],
      change_flags:result.missing_information||[],
      professional_review_recommendation:result.professional_review_recommendation||null
    });

    return J({...result,context_type:contextType,model:"gpt-5.6-luna"});
  }catch(e:any){
    console.error(e);
    return J({error:"ASK_EEZICOMPLY_ERROR",message:String(e?.message||"Ask EeziComply is temporarily unavailable.")},500);
  }
});