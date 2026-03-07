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

  // Prevent background scroll when modal is open
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-white">{set.name}</h2>
            <p className="text-sm text-slate-400">Set #{set.set_number} · Facebook Marketplace Ad</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors ml-4 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Set image + stats */}
        <div className="flex gap-4 mb-5 p-4 bg-white/5 rounded-xl">
          <img
            src={set.image_url}
            alt={set.name}
            className="w-20 h-20 object-contain rounded-lg bg-white/10"
            onError={(e) => { e.target.src = "/placeholder.png"; }}
          />
          <div className="space-y-1 text-sm">
            <p className="text-slate-400">Paid: <span className="text-white font-bold">${set.cost.toFixed(2)} CAD</span></p>
            <p className="text-slate-400">Value: <span className="text-green-400 font-bold">${set.current_value.toFixed(2)} CAD</span></p>
            <p className="text-slate-400">Profit: <span className="text-green-300 font-bold">+${set.profit.toFixed(2)} CAD</span></p>
            <p className="text-slate-400">ROI: <span className="text-lego-yellow font-bold">{set.roi.toFixed(1)}%</span></p>
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
          <div className="text-center py-8 text-slate-500">
            <p className="text-4xl mb-2">🤖</p>
            <p className="font-semibold">No AI ad generated yet.</p>
            <p className="text-sm mt-1">This set needs ROI ≥ 40% and value ≥ $50 CAD to trigger the Gemini ad engine on the next sync.</p>
          </div>
        )}
      </div>
    </div>
  );
}
