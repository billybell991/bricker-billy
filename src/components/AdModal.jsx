import { useState } from "react";
import { X, Copy, Check, Sparkles, Key } from "lucide-react";

const GEMINI_KEY_STORAGE = "gemini_api_key";

async function callGemini(apiKey, set) {
  const prompt =
    `Act as a pro LEGO reseller. Write a Facebook Marketplace listing ad for the LEGO set. ` +
    `Make the very first line a title formatted exactly like this: "LEGO ${set.theme} - ${set.name} (${set.set_number})". ` +
    `Mention it is a rare collector's item currently valued at CAD $${set.current_value?.toFixed(2) ?? "?"}. ` +
    `Keep it enthusiastic, conversational, and under 200 words. ` +
    `Do NOT use any emojis. Do NOT include any hashtags. ` +
    `Do NOT include a price in the ad body — the price will be set separately on Marketplace.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

export function AdModal({ set, onClose }) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [adCopy, setAdCopy] = useState(set.ad_copy || "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || "");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(adCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) { setShowKeyInput(true); return; }
    setGenerating(true);
    setGenError(null);
    try {
      const text = await callGemini(apiKey.trim(), set);
      setAdCopy(text);
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveKey = () => {
    localStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim());
    setShowKeyInput(false);
    handleGenerate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Outer wrapper clips rounded corners; inner div scrolls */}
      <div className="card w-full max-w-lg relative animate-fade-in overflow-hidden">
        <div className="max-h-[90vh] overflow-y-auto">

          {/* Hero image banner */}
          <div className="relative h-56 overflow-hidden">
            {!imgError ? (
              <>
                {/* Blurred colour-fill backdrop */}
                <div
                  className="absolute inset-0 scale-125 blur-2xl opacity-40"
                  style={{
                    backgroundImage: `url(${set.image_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                {/* Bottom fade into card bg */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-lego-card" />
                {/* Sharp product image */}
                <img
                  src={set.image_url}
                  alt={set.name}
                  referrerPolicy="no-referrer"
                  className="relative w-full h-full object-contain p-6 drop-shadow-2xl z-10"
                  onError={() => setImgError(true)}
                />
              </>
            ) : (
              /* Fallback gradient banner when image is blocked */
              <div className="absolute inset-0 bg-gradient-to-br from-lego-blue/50 via-lego-accent/30 to-lego-yellow/20 flex flex-col items-center justify-center gap-1">
                <p className="text-8xl font-black text-white/10 leading-none select-none">{set.set_number}</p>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{set.theme}</p>
              </div>
            )}
            {/* Close button — always on top */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-20 text-white/80 hover:text-white bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6 pt-4">
            {/* Header */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-lego-yellow uppercase tracking-widest mb-0.5">
                Set #{set.set_number} · Facebook Marketplace Ad
              </p>
              <h2 className="text-xl font-black text-white">{set.name}</h2>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              <div className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Paid</p>
                <p className="text-sm font-bold text-slate-300">${set.cost.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Value</p>
                <p className="text-sm font-bold text-green-400">${set.current_value.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Profit</p>
                <p className="text-sm font-bold text-green-300">+${set.profit.toFixed(2)}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">ROI</p>
                <p className="text-sm font-bold text-lego-yellow">{set.roi.toFixed(1)}%</p>
              </div>
            </div>

            {/* Ad copy */}
            {showKeyInput ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                    <Key size={11} /> Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="AIza..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                    className="w-full bg-lego-card border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-lego-blue hover:underline">aistudio.google.com</a>. Saved in your browser only.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowKeyInput(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveKey}
                    disabled={!apiKey.trim()}
                    className="flex-1 bg-lego-blue hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Save &amp; Generate
                  </button>
                </div>
              </div>
            ) : adCopy ? (
              <>
                <div className="bg-lego-accent/30 border border-white/10 rounded-xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap mb-3">
                  {adCopy}
                </div>
                {genError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">
                    <p>{genError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={14} className={generating ? "animate-spin" : ""} />
                    {generating ? "Generating…" : "Regenerate"}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 bg-lego-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied!" : "Copy to Clipboard"}
                  </button>
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className="flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white p-3 rounded-xl transition-colors"
                    title="Change API Key"
                  >
                    <Key size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                {genError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">
                    <p>{genError}</p>
                    <button
                      onClick={() => setShowKeyInput(true)}
                      className="underline text-red-300 hover:text-white mt-1 transition-colors"
                    >
                      Update API key
                    </button>
                  </div>
                )}
                <p className="text-4xl mb-2">🤖</p>
                <p className="font-semibold text-slate-300 mb-1">No ad copy yet.</p>
                <p className="text-xs text-slate-500 mb-4">Generate one with Gemini AI instantly.</p>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 mx-auto bg-lego-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <Sparkles size={14} className={generating ? "animate-spin" : ""} />
                  {generating ? "Generating…" : "Generate with AI"}
                </button>
                {apiKey && (
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className="text-xs text-slate-600 hover:text-slate-400 mt-3 flex items-center gap-1 mx-auto transition-colors"
                  >
                    <Key size={10} /> Change API key
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
