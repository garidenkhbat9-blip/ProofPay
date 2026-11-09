// At most three sequential synthetic generations; stop at the first failure.
// Never sends project records, prints generated text, retries, or calls PayPal.
import { generateStructured, GeminiError, DEFAULT_GEMINI_MODEL } from "../src/lib/gemini";
import { agreementDraftPrompt, agreementDraftSchema, parseAgreementDraft } from "../src/lib/agreement-draft";
import { evidenceReviewPrompt, evidenceReviewSchema, parseEvidenceReview } from "../src/lib/evidence-review";
async function main() {
  const base = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, signal: new AbortController().signal };
  let stage = "minimal";
  let started = Date.now();
  try {
    await generateStructured({...base, system:"Return the requested JSON.", brief:"Set ok to true.", maxOutputTokens:1024, schema:{type:"object",properties:{ok:{type:"boolean"}},required:["ok"]}, parse:v=>{if(!v || typeof v!=="object" || !("ok" in v) || v.ok!==true)throw Error("shape");return true;}});
    console.log(JSON.stringify({stage,model:base.model,status:"VERIFIED",httpStatus:200,elapsedMs:Date.now()-started}));
    stage="agreement-contract"; started=Date.now();
    const project={title:"Synthetic text website",description:"Deliver a plain text homepage headline.",work_category:"website" as const,budget_amount:10,due_date:null};
    await generateStructured({...base,...agreementDraftPrompt(project,project.description),schema:agreementDraftSchema,parse:v=>parseAgreementDraft(v,project)});
    console.log(JSON.stringify({stage,model:base.model,status:"VERIFIED",httpStatus:200,elapsedMs:Date.now()-started}));
    stage="evidence-contract"; started=Date.now();
    const criteria=[{id:"criterion-synthetic",milestone_id:"milestone-synthetic",position:1,description:"The delivered headline text must say Welcome."}];
    const sources=[{id:"artifact-synthetic",label:"headline.txt",text:"Welcome"}];
    await generateStructured({...base,...evidenceReviewPrompt(project.description,criteria,sources),schema:evidenceReviewSchema,parse:v=>parseEvidenceReview(v,criteria,sources)});
    console.log(JSON.stringify({stage,model:base.model,status:"VERIFIED",httpStatus:200,elapsedMs:Date.now()-started}));
  } catch(error) {
    console.log(JSON.stringify({stage,status:"BLOCKED",model:base.model,elapsedMs:Date.now()-started,diagnostic:error instanceof GeminiError?error.diagnostic:{kind:"CONFIGURATION_OR_CONTRACT"}}));
    process.exitCode=1;
  }
}
void main();
