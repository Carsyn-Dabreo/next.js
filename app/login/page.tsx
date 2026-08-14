"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loginWithGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setError("Google sign-in is not configured yet. Add the Google OAuth keys to .env.local.");
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <a className="login-back" href="/"><ArrowLeft size={15} /> Back to Research Center</a>
        <div className="login-logo">R</div>
        <div className="eyebrow">Research Command Center</div>
        <h1>Welcome back</h1>
        <p>Sign in to keep your research workspace, projects and private Knowledge Base connected to your account.</p>
        <button className="google-button" onClick={loginWithGoogle} disabled={loading}>
          <span className="google-mark">G</span>
          {loading ? "Connecting..." : "Continue with Google"}
        </button>
        {error && <div className="login-error">{error}</div>}
        <div className="login-trust"><ShieldCheck size={14} /> OAuth handled by Google · Your password is never stored here.</div>
      </div>
    </main>
  );
}
