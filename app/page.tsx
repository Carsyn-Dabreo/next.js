"use client";

import { useState } from "react";
import {
  BookOpen,
  Clock3,
  ExternalLink,
  FileSearch,
  FolderOpen,
  LayoutDashboard,
  Settings,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

const examples = [
  "Impact of AI on healthcare",
  "Compare RAG architectures",
  "LLM evaluation methods",
];

type Source = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  type: "Wikipedia" | "arXiv";
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<Source[]>([]);

  const runResearch = async () => {
    if (!query.trim() || running) return;

    setRunning(true);
    setMessage("Retrieving sources and preparing grounded research...");
    setSources([]);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed (${response.status})`);
      }

      setMessage(data.answer);
      setSources(data.sources ?? []);
    } catch (error) {
      console.error("Research error:", error);
      setMessage(
        error instanceof Error
          ? `Error: ${error.message}`
          : "Something went wrong while generating the research."
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page">
      <aside className="sidebar">
        <div className="brand"><div className="logo">R</div><span>Research Center</span></div>
        <nav className="nav">
          <button className="active"><LayoutDashboard size={16} /> Dashboard</button>
          <button><Sparkles size={16} /> AI Research</button>
          <button><FolderOpen size={16} /> Projects</button>
          <button><BookOpen size={16} /> Knowledge Base</button>
          <button><Clock3 size={16} /> History</button>
          <button><Users size={16} /> Collaborators</button>
          <button><Settings size={16} /> Settings</button>
        </nav>
        <div className="bottom">AI Research Workspace<br /><span>v1.1 • Built with Next.js</span></div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <div className="eyebrow">Workspace / Overview</div>
            <h1>Research Command Center</h1>
            <p className="subtitle">Turn complex questions into structured, source-backed research.</p>
          </div>
          <div className="avatar">CD</div>
        </header>

        <div className="stats">
          <div className="card stat"><small>Research sessions</small><strong>24</strong></div>
          <div className="card stat"><small>Sources analyzed</small><strong>{sources.length || 186}</strong></div>
          <div className="card stat"><small>Grounding mode</small><strong>{sources.length ? "RAG" : "Ready"}</strong></div>
        </div>

        <div className="grid">
          <section>
            <div className="card research">
              <div className="cardhead">
                <h2><Sparkles size={16} style={{ verticalAlign: "-3px", marginRight: 7 }} />Start AI Research</h2>
                <span className="badge">Web Retrieval + RAG</span>
              </div>

              <div className="search">
                <FileSearch size={18} color="#667b96" style={{ margin: "11px 2px 0 7px" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runResearch(); }}
                  placeholder="What would you like to research?"
                />
                <button className="primary" onClick={runResearch} disabled={running}>
                  {running ? "Researching..." : "Research"}
                </button>
              </div>

              <div className="samples">
                {examples.map((example) => (
                  <button className="sample" key={example} onClick={() => setQuery(example)}>{example}</button>
                ))}
              </div>

              {message && (
                <div style={{ color: "#cbd7e8", fontSize: 12, margin: "18px 2px 0", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 600, overflowY: "auto" }}>
                  {message}
                </div>
              )}
            </div>

            {sources.length > 0 && (
              <div className="card sources" style={{ marginTop: 20 }}>
                <div className="cardhead">
                  <h2>Retrieved Sources</h2>
                  <span className="badge">{sources.length} sources</span>
                </div>
                {sources.map((source) => (
                  <div className="source" key={source.id}>
                    <b>{source.id} · {source.title}</b>
                    <span>{source.type} · {source.snippet}</span>
                    <div style={{ marginTop: 7 }}>
                      <a href={source.url} target="_blank" rel="noreferrer" style={{ color: "#79aefc", fontSize: 11, textDecoration: "none" }}>
                        Open source <ExternalLink size={11} style={{ verticalAlign: "-2px" }} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="card list" style={{ marginTop: 20 }}>
              <div className="cardhead"><h2>Recent research</h2><span style={{ fontSize: 11, color: "#637792" }}>View all</span></div>
              <div className="row"><div><h3>Retrieval-Augmented Generation in Enterprise AI</h3><p>Compared retrieval strategies, embedding models and evaluation approaches.</p></div><span className="tag">12 sources</span></div>
              <div className="row"><div><h3>Multimodal LLMs: Current Capabilities</h3><p>Structured synthesis of recent model capabilities and limitations.</p></div><span className="tag">9 sources</span></div>
              <div className="row"><div><h3>AI Agents for Software Engineering</h3><p>Reviewed agent architectures, tool use and software development workflows.</p></div><span className="tag">15 sources</span></div>
            </div>
          </section>

          <aside className="side">
            <div className="card sources">
              <div className="cardhead"><h2>Research pipeline</h2><span className="badge">Ready</span></div>
              <div className="source"><b>1. Query analysis</b><span>Understand the research question</span></div>
              <div className="source"><b>2. Source retrieval</b><span>Retrieve Wikipedia and arXiv evidence</span></div>
              <div className="source"><b>3. RAG synthesis</b><span>Ground the LLM response in retrieved context</span></div>
              <div className="source"><b>4. Citation mapping</b><span>Attach source IDs to factual claims</span></div>
              <div className="progress"><i /></div>
            </div>

            <div className="card activity">
              <div className="cardhead"><h2>Knowledge base</h2><Upload size={15} /></div>
              <p>📄 48 research documents</p>
              <p>🔗 {sources.length || 112} retrieved sources</p>
              <p>🧠 RAG-ready architecture</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
