import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { cosineSimilarity, embedTexts } from "../../../lib/embeddings";

type Source = { id: string; title: string; url: string; snippet: string; type: "Wikipedia" | "arXiv" | "OpenAlex" | "Knowledge Base"; score?: number };
type KBChunk = { id: string; documentId: string; documentName: string; text: string; embedding?: number[] };
type KBStore = { documents: unknown[]; chunks: KBChunk[] };
const AI_TIMEOUT_MS = 25000;
const DATA_FILE = path.join(process.cwd(), "data", "knowledge-base.json");

function normalize(text: string) { return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim(); }
function queryTerms(query: string) {
  const stop = new Set(["the","and","for","with","what","how","why","are","is","of","to","in","on","a","an","compare","comparison","explain","tell","about","according","document","uploaded","file","my","does","do","can","please","say","says","from","this","that","me","give","show","would","could","should","your","you","into","than","using","use","used","based","also","their","they","them","it","its","which"]);
  return [...new Set(normalize(query).split(" ").filter((word) => word.length > 2 && !stop.has(word)))];
}
function termVariants(term: string) { const variants = new Set([term]); if (term.endsWith("ing") && term.length > 5) variants.add(term.slice(0,-3)); if (term.endsWith("s") && term.length > 4) variants.add(term.slice(0,-1)); if (term.endsWith("ed") && term.length > 5) variants.add(term.slice(0,-2)); return [...variants]; }
function termMatches(text: string, term: string) { return termVariants(term).some((variant) => text.includes(variant)); }
function relevanceScore(query: string, source: Source) {
  const terms=queryTerms(query), title=normalize(source.title), text=normalize(`${source.title} ${source.snippet}`); if(!terms.length)return 0; let score=0,matched=0;
  for(const term of terms){if(title.includes(term)){score+=12;matched++;}else if(termMatches(text,term)){score+=4;matched++;}}
  if(text.includes(normalize(query)))score+=14; score+=(matched/terms.length)*12;
  if(source.type==="Knowledge Base")score+=35; if(source.type==="arXiv")score+=1.5; if(source.type==="OpenAlex")score+=1; return score;
}
function rankSources(query:string,candidates:Source[],hasStrongKB=false){
  const seen=new Set<string>(); const scored=candidates.map(s=>({...s,score:relevanceScore(query,s)})).filter(s=>{
    const key=`${normalize(s.title)}|${s.url}|${normalize(s.snippet).slice(0,160)}`; if(seen.has(key))return false; seen.add(key);
    const terms=queryTerms(query), text=normalize(`${s.title} ${s.snippet}`), matched=terms.filter(t=>termMatches(text,t)).length;
    if(s.type==="Knowledge Base")return matched>0||(s.score??0)>=1;
    if(hasStrongKB)return matched>=Math.min(2,terms.length)&&(matched/Math.max(terms.length,1))>=0.35;
    return matched>0&&(s.score??0)>=4;
  }).sort((a,b)=>(b.score??0)-(a.score??0));
  return [...scored.filter(s=>s.type==="Knowledge Base"),...scored.filter(s=>s.type!=="Knowledge Base")].slice(0,10).map((s,i)=>({...s,id:`S${i+1}`}));
}
async function readKB():Promise<KBStore>{try{return JSON.parse(await fs.readFile(DATA_FILE,"utf8")) as KBStore;}catch{return{documents:[],chunks:[]};}}
async function writeKB(store:KBStore){await fs.mkdir(path.dirname(DATA_FILE),{recursive:true});await fs.writeFile(DATA_FILE,JSON.stringify(store,null,2),"utf8");}
async function ensureEmbeddings(store:KBStore){
  const missing=store.chunks.filter(c=>!Array.isArray(c.embedding)||!c.embedding.length); if(!missing.length)return store;
  try{const vectors=await embedTexts(missing.map(c=>c.text));const byId=new Map(missing.map((c,i)=>[c.id,vectors[i]]));store.chunks=store.chunks.map(c=>byId.has(c.id)?{...c,embedding:byId.get(c.id)}:c);await writeKB(store);}catch(error){console.warn("Could not backfill semantic embeddings:",error);} return store;
}
async function retrieveKBChunks(query:string,chunks:KBChunk[]){
  if(!chunks.length)return []; let queryEmbedding:number[]|null=null; try{queryEmbedding=(await embedTexts([query]))[0]??null;}catch(error){console.warn("Semantic query embedding unavailable; using lexical retrieval:",error);}
  const terms=queryTerms(query);
  return chunks.map(chunk=>{const text=normalize(chunk.text),title=normalize(chunk.documentName);const lexical=terms.reduce((n,t)=>n+(termMatches(`${title} ${text}`,t)?1:0),0);const semantic=queryEmbedding&&chunk.embedding?cosineSimilarity(queryEmbedding,chunk.embedding):0;return{chunk,lexical,semantic,score:semantic*100+lexical*6};}).filter(x=>x.lexical>0||x.semantic>=0.25).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>({id:"",title:x.chunk.documentName,url:`/api/knowledge/file/${x.chunk.documentId}`,snippet:x.chunk.text,type:"Knowledge Base" as const,score:x.score}));
}
function reconstructOpenAlexAbstract(index:Record<string,number[]>|undefined){if(!index)return"";const words:string[]=[];for(const[word,positions]of Object.entries(index))for(const p of positions)words[p]=word;return words.filter(Boolean).join(" ").slice(0,1400);}
async function retrieveSources(query:string):Promise<Source[]>{
  const candidates:Source[]=[],terms=queryTerms(query),technical=/\b(ai|ml|machine learning|deep learning|llm|rag|nlp|computer vision|neural|transformer|reinforcement learning|data science|cybersecurity|software engineering|algorithm)\b/i.test(query);
  let kb=await readKB();kb=await ensureEmbeddings(kb);const kbSources=await retrieveKBChunks(query,kb.chunks);candidates.push(...kbSources);const hasStrongKB=kbSources.length>0&&(kbSources[0].score??0)>=35;
  const jobs:Promise<Source[]>[]=[
    (async()=>{try{const u=`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=8&origin=*`;const r=await fetch(u,{cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)return[];const d=await r.json();return(d?.query?.search??[]).map((x:any)=>({id:"",title:x.title,url:`https://en.wikipedia.org/wiki/${encodeURIComponent(x.title.replace(/ /g,"_"))}`,snippet:String(x.snippet??"").replace(/<[^>]+>/g,""),type:"Wikipedia" as const}));}catch{return[];}})(),
    (async()=>{try{const u=`https://api.openalex.org/works?search=${encodeURIComponent(terms.length?terms.join(" "):query)}&per-page=8&sort=relevance_score:desc`;const r=await fetch(u,{cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)return[];const d=await r.json();return(d?.results??[]).map((x:any)=>({id:"",title:x.display_name??"Untitled research work",url:x.doi||x.primary_location?.landing_page_url||x.id,snippet:reconstructOpenAlexAbstract(x.abstract_inverted_index)||`${x.publication_year??""} · Scholarly work · ${x.primary_location?.source?.display_name??"OpenAlex"}`,type:"OpenAlex" as const}));}catch{return[];}})()
  ];
  if(technical)jobs.push((async()=>{try{const q=terms.length?terms.map(t=>`all:${t}`).join(" AND "):`all:${query}`;const u=`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&start=0&max_results=8&sortBy=relevance&sortOrder=descending`;const r=await fetch(u,{cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)return[];const xml=await r.text(),entries=xml.match(/<entry>[\s\S]*?<\/entry>/g)??[];return entries.map(e=>{const title=e.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g," ").trim(),summary=e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g," ").trim(),id=e.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();return title&&id?{id:"",title,url:id,snippet:summary??"",type:"arXiv" as const}:null;}).filter(Boolean) as Source[];}catch{return[];}})());
  const results=await Promise.allSettled(jobs);for(const result of results)if(result.status==="fulfilled")candidates.push(...result.value);return rankSources(query,candidates,hasStrongKB);
}
function buildFallbackAnswer(query:string,sources:Source[]){if(!sources.length)return`## Executive Summary\n\nI could not retrieve relevant evidence for **${query}**.`;const findings=sources.slice(0,6).map(s=>`- **${s.title}** — ${s.snippet.slice(0,450)} [${s.id}]`).join("\n");return`## Executive Summary\n\nHere is a source-backed research brief for **${query}**.\n\n## Key Findings\n\n${findings}\n\n## Important Insights\n\n- Uploaded Knowledge Base evidence is semantically searched and prioritized when relevant.\n- Public sources are filtered for meaningful overlap.\n\n## Limitations\n\n- Verify important claims against the linked source.\n\n## Further Research\n\nOpen the highest-ranked sources and refine the query.`;}
async function generateWithOpenRouter(apiKey:string,query:string,context:string){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),AI_TIMEOUT_MS);try{const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`,"HTTP-Referer":"http://localhost:3000","X-Title":"Research Command Center"},signal:controller.signal,body:JSON.stringify({model:"openai/gpt-oss-20b:free",temperature:0.2,max_tokens:1800,messages:[{role:"system",content:"You are a careful general-purpose research assistant. Use ONLY the retrieved evidence supplied by the application. Do not invent studies, statistics, authors, dates, or citations. Cite factual claims with source IDs such as [S1]. If evidence is insufficient, say so. Return concise Markdown with Executive Summary, Key Findings, Important Insights, Limitations, and Further Research. When Knowledge Base evidence is present and directly answers the question, treat it as the primary source and explicitly say that the answer is based on the uploaded document."},{role:"user",content:`Research question:\n${query}\n\nRetrieved evidence:\n${context}\n\nSynthesize a useful research brief. Every factual claim that comes from a source should include its source ID.`}]})});const text=await r.text();if(!r.ok)throw new Error(`OpenRouter error (${r.status}): ${text.slice(0,500)}`);const data=JSON.parse(text),answer=data?.choices?.[0]?.message?.content;if(!answer)throw new Error("The AI did not return a research response.");return answer as string;}finally{clearTimeout(timeout);}}
export async function POST(request:NextRequest){try{const apiKey=process.env.OPENROUTER_API_KEY;if(!apiKey)return NextResponse.json({error:"OPENROUTER_API_KEY is missing. Add it to .env.local and restart the server."},{status:500});const body=await request.json(),query=body.query;if(!query||typeof query!=="string")return NextResponse.json({error:"A research query is required."},{status:400});const sources=await retrieveSources(query);const context=sources.length?sources.map(s=>`[${s.id}] ${s.title}\nSource type: ${s.type}\nURL: ${s.url||"Uploaded document"}\nEvidence: ${s.snippet}`).join("\n\n"):"No relevant sources were retrieved. Clearly state that limitation.";let answer:string,usedFallback=false;try{answer=await generateWithOpenRouter(apiKey,query,context);}catch(error){console.warn("AI synthesis unavailable; using retrieval fallback:",error);answer=buildFallbackAnswer(query,sources);usedFallback=true;}return NextResponse.json({success:true,query,answer,sources,sourceCount:sources.length,usedFallback,researchMode:"semantic-rag"});}catch(error){console.error("Research API error:",error);return NextResponse.json({error:error instanceof Error?error.message:"Unexpected server error."},{status:500});}}
