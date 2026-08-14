import { NextRequest, NextResponse } from "next/server";

type Source = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  type: "Wikipedia" | "arXiv" | "OpenAlex";
  score?: number;
};

const AI_TIMEOUT_MS = 25000;

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function queryTerms(query: string) {
  const stop = new Set(["the", "and", "for", "with", "what", "how", "why", "are", "is", "of", "to", "in", "on", "a", "an", "compare", "explain", "tell", "about"]);
  return [...new Set(normalize(query).split(" ").filter((word) => word.length > 2 && !stop.has(word)))];
}

function relevanceScore(query: string, source: Source) {
  const terms = queryTerms(query);
  const title = normalize(source.title);
  const text = normalize(`${source.title} ${source.snippet}`);
  if (!terms.length) return 0;

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 6;
    else if (text.includes(term)) score += 2;
  }

  if (source.type === "arXiv") score += 1;
  if (source.type === "OpenAlex") score += 0.5;
  if (source.type === "Wikipedia") score += 0.25;
  return score;
}

function rankSources(query: string, candidates: Source[]) {
  const seen = new Set<string>();
  return candidates
    .map((source) => ({ ...source, score: relevanceScore(query, source) }))
    .filter((source) => {
      const key = `${normalize(source.title)}|${source.url}`;
      if (seen.has(key) || (source.score ?? 0) < 2) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)
    .map((source, index) => ({ ...source, id: `S${index + 1}` }));
}

async function retrieveSources(query: string): Promise<Source[]> {
  const candidates: Source[] = [];
  const terms = queryTerms(query);
  const technical = /\b(ai|ml|machine learning|deep learning|llm|rag|nlp|computer vision|neural|transformer|reinforcement learning|data science|cybersecurity|software engineering|algorithm)\b/i.test(query);

  const jobs: Promise<Source[]>[] = [
    (async () => {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=8&origin=*`;
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) return [];
        const data = await response.json();
        return (data?.query?.search ?? []).map((item: { title: string; snippet?: string }) => ({
          id: "", title: item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
          snippet: String(item.snippet ?? "").replace(/<[^>]+>/g, ""), type: "Wikipedia" as const,
        }));
      } catch (error) { console.warn("Wikipedia retrieval failed:", error); return []; }
    })(),
    (async () => {
      try {
        const search = terms.length ? terms.join(" OR ") : query;
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(search)}&per-page=8&sort=relevance_score:desc`;
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) return [];
        const data = await response.json();
        return (data?.results ?? []).map((item: any) => ({
          id: "", title: item.display_name ?? "Untitled research work",
          url: item.doi || item.primary_location?.landing_page_url || item.id,
          snippet: item.abstract_inverted_index ? Object.keys(item.abstract_inverted_index).slice(0, 100).join(" ") : `${item.publication_year ?? ""} · Scholarly work · ${item.primary_location?.source?.display_name ?? "OpenAlex"}`,
          type: "OpenAlex" as const,
        }));
      } catch (error) { console.warn("OpenAlex retrieval failed:", error); return []; }
    })(),
  ];

  if (technical) {
    jobs.push((async () => {
      try {
        const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=8&sortBy=relevance&sortOrder=descending`;
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) return [];
        const xml = await response.text();
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
        return entries.map((entry) => {
          const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim();
          const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim();
          const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
          if (!title || !id) return null;
          return { id: "", title, url: id, snippet: summary ?? "", type: "arXiv" as const };
        }).filter(Boolean) as Source[];
      } catch (error) { console.warn("arXiv retrieval failed:", error); return []; }
    })());
  }

  const results = await Promise.allSettled(jobs);
  for (const result of results) if (result.status === "fulfilled") candidates.push(...result.value);
  return rankSources(query, candidates);
}

function buildFallbackAnswer(query: string, sources: Source[]) {
  if (!sources.length) return `## Executive Summary\n\nI could not retrieve external evidence for **${query}**. Try a more specific question.`;
  const findings = sources.slice(0, 6).map((source) => `- **${source.title}** — ${source.snippet.slice(0, 450)} [${source.id}]`).join("\n");
  return `## Executive Summary\n\nHere is a source-backed research brief for **${query}**. AI synthesis was unavailable, so the application is showing the strongest retrieved evidence directly.\n\n## Key Findings\n\n${findings}\n\n## Important Insights\n\n- Multiple independent sources can be compared to identify consistent findings.\n- OpenAlex provides cross-disciplinary scholarly literature; arXiv is added for technical/AI queries.\n\n## Limitations\n\n- Automated synthesis was unavailable for this request.\n- Retrieved evidence should be checked against the linked source before being used professionally.\n\n## Further Research\n\nOpen the highest-ranked sources and refine the query for a deeper report.`;
}

async function generateWithOpenRouter(apiKey: string, query: string, context: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "http://localhost:3000", "X-Title": "Research Command Center" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free", temperature: 0.2, max_tokens: 1800,
        messages: [
          { role: "system", content: "You are a careful general-purpose research assistant. Use ONLY the retrieved evidence supplied by the application. Do not invent studies, statistics, authors, dates, or citations. Cite factual claims with source IDs such as [S1]. If evidence is insufficient, say so. Return concise Markdown with Executive Summary, Key Findings, Important Insights, Limitations, and Further Research. Prefer primary or scholarly evidence when available." },
          { role: "user", content: `Research question:\n${query}\n\nRetrieved evidence:\n${context}\n\nSynthesize a useful research brief. Every factual claim that comes from a source should include its source ID.` },
        ],
      }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenRouter error (${response.status}): ${text.slice(0, 500)}`);
    const data = JSON.parse(text);
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) throw new Error("The AI did not return a research response.");
    return answer as string;
  } finally { clearTimeout(timeout); }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY is missing. Add it to .env.local and restart the server." }, { status: 500 });
    const body = await request.json();
    const query = body.query;
    if (!query || typeof query !== "string") return NextResponse.json({ error: "A research query is required." }, { status: 400 });

    console.log("Retrieving cross-domain sources for:", query);
    const sources = await retrieveSources(query);
    const context = sources.length ? sources.map((source) => `[${source.id}] ${source.title}\nSource type: ${source.type}\nURL: ${source.url}\nEvidence: ${source.snippet}`).join("\n\n") : "No external sources were retrieved. Clearly state that limitation.";

    let answer: string; let usedFallback = false;
    try { answer = await generateWithOpenRouter(apiKey, query, context); }
    catch (error) { console.warn("AI synthesis unavailable; using retrieval fallback:", error); answer = buildFallbackAnswer(query, sources); usedFallback = true; }

    return NextResponse.json({ success: true, query, answer, sources, sourceCount: sources.length, usedFallback, researchMode: "general-purpose" });
  } catch (error) {
    console.error("Research API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
