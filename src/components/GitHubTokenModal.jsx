import { useState } from "react";
import { X, Github, Eye, EyeOff, ExternalLink, CheckCircle } from "lucide-react";

export function GitHubTokenModal({ onClose, onConnect }) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleConnect = async (e) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please paste your Personal Access Token.");
      return;
    }
    setVerifying(true);
    setError("");
    // Quick verify: call the GitHub user endpoint
    try {
      const resp = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${trimmed}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!resp.ok) {
        setError("Token invalid or lacks required permissions. Make sure it has repo (or contents:write) scope.");
        setVerifying(false);
        return;
      }
    } catch {
      setError("Could not verify token — check your internet connection.");
      setVerifying(false);
      return;
    }
    setVerifying(false);
    onConnect(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md relative animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Github size={18} className="text-white" />
            <h2 className="text-lg font-black text-white">Connect GitHub</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1.5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConnect} className="p-6 flex flex-col gap-5">
          <p className="text-sm text-slate-400">
            Connecting lets your manual sets and data sync across every device — no server needed.
            Your token is saved only in this browser&apos;s local storage and is never shared.
          </p>

          {/* Step-by-step */}
          <div className="bg-lego-accent/20 border border-white/10 rounded-xl p-4 flex flex-col gap-3 text-xs text-slate-300">
            <p className="font-bold text-white text-sm">How to get a token:</p>
            <ol className="list-decimal list-inside flex flex-col gap-2 ml-1">
              <li>
                Open{" "}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Bricker+Billy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lego-blue underline inline-flex items-center gap-0.5"
                >
                  GitHub → New classic token <ExternalLink size={10} />
                </a>
                {" "}(link pre-fills the right scopes)
              </li>
              <li>
                Set an expiration (90 days is fine), then click{" "}
                <span className="font-bold text-white">Generate token</span>
              </li>
              <li>Copy the token and paste it below</li>
            </ol>
            <p className="text-slate-500 mt-1">
              The <code className="bg-white/10 px-1 rounded">repo</code> scope saves sets across devices.
              Adding <code className="bg-white/10 px-1 rounded">workflow</code> lets new sets trigger an
              automatic sync so they get BrickLink prices right away.
            </p>
          </div>

          {/* Token input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Personal Access Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => { setToken(e.target.value); setError(""); }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-lego-accent/30 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-lego-blue placeholder-slate-600 font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={verifying}
            className="flex items-center justify-center gap-2 bg-lego-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            <CheckCircle size={16} />
            {verifying ? "Verifying…" : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
