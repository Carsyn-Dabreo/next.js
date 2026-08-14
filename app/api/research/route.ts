import { NextRequest, NextResponse } from "next/server";

type Source = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  type: "Wikipedia" | "arXiv";
};

async function retrieveSources(query: string): Promise<Source[]> {
  const sources: Source[] = [];

  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=4&origin=*`;
    const wikiResponse = await fetch(wikiUrl, { cache: "no-store" });

    if (wikiResponse.ok) {
      const wikiData = await wikiResponse.json();
      for (const item of wikiData?.query?.search ?? []) {
        sources.push({
          id: `S${sources.length + 1}`,
          title: item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
          snippet: String(item.snippet ?? "").replace(/<[^>]+>/g, ""),
          type: "Wikipedia",
        });
      }
    }
  } catch (error) {
    console.error("Wikipedia retrieval failed:", error);
  }

  try {
    const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;
    const arxivResponse = await fetch(arxivUrl, { cache: "no-store" });

    if (arxivResponse.ok) {
      const xml = await arxivResponse.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

      for (const entry of entries) {
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim();
        const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim();
        const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();

        if (title && id) {
          sources.push({
            id: `S${sources.length + 1}`,
            title,
            url: id,
            snippet: summary ?? "",
            type: "arXiv",
          });
        }
      }
    }
  } catch (error) {
    console.error("arXiv retrieval failed:", error);
  }

  return sources.slice(0, 8);
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is missing. Add it to .env.local and restart the server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const query = body.query;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "A research query is required." }, { status: 400 });
    }

    console.log("Retrieving sources for:", query);
    const sources = await retrieveSources(query);

    const context = sources.length
      ? sources.map((source) => `[${source.id}] ${source.title}\nURL: ${source.url}\nEvidence: ${source.snippet}`).join("\n\n")
      : "No external sources were retrieved. Clearly state that limitation.";

    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Research Command Center",
      },
      body: JSON.stringify({
        model: "openrouter/free",
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

    const responseText = await openRouterResponse.text();

    if (!openRouterResponse.ok) {
      return NextResponse.json(
        { error: `OpenRouter error (${openRouterResponse.status}): ${responseText}` },
        { status: openRouterResponse.status }
      );
    }

    const data = JSON.parse(responseText);
    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      return NextResponse.json({ error: "The AI did not return a research response." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      query,
      answer,
      sources,
      sourceCount: sources.length,
    });
  } catch (error) {
    console.error("Research API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
