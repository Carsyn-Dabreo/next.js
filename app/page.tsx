'use client'

import { useState } from 'react'
import { BookOpen, Clock3, FileSearch, FolderOpen, LayoutDashboard, Settings, Sparkles, Upload, Users } from 'lucide-react'

const examples = ['Impact of AI on healthcare', 'Compare RAG architectures', 'LLM evaluation methods']

export default function Home() {
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  const runResearch = () => {
    if (!query.trim()) return
    setRunning(true)
    setMessage('Analyzing query and retrieving relevant sources…')
    setTimeout(() => {
      setRunning(false)
      setMessage(`Research workspace created for “${query.trim()}”.`)
    }, 900)
  }

  return (
    <div className="page">
      <aside className="sidebar">
        <div className="brand"><div className="logo">R</div><span>Research Center</span></div>
        <nav className="nav">
          <button className="active"><LayoutDashboard size={16}/> Dashboard</button>
          <button><Sparkles size={16}/> AI Research</button>
          <button><FolderOpen size={16}/> Projects</button>
          <button><BookOpen size={16}/> Knowledge Base</button>
          <button><Clock3 size={16}/> History</button>
          <button><Users size={16}/> Collaborators</button>
          <button><Settings size={16}/> Settings</button>
        </nav>
        <div className="bottom">AI Research Workspace<br/><span>v1.0 • Built with Next.js</span></div>
      </aside>

      <main className="main">
        <header className="header">
          <div><div className="eyebrow">Workspace / Overview</div><h1>Research Command Center</h1><p className="subtitle">Turn complex questions into structured, source-backed research.</p></div>
          <div className="avatar">CD</div>
        </header>

        <div className="stats">
          <div className="card stat"><small>Research sessions</small><strong>24</strong></div>
          <div className="card stat"><small>Sources analyzed</small><strong>186</strong></div>
          <div className="card stat"><small>Avg. confidence</small><strong>91%</strong></div>
        </div>

        <div className="grid">
          <section>
            <div className="card research">
              <div className="cardhead"><h2><Sparkles size={16} style={{verticalAlign:'-3px', marginRight:7}}/>Start AI Research</h2><span className="badge">LLM + RAG</span></div>
              <div className="search">
                <FileSearch size={18} color="#667b96" style={{margin:'11px 2px 0 7px'}}/>
                <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runResearch()} placeholder="What would you like to research?" />
                <button className="primary" onClick={runResearch}>{running ? 'Researching…' : 'Research'}</button>
              </div>
              <div className="samples">{examples.map(e=><button className="sample" key={e} onClick={()=>setQuery(e)}>{e}</button>)}</div>
              {message && <p style={{color:'#78aefa',fontSize:11,margin:'14px 2px 0'}}>{message}</p>}
            </div>

            <div className="card list">
              <div className="cardhead"><h2>Recent research</h2><span style={{fontSize:11,color:'#637792'}}>View all</span></div>
              <div className="row"><div><h3>Retrieval-Augmented Generation in Enterprise AI</h3><p>Compared retrieval strategies, embedding models and evaluation approaches.</p></div><span className="tag">12 sources</span></div>
              <div className="row"><div><h3>Multimodal LLMs: Current Capabilities</h3><p>Structured synthesis of recent model capabilities and limitations.</p></div><span className="tag">9 sources</span></div>
              <div className="row"><div><h3>AI Agents for Software Engineering</h3><p>Reviewed agent architectures, tool use and software development workflows.</p></div><span className="tag">15 sources</span></div>
            </div>
          </section>

          <aside className="side">
            <div className="card sources"><div className="cardhead"><h2>Research pipeline</h2><span className="badge">Ready</span></div>
              <div className="source"><b>1. Query analysis</b><span>Decompose research question</span></div>
              <div className="source"><b>2. Source retrieval</b><span>Search and rank evidence</span></div>
              <div className="source"><b>3. RAG synthesis</b><span>Ground LLM response in context</span></div>
              <div className="source"><b>4. Report generation</b><span>Summaries, findings & citations</span></div>
              <div className="progress"><i/></div>
            </div>
            <div className="card activity"><div className="cardhead"><h2>Knowledge base</h2><Upload size={15}/></div><p>📄 48 research documents</p><p>🔗 112 saved sources</p><p>🧠 26 indexed collections</p></div>
          </aside>
        </div>
      </main>
    </div>
  )
}
