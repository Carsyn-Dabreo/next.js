"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Download, ExternalLink, FileSearch, FolderOpen, LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck, Sparkles, Target, Trash2, Upload } from "lucide-react";

const examples = ["Latest developments in electric vehicles", "Compare RAG architectures for enterprise AI", "History and impact of the internet", "Best practices for cybersecurity awareness"];
type Source = { id: string; title: string; url: string; snippet: string; type: "Wikipedia" | "arXiv" | "OpenAlex" | "Knowledge Base" };
type Session = { id: string; query: string; answer: string; sources: Source[]; createdAt: string };
type KBDoc = { id: string; name: string; type: string; size: number; createdAt: string; chunks: number };
const navItems = [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }, { id: "research", label: "Research", icon: Sparkles }, { id: "projects", label: "Projects", icon: FolderOpen }, { id: "knowledge", label: "Knowledge Base", icon: BookOpen }, { id: "history", label: "History", icon: Clock3 }, { id: "settings", label: "Settings", icon: Settings }];

function sourceLabel(type: Source["type"]) { return type === "Knowledge Base" ? "PRIVATE" : type.toUpperCase(); }

export default function Home() {
  const { data: session } = useSession();
  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [projectName, setProjectName] = useState("");
  const [grounding, setGrounding] = useState(true);
  const [citations, setCitations] = useState(true);
  const [kbDocs, setKbDocs] = useState<KBDoc[]>([]);
  const [kbChunks, setKbChunks] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const emailKey = session?.user?.email?.toLowerCase() || "guest";

  useEffect(() => { loadKnowledgeBase(); loadHistory(); }, []);
  useEffect(() => {
    if (!session?.user?.email) return;
    try { setProjects(JSON.parse(localStorage.getItem(`rcc_projects_${emailKey}`) || "[\"Enterprise AI Research\",\"RAG Evaluation\"]")); } catch {}
  }, [emailKey, session?.user?.email]);

  async function loadKnowledgeBase() { try { const r = await fetch("/api/knowledge", { cache: "no-store" }); const d = await r.json(); if (r.ok) { setKbDocs(d.documents ?? []); setKbChunks(d.chunkCount ?? 0); } } catch (e) { console.error(e); } }
  async function loadHistory() { try { const r = await fetch("/api/history", { cache: "no-store" }); const d = await r.json(); if (r.ok) setSessions(d.sessions ?? []); } catch (e) { console.error(e); } }

  const runResearch = async () => {
    if (!query.trim() || running) return;
    const cleanQuery = query.trim(); setRunning(true); setActive("research"); setMessage("Retrieving evidence and preparing your grounded research brief..."); setSources([]);
    try {
      const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: cleanQuery, grounding, citations }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || `Research request failed (${response.status})`);
      setMessage(data.answer || "No answer returned."); setSources(data.sources ?? []); await loadHistory();
    } catch (error) { console.error("Research error:", error); setMessage(error instanceof Error ? `Error: ${error.message}` : "Something went wrong."); }
    finally { setRunning(false); }
  };

  const createProject = () => { const value = projectName.trim(); if (!value) return; const next = [value, ...projects.filter((p) => p !== value)]; setProjects(next); localStorage.setItem(`rcc_projects_${emailKey}`, JSON.stringify(next)); setProjectName(""); };
  const deleteHistory = async (id: string) => { await fetch("/api/history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); await loadHistory(); };
  const openSession = (item: Session) => { setQuery(item.query); setMessage(item.answer); setSources(item.sources || []); setActive("research"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const startNewResearch = () => { setQuery(""); setMessage(""); setSources([]); setActive("research"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const exportPdf = () => {
    if (!message) return;
    const popup = window.open("", "_blank", "width=900,height=900"); if (!popup) return;
    popup.document.write(`<html><head><title>Research - ${query.replace(/</g, "&lt;")}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.65;color:#111}h1{font-size:28px}pre{white-space:pre-wrap;font:inherit}small{color:#666}</style></head><body><small>Research Command Center</small><h1>${query.replace(/</g,"&lt;")}</h1><pre>${message.replace(/</g,"&lt;")}</pre></body></html>`); popup.document.close(); popup.focus(); setTimeout(() => popup.print(), 300);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []); if (!files.length) return; setUploading(true); setUploadMessage("Extracting, normalizing and indexing documents...");
    for (const file of files) { const form = new FormData(); form.append("file", file); try { const r = await fetch("/api/knowledge", { method: "POST", body: form }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Upload failed"); setUploadMessage(d.message); } catch (e) { setUploadMessage(e instanceof Error ? `Error: ${e.message}` : "Upload failed."); } }
    await loadKnowledgeBase(); setUploading(false); event.target.value = "";
  };
  const deleteDocument = async (id: string) => { if (!confirm("Delete this document from the Knowledge Base?")) return; await fetch("/api/knowledge", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: id }) }); await loadKnowledgeBase(); };

  const title = navItems.find((item) => item.id === active)?.label ?? "Dashboard";
  const displayName = session?.user?.name || session?.user?.email?.split("@")[0] || "Researcher";
  const initials = displayName.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const sourceCount = sources.length;
  const avgConfidence = sourceCount ? Math.min(99, 72 + sourceCount * 3) : 0;

  const renderResearch = () => <>
    <div className="card research-card">
      <div className="cardhead"><div className="title-with-icon"><Sparkles size={18}/><div><h2>Start Research</h2><p>Search your private documents, web sources and academic literature.</p></div></div><span className="badge">{grounding ? "Web + Academic + Private RAG" : "Web + Academic"}</span></div>
      <div className="searchbox"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runResearch()} placeholder="Ask anything..."/><button className="primary" onClick={runResearch} disabled={running}>{running ? "Researching..." : "Research"}<Sparkles size={14}/></button></div>
      <div className="samples">{examples.map((example) => <button className="sample" key={example} onClick={() => setQuery(example)}>{example}</button>)}</div>
      <div className="research-controls"><span><ShieldCheck size={13}/>{grounding ? "Private + public grounding" : "Public sources only"}</span><button onClick={() => setGrounding(!grounding)}>{grounding ? "Disable private RAG" : "Enable private RAG"}</button><button onClick={() => setCitations(!citations)}>{citations ? "Citations ON" : "Citations OFF"}</button></div>
      {message && <div className="answer-wrap"><div className="answer" ref={answerRef}>{message}</div><div className="answer-actions"><button className="secondary" onClick={exportPdf}><Download size={14}/>Export / Print PDF</button><span>{running ? "Working..." : sourceCount ? `${sourceCount} evidence sources` : "No sources"}</span></div></div>}
    </div>
    {sources.length > 0 && <div className="card section-card"><div className="cardhead"><div><h2>Retrieved Sources</h2><p>Evidence used to ground this response.</p></div><span className="count-pill">{sources.length} sources</span></div><div className="source-list">{sources.map((source) => <div className="source-item" key={`${source.id}-${source.url}`}><div className="source-id">{source.id}</div><div className="source-content"><div className="source-title-row"><strong>{source.title}</strong><span className={`source-badge ${source.type === "Knowledge Base" ? "private" : ""}`}>{sourceLabel(source.type)}</span></div><span>{source.snippet}</span></div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="source-link">Open <ExternalLink size={13}/></a> : <span className="source-link">Private</span>}</div>)}</div></div>}
  </>;

  const renderPipeline = () => <div className="card side-card"><div className="cardhead"><h2>Research Pipeline</h2><span className="status">Ready</span></div>{[[FileSearch,"1. Query Analysis","Understand and structure the question"],[Search,"2. Source Retrieval","Private documents + Wikipedia + OpenAlex + arXiv"],[Sparkles,"3. RAG Synthesis","Ground the response in retrieved evidence"],[Target,"4. Citation Mapping","Attach source IDs to factual claims"]].map(([Icon,label,sub]) => { const I=Icon as any; return <div className="pipeline-step" key={String(label)}><div className="step-icon"><I size={14}/></div><div><strong>{label as string}</strong><span>{sub as string}</span></div><CheckCircle2 className="check" size={15}/></div>; })}<div className="progress"><i style={{width: running ? "65%" : "100%"}}/></div><div className="pipeline-footer"><span>{running ? "Research in progress" : "Pipeline ready"}</span><strong>{running ? "65%" : "100%"}</strong></div></div>;
  const renderKnowledgeMini = () => <div className="card side-card"><div className="cardhead"><div><h2>Knowledge Base</h2><p>Your private research library</p></div><Upload size={15}/></div><div className="knowledge-row"><span>Documents</span><strong>{kbDocs.length}</strong></div><div className="knowledge-row"><span>Searchable chunks</span><strong>{kbChunks}</strong></div><button className="side-link" onClick={() => setActive("knowledge")}>Manage Knowledge Base <ArrowRight size={13}/></button></div>;
  const renderDashboard = () => <><div className="stats"><div className="card stat"><div className="stat-icon"><Search size={18}/></div><div><small>Research Sessions</small><strong>{sessions.length}</strong><span>Saved to your account</span></div></div><div className="card stat"><div className="stat-icon"><BookOpen size={18}/></div><div><small>Sources Retrieved</small><strong>{sourceCount}</strong><span>Current research</span></div></div><div className="card stat"><div className="stat-icon"><ShieldCheck size={18}/></div><div><small>Knowledge Chunks</small><strong>{kbChunks}</strong><span>{avgConfidence ? `${avgConfidence}% evidence confidence` : "Searchable private evidence"}</span></div></div></div><div className="grid"><section>{renderResearch()}</section><aside className="side">{renderPipeline()}{renderKnowledgeMini()}</aside></div></>;
  const renderProjects = () => <div className="card section-card large-section"><div className="cardhead"><div><h2>Projects</h2><p>Create focused research workspaces. Projects are saved in this browser for your signed-in account.</p></div></div><div className="inline-form"><input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="New project name" onKeyDown={(e) => e.key === "Enter" && createProject()}/><button className="primary" onClick={createProject}><Plus size={15}/>Create Project</button></div><div className="project-grid">{projects.map((project) => <button className="project-card" key={project} onClick={() => { setQuery(project); setActive("research"); }}><FolderOpen size={20}/><strong>{project}</strong><span>Open research workspace <ArrowRight size={13}/></span></button>)}</div></div>;
  const renderKnowledge = () => <div className="card section-card large-section"><div className="cardhead"><div><h2>Knowledge Base</h2><p>Upload PDFs, TXT or Markdown. Documents are extracted, chunked and embedded for private RAG retrieval.</p></div><label className="upload-button"><Upload size={15}/>{uploading ? "Indexing..." : "Upload documents"}<input type="file" multiple accept=".pdf,.txt,.md" onChange={handleUpload} disabled={uploading}/></label></div><div className="knowledge-summary"><div><strong>{kbDocs.length}</strong><span>Documents</span></div><div><strong>{kbChunks}</strong><span>Searchable chunks</span></div><div><strong>Private</strong><span>Workspace evidence</span></div></div>{uploadMessage && <div className="upload-message">{uploadMessage}</div>}<div className="file-list">{kbDocs.length ? kbDocs.map((doc) => <div className="file-row" key={doc.id}><BookOpen size={16}/><div><strong>{doc.name}</strong><span>{doc.chunks} searchable chunks · {Math.max(1,Math.round(doc.size/1024))} KB</span></div><a className="secondary file-open" href={`/api/knowledge/file/${doc.id}`} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Open</a><span className="status">Indexed</span><button className="icon-button" onClick={() => deleteDocument(doc.id)} title="Delete"><Trash2 size={15}/></button></div>) : <div className="empty"><BookOpen size={26}/><strong>No documents indexed yet</strong><span>Upload your dummy PDF and then ask a question about its contents.</span></div>}</div></div>;
  const renderHistory = () => <div className="card section-card large-section"><div className="cardhead"><div><h2>Research History</h2><p>Saved research sessions associated with your Google account.</p></div><button className="secondary" onClick={startNewResearch}><Plus size={14}/>New Research</button></div>{sessions.length === 0 ? <div className="empty"><Clock3 size={26}/><strong>No sessions yet</strong><span>Run your first research query and it will appear here.</span></div> : <div className="history-list">{sessions.map((item) => <div className="history-row" key={item.id}><Clock3 size={16}/><button onClick={() => openSession(item)}><strong>{item.query}</strong><span>{item.sources?.length || 0} sources · {new Date(item.createdAt).toLocaleString()}</span></button><button className="icon-button" onClick={() => deleteHistory(item.id)} title="Delete"><Trash2 size={14}/></button></div>)}</div>}</div>;
  const renderSettings = () => <div className="card section-card large-section"><div className="cardhead"><div><h2>Settings</h2><p>Control how the research pipeline behaves.</p></div></div><div className="settings-list"><button className="setting" onClick={() => setGrounding(!grounding)}><div><strong>Private Knowledge Base grounding</strong><span>Include your uploaded documents in source retrieval.</span></div><span className="toggle on">{grounding ? "ON" : "OFF"}</span></button><button className="setting" onClick={() => setCitations(!citations)}><div><strong>Inline source citations</strong><span>Ask the synthesis model to attach [S1], [S2] evidence markers.</span></div><span className="toggle on">{citations ? "ON" : "OFF"}</span></button><div className="setting"><div><strong>Signed in as</strong><span>{session?.user?.email || "Google account"}</span></div><span className="setting-value">Google OAuth</span></div></div></div>;

  return <div className="page"><aside className="sidebar"><div className="brand"><div className="brand-mark">R</div><div><strong>Research Command</strong><span>Center</span></div></div><nav className="nav">{navItems.map(({id,label,icon:Icon}) => <button key={id} className={active===id?"active":""} onClick={() => setActive(id)}><Icon size={17}/>{label}</button>)}</nav><div className="sidebar-bottom"><div className="system"><i/>System Online</div><span>v1.6.0 · Built with Next.js</span></div></aside><main className="main"><header className="header"><div><div className="eyebrow">Workspace / {title}</div><h1>{active === "dashboard" ? "Research Command Center" : title}</h1><p className="subtitle">Research almost anything using retrieved evidence, academic literature and your private documents.</p></div><div className="profile-wrap"><button className="avatar" onClick={() => setProfileOpen(!profileOpen)}>{session?.user?.image ? <img src={session.user.image} alt="Profile"/> : initials}</button>{profileOpen && <div className="profile-menu"><div className="profile-head">{session?.user?.image ? <img src={session.user.image} alt=""/> : <div className="profile-avatar">{initials}</div>}<div><strong>{displayName}</strong><span>{session?.user?.email}</span></div></div><button onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={14}/>Sign out</button></div>}</div></header>{active === "dashboard" && renderDashboard()}{active === "research" && renderResearch()}{active === "projects" && renderProjects()}{active === "knowledge" && renderKnowledge()}{active === "history" && renderHistory()}{active === "settings" && renderSettings()}</main></div>;
}
