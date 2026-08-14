"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  ExternalLink,
  FileSearch,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Search,
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

type Session = {
  id: number;
  query: string;
  sources: number;
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "research", label: "AI Research", icon: Sparkles },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
  { id: "history", label: "History", icon: Clock3 },
  { id: "collaborators", label: "Collaborators", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Home() {
  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState(["Enterprise AI Research", "RAG Evaluation"]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invited, setInvited] = useState<string[]>([]);

  const runResearch = async () => {
    if (!query.trim() || running) return;

    setRunning(true);
    setActive("research");
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
      setSessions((current) => [
        { id: Date.now(), query: query.trim(), sources: data.sources?.length ?? 0 },
        ...current,
      ]);
    } catch (error) {
      console.error("Research error:", error);
      setMessage(error instanceof Error ? `Error: ${error.message}` : "Something went wrong while generating the research.");
    } finally {
      setRunning(false);
    }
  };

  const createProject = () => {
    if (!projectName.trim()) return;
    setProjects((current) => [projectName.trim(), ...current]);
    setProjectName("");
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).map((file) => file.name);
    setUploadedFiles((current) => [...files, ...current]);
  };

  const invite = () => {
    if (!inviteEmail.trim()) return;
    setInvited((current) => [...current, inviteEmail.trim()]);
    setInviteEmail("");
  };

  const startNewResearch = () => {
    setQuery("");
    setMessage("");
    setSources([]);
    setActive("research");
  };

  const renderResearch = () => (
    <>
      <div className="card research-card">
        <div className="cardhead">
          <div className="title-with-icon"><Sparkles size={18} /><div><h2>Start AI Research</h2><p>Retrieve evidence and generate a grounded research brief.</p></div></div>
          <span className="badge light">Web Retrieval + RAG</span>
        </div>

        <div className="searchbox">
          <Search size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runResearch()} placeholder="What would you like to research?" />
          <button className="primary" onClick={runResearch} disabled={running}>{running ? "Researching..." : "Research"}<ArrowRight size={15} /></button>
        </div>

        <div className="samples">
          {examples.map((example) => <button className="sample" key={example} onClick={() => setQuery(example)}>{example}</button>)}
        </div>

        {message && <div className="answer">{message}</div>}
      </div>

      {sources.length > 0 && (
        <div className="card section-card">
          <div className="cardhead"><div><h2>Retrieved Sources</h2><p>Evidence used to ground this response.</p></div><span className="count-pill">{sources.length} sources</span></div>
          <div className="source-list">
            {sources.map((source) => (
              <div className="source-item" key={source.id}>
                <div className="source-id">{source.id}</div>
                <div className="source-content"><strong>{source.title}</strong><span>{source.type} · {source.snippet}</span></div>
                <a href={source.url} target="_blank" rel="noreferrer" className="source-link">Open <ExternalLink size={13} /></a>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderDashboard = () => (
    <>
      <div className="stats">
        <div className="card stat"><div className="stat-icon"><Search size={18} /></div><div><small>Research sessions</small><strong>{24 + sessions.length}</strong><span>Total queries analyzed</span></div></div>
        <div className="card stat"><div className="stat-icon"><BookOpen size={18} /></div><div><small>Sources analyzed</small><strong>{sources.length || 8}</strong><span>Across current research</span></div></div>
        <div className="card stat"><div className="stat-icon"><Sparkles size={18} /></div><div><small>Grounding mode</small><strong>RAG</strong><span>Retrieval Augmented Generation</span></div></div>
      </div>
      {renderResearch()}
    </>
  );

  const renderProjects = () => (
    <div className="card section-card large-section">
      <div className="cardhead"><div><h2>Projects</h2><p>Organize research sessions into focused workspaces.</p></div></div>
      <div className="inline-form"><input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="New project name" /><button className="primary" onClick={createProject}><Plus size={15} />Create Project</button></div>
      <div className="project-grid">{projects.map((project) => <button className="project-card" key={project} onClick={() => { setQuery(project); setActive("research"); }}><FolderOpen size={20} /><strong>{project}</strong><span>Open research workspace <ArrowRight size={13} /></span></button>)}</div>
    </div>
  );

  const renderKnowledge = () => (
    <div className="card section-card large-section">
      <div className="cardhead"><div><h2>Knowledge Base</h2><p>Upload documents that can become part of the RAG pipeline.</p></div><label className="upload-button"><Upload size={15} />Upload documents<input type="file" multiple accept=".pdf,.txt,.md,.doc,.docx" onChange={handleUpload} /></label></div>
      <div className="knowledge-summary"><div><strong>48</strong><span>Research documents</span></div><div><strong>{uploadedFiles.length || 8}</strong><span>Retrieved sources</span></div><div><strong>26</strong><span>Indexed collections</span></div></div>
      <div className="file-list">{uploadedFiles.length ? uploadedFiles.map((file) => <div className="file-row" key={file}><BookOpen size={16} /><span>{file}</span><span className="status">Ready to index</span></div>) : <div className="empty"><BookOpen size={26} /><strong>No local documents uploaded yet</strong><span>Upload PDFs, text files or Markdown documents to expand the knowledge base.</span></div>}</div>
    </div>
  );

  const renderHistory = () => (
    <div className="card section-card large-section"><div className="cardhead"><div><h2>Research History</h2><p>Your research sessions from this browser.</p></div></div>{sessions.length === 0 ? <div className="empty"><Clock3 size={26} /><strong>No sessions yet</strong><span>Run your first research query and it will appear here.</span><button className="secondary" onClick={startNewResearch}>Start Research</button></div> : <div className="history-list">{sessions.map((session) => <button className="history-row" key={session.id} onClick={() => { setQuery(session.query); setActive("research"); }}><Clock3 size={16} /><div><strong>{session.query}</strong><span>{session.sources} sources · Open session</span></div><ArrowRight size={15} /></button>)}</div>}</div>
  );

  const renderCollaborators = () => (
    <div className="card section-card large-section"><div className="cardhead"><div><h2>Collaborators</h2><p>Invite people to work on research projects.</p></div></div><div className="inline-form"><input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" type="email" /><button className="primary" onClick={invite}><Users size={15} />Invite</button></div><div className="member-list"><div className="member"><div className="member-avatar">CD</div><div><strong>Carsyn D.</strong><span>Owner · Researcher</span></div><span className="status">Active</span></div>{invited.map((email) => <div className="member" key={email}><div className="member-avatar">{email[0].toUpperCase()}</div><div><strong>{email}</strong><span>Research collaborator</span></div><span className="status">Invited</span></div>)}</div></div>
  );

  const renderSettings = () => (
    <div className="card section-card large-section"><div className="cardhead"><div><h2>Settings</h2><p>Application preferences and research configuration.</p></div></div><div className="settings-list"><div className="setting"><div><strong>Research grounding</strong><span>Use retrieved sources before generating responses.</span></div><span className="toggle on">ON</span></div><div className="setting"><div><strong>Source citations</strong><span>Attach source IDs to factual claims.</span></div><span className="toggle on">ON</span></div><div className="setting"><div><strong>Workspace</strong><span>Research Command Center · v1.2</span></div><span className="setting-value">Local</span></div></div></div>
  );

  const title = navItems.find((item) => item.id === active)?.label ?? "Dashboard";

  return (
    <div className="page">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">RCC</div><div><strong>RCC</strong><span>Research Command Center</span></div></div>
        <nav className="nav">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><Icon size={17} />{label}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="system"><i />System Online</div><span>v1.2.0 · Built with Next.js</span></div>
      </aside>

      <main className="main">
        <header className="header"><div><div className="eyebrow">Workspace / {title}</div><h1>{active === "dashboard" ? "Research Command Center" : title}</h1><p className="subtitle">Turn complex questions into structured, source-backed research.</p></div><div className="avatar">CD</div></header>

        {active === "dashboard" && renderDashboard()}
        {active === "research" && renderResearch()}
        {active === "projects" && renderProjects()}
        {active === "knowledge" && renderKnowledge()}
        {active === "history" && renderHistory()}
        {active === "collaborators" && renderCollaborators()}
        {active === "settings" && renderSettings()}
      </main>
    </div>
  );
}
