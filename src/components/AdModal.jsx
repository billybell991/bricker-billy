import { useState } from "react";
import { X, Copy, Check } from "lucide-react";

export function AdModal({ set, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(set.ad_copy || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
            {/* Blurred colour-fill backdrop using the set image */}
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
              onError={(e) => { e.target.style.display = "none"; }}
            />
            {/* Close button */}
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
            {set.ad_copy ? (
              <>
                <div className="bg-lego-accent/30 border border-white/10 rounded-xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap mb-4">
                  {set.ad_copy}
                </div>
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center justify-center gap-2 bg-lego-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p className="text-4xl mb-2">🤖</p>
                <p className="font-semibold">No AI ad generated yet.</p>
                <p className="text-sm mt-1">Re-run the sync script to generate ad copy for all sets.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
