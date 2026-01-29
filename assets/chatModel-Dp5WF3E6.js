import{_ as p,a as f}from"./transformers.web-Bp_hl43Q.js";let c=null;const u="HuggingFaceTB/SmolLM-135M-Instruct";function g(a){const e=a.trim();return e?e.replace(/\/+$/,""):"./models"}async function b(a){if(c)return c;p.allowLocalModels=!a.allowRemoteModels,p.allowRemoteModels=a.allowRemoteModels,a.allowRemoteModels||(p.localModelPath=g(a.modelsBasePath)),console.log("[ChatModel] Loading SmolLM-135M-Instruct...");const e=performance.now();return c=await f("text-generation",u,{dtype:"fp32",progress_callback:t=>{t.progress!==void 0&&console.log(`[ChatModel] ${t.status}: ${Math.round(t.progress)}%`)}}),console.log(`[ChatModel] Model loaded in ${Math.round(performance.now()-e)}ms`),c}async function y(a,e){const t=`<|im_start|>system
You extract training search parameters from user queries.
IMPORTANT: The "topic" field should contain ONLY the subject matter (like "emergency response", "cholera", "infection prevention"), NOT filters like language, modality, or platform.
Extract: topic (subject only), language, modality (online/in-person/blended), platform, audience.
Respond with JSON only.
<|im_end|>
<|im_start|>user
Query: "${e}"
<|im_end|>
<|im_start|>assistant
{`;try{const r="{"+((await a(t,{max_new_tokens:150,temperature:.1,do_sample:!1,return_full_text:!1}))[0]?.generated_text||"").split("}")[0]+"}";try{const n=JSON.parse(r);return{topic:n.topic||e,language:n.language,modality:n.modality,platform:n.platform,audience:n.audience,rawQuery:e}}catch{return m(e)}}catch(o){return console.warn("[ChatModel] Intent extraction failed, using fallback:",o),m(e)}}function m(a){const e=a.toLowerCase();let t=a;const o={topic:a,rawQuery:a},r=["english","french","spanish","russian","arabic","portuguese","chinese","ukrainian","polish"];for(const n of r){const s=new RegExp(`\\b(in\\s+)?${n}\\b`,"gi");if(s.test(e)){o.language=n.charAt(0).toUpperCase()+n.slice(1),t=t.replace(s,"");break}}return/\bonline\b|e-learning|elearning/i.test(e)?(o.modality="online",t=t.replace(/\bonline\b|e-learning|elearning/gi,"")):/\bin[- ]person\b|face[- ]to[- ]face/i.test(e)?(o.modality="in_person",t=t.replace(/\bin[- ]person\b|face[- ]to[- ]face/gi,"")):/\bblended\b|hybrid/i.test(e)&&(o.modality="blended",t=t.replace(/\bblended\b|hybrid/gi,"")),/openwho/i.test(e)?(o.platform="OpenWHO",t=t.replace(/openwho/gi,"")):/who academy/i.test(e)?(o.platform="WHO Academy",t=t.replace(/who academy/gi,"")):/hslp/i.test(e)?(o.platform="HSLP",t=t.replace(/hslp/gi,"")):/goarn/i.test(e)&&(o.platform="GOARN",t=t.replace(/goarn/gi,"")),/member state|ministry|moh\b/i.test(e)?o.audience="Member":/who staff/i.test(e)&&(o.audience="WHO"),t=t.replace(/\b(i need|i want|i'm looking for|looking for|find me|show me|a training|training|about|on|for)\b/gi,"").replace(/\s+/g," ").trim(),o.topic=t||"health emergency",o}async function $(a,e,t,o){if(t.length===0)return d(e);const r=t.slice(0,3).map((l,i)=>`${i+1}. "${l.name}" (${l.platform||"Various"}, ${l.languages.join(", ")||"Multiple languages"})`).join(`
`),n=[];e.language&&n.push(`language: ${e.language}`),e.modality&&n.push(`modality: ${e.modality}`),e.platform&&n.push(`platform: ${e.platform}`);const s=`<|im_start|>system
You are a helpful training advisor. Summarize search results in 2-3 friendly sentences.
<|im_end|>
<|im_start|>user
User searched for: "${e.topic}"
${n.length?`Filters: ${n.join(", ")}`:""}
Found ${o} matching trainings. Top results:
${r}

Write a brief, helpful response:
<|im_end|>
<|im_start|>assistant
`;try{const i=((await a(s,{max_new_tokens:100,temperature:.7,do_sample:!0,return_full_text:!1}))[0]?.generated_text||"").trim();if(i&&i.length>20)return i}catch(l){console.warn("[ChatModel] Response generation failed:",l)}return h(e,t,o)}function d(a){const e=[];a.language&&e.push(`in ${a.language}`),a.modality&&e.push(a.modality.replace("_","-")),a.platform&&e.push(`on ${a.platform}`);const t=e.length?` ${e.join(", ")}`:"";return`I couldn't find any trainings matching "${a.topic}"${t}. Try broadening your search or removing some filters.`}function h(a,e,t){const o=[];a.language&&o.push(`in ${a.language}`),a.modality&&o.push(a.modality.replace("_","-")),a.platform&&o.push(`on ${a.platform}`);const r=o.length?` (${o.join(", ")})`:"",n=e[0]?.name||"relevant training";return`I found ${t} training(s) related to "${a.topic}"${r}. The top match is "${n}". ${t>1?"Check out the results below for more options.":""}`}export{y as extractIntent,$ as generateResponse,b as loadChatModel};
//# sourceMappingURL=chatModel-Dp5WF3E6.js.map
