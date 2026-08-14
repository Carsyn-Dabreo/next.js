import { NextRequest, NextResponse } from "next/server";

type Source = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  type: "Wikipedia" | "arXiv";
  score?: number;
};

const AI_TIMEOUT_MS = 25000;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "how", "in", "into", "is", "it", "of", "on", "or", "the", "to",
  "what", "which", "with", "why", "compare", "comparison", "explain",
  "best", "current", "latest", "using", "use", "about",
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getQueryTerms(query: string) {
  return normalize(query)
    .split(" ")
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
}

function scoreSource(source: Source, query: string) {
  const terms = getQueryTerms(query);
  const title = normalize(source.title);
  const snippet = normalize(source.snippet);
  const full = `${title} ${snippet}`;

  if (!terms.length) return 0;

  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (snippet.includes(term)) score += 2;
  }

  // Strongly reward the presence of the main technical acronym/phrase.
  const normalizedQuery = normalize(query);
  if (normalizedQuery.includes("rag") && full.includes("rag")) score += 14;
  if (normalizedQuery.includes("llm") && full.includes("llm")) score += 10;
  if (normalizedQuery.includes("retrieval") && full.includes("retrieval")) score += 8;

  // Academic papers are generally more useful for technical research.
  if (source.type === "arXiv") score += 3;

  // Penalize sources with no meaningful overlap at all.
  const matchedTerms = terms.filter((term) => full.includes(term)).length;
  if (matchedTerms === 0) score -= 20;

  return score;
}

function rankSources(sources: Source[], query: string) {
  const unique = new Map<string, Source>();

  for (const source of sources) {
    const key = source.url.toLowerCase();
    if (!unique.has(key)) unique.set(key, source);
  }

  return Array.from(unique.values())
    .map((source) => ({ ...source, score: scoreSource(source, query) }))
    .filter((source) => (source.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8)
    .map(({ score: _score, ...source }, index) => ({
      ...source,
      id: `S${index + 1}`,
    }));
}

async function retrieveSources(query: string): Promise<Source[]> {
  const sources: Source[] = [];

  const [wikiResult, arxivResult] = await Promise.allSettled([
    (async () => {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=6&origin=*`;
      const response = await fetch(wikiUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return [] as Source[];

      const data = await response.json();
      return (data?.query?.search ?? []).map(
        (item: { title: string; snippet?: string }) => ({
          id: "",
          title: item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
          snippet: String(item.snippet ?? "").replace(/<[^>]+>/g, ""),
          type: "Wikipedia" as const,
        })
      );
    })(),
    (async () => {
      const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=8&sortBy=relevance&sortOrder=descending`;
      const response = await fetch(arxivUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return [] as Source[];

      const xml = await response.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

      return entries
        .map((entry): Source | null => {
          const title = entry
            .match(/<title>([\s\S]*?)<\/title>/)?.[1]
            ?.replace(/\s+/g, " ")
            .trim();
          const summary = entry
            .match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
            ?.replace(/\s+/g, " ")
            .trim();
          const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();

          if (!title || !id) return null;

          return {
            id: "",
            title,
            url: id,
            snippet: summary ?? "",
            type: "arXiv",
          };
        })
        .filter(Boolean) as Source[];
    })(),
  ]);

  if (wikiResult.status === "fulfilled") sources.push(...wikiResult.value);
  if (arxivResult.status === "fulfilled") sources.push(...arxivResult.value);

  return rankSources(sources, query);
}

function buildFallbackAnswer(query: string, sources: Source[]) {
  if (!sources.length) {
    return `## Executive Summary\n\nI could not retrieve sufficiently relevant external sources for **${query}**.\n\n## Limitations\n\nNo source-backed answer can be generated until relevant evidence is available.`;
  }

  const findings = sources
    .map(
      (source) =>
        `- **${source.title}** — ${source.snippet.slice(0, 500)} [${source.id}]`
    )
    .join("\n");

  return `## Executive Summary\n\nHere is a source-backed research brief for **${query}**. The AI synthesis service was unavailable or timed out, so this response uses the retrieved evidence directly rather than inventing unsupported claims.\n\n## Key Findings\n\n${findings}\n\n## Important Insights\n\n- The retrieved evidence provides a starting point for answering the research question.\n- Claims should be checked against the linked primary sources before academic or professional use.\n\n## Limitations\n\n- Automated synthesis was unavailable for this request.\n- Retrieval results may be incomplete.\n\n## Further Research\n\nReview the linked sources and run the query again to generate a full AI-synthesized report.`;
}

async function generateWithOpenRouter(apiKey: string, query: string, context: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Research Command Center",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        temperature: 0.2,
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content:
              "You are a careful research assistant. Use ONLY the retrieved evidence supplied by the application. Do not invent studies, statistics, authors, dates, or citations. Cite claims with source IDs such as [S1]. If the evidence is insufficient, say so. Return concise Markdown with Executive Summary, Key Findings, Important Insights, Limitations, and Further Research.",
          },
          {
            role: "user",
            content: `Research question:\n${query}\n\nRetrieved evidence:\n${context}\n\nSynthesize the evidence into a useful research brief. Every factual claim that comes from a source should include its source ID.`,
          },
        ],
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `OpenRouter error (${response.status}): ${responseText.slice(0, 500)}`
      );
    }

    const data = JSON.parse(responseText);
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) throw new Error("The AI did not return a research response.");
    return answer as string;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENROUTER_API_KEY is missing. Add it to .env.local and restart the server.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const query = body.query;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "A research query is required." },
        { status: 400 }
      );
    }

    console.log("Retrieving and ranking sources for:", query);
    const sources = await retrieveSources(query);

    const context = sources.length
      ? sources
          .map(
            (source) =>
              `[${source.id}] ${source.title}\nURL: ${source.url}\nEvidence: ${source.snippet}`
          )
          .join("\n\n")
      : "No sufficiently relevant external sources were retrieved. Clearly state that limitation.";

    let answer: string;
    let usedFallback = false;

    try {
      answer = await generateWithOpenRouter(apiKey, query, context);
    } catch (error) {
      console.warn(
        "AI synthesis unavailable; returning retrieval fallback:",
        error
      );
      answer = buildFallbackAnswer(query, sources);
      usedFallback = true;
    }

    return NextResponse.json({
      success: true,
      query,
      answer,
      sources,
      sourceCount: sources.length,
      usedFallback,
    });
  } catch (error) {
    console.error("Research API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
