"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loginWithGoogle = async () => {
    setLoading(true); setError("");
    try { await signIn("google", { callbackUrl: "/" }); }
    catch { setError("Google sign-in is not configured yet. Add the Google OAuth keys to .env.local."); setLoading(false); }
  };
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f6f6f4",fontFamily:"Inter,system-ui,sans-serif",padding:24}}>
    <div style={{width:"100%",maxWidth:430,background:"#fff",border:"1px solid #e5e5e2",borderRadius:24,padding:36,boxShadow:"0 20px 60px rgba(0,0,0,.08)"}}>
      <a href="/" style={{display:"inline-flex",alignItems:"center",gap:7,color:"#777",fontSize:13,textDecoration:"none",marginBottom:34}}><ArrowLeft size={15}/> Back to Research Center</a>
      <div style={{width:52,height:52,borderRadius:15,background:"#111",color:"#fff",display:"grid",placeItems:"center",fontWeight:800,fontSize:22,marginBottom:22}}>R</div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#888",marginBottom:9}}>Research Command Center</div>
      <h1 style={{fontSize:34,lineHeight:1.05,letterSpacing:"-.04em",margin:"0 0 12px",color:"#111"}}>Welcome back</h1>
      <p style={{fontSize:14,lineHeight:1.65,color:"#777",margin:"0 0 28px"}}>Sign in to keep your research workspace, projects and private Knowledge Base connected to your account.</p>
      <button onClick={loginWithGoogle} disabled={loading} style={{width:"100%",height:52,borderRadius:12,border:"1px solid #ddd",background:"#111",color:"#fff",fontWeight:650,fontSize:14,cursor:loading?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
        <span style={{width:25,height:25,borderRadius:7,background:"#fff",color:"#4285f4",display:"grid",placeItems:"center",fontWeight:800}}>G</span>{loading?"Connecting...":"Continue with Google"}
      </button>
      {error&&<div style={{marginTop:14,padding:12,borderRadius:10,background:"#fff2f2",color:"#a33",fontSize:12,lineHeight:1.5}}>{error}</div>}
      <div style={{marginTop:24,paddingTop:20,borderTop:"1px solid #eee",display:"flex",alignItems:"center",gap:7,color:"#888",fontSize:11}}><ShieldCheck size={14}/> OAuth handled by Google · No password stored here.</div>
    </div>
  </main>;
}
