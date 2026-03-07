import { X } from "lucide-react";
import { SignalBadge } from "./Badges.jsx";

const SIGNAL_COLORS = {
  "Strong Sell": "border-green-500/40 bg-green-500/5",
  "Consider": "border-yellow-500/40 bg-yellow-500/5",
  "Hold": "border-slate-500/40 bg-slate-500/5",
  "No Data": "border-red-800/40 bg-red-900/5",
};

export function SignalListModal({ signal, sets, onClose }) {
  const filtered = sets.filter((s) => s.signal === signal);
  const borderClass = SIGNAL_COLORS[signal] || "border-white/10";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`card w-full max-w-2xl max-h-[85vh] flex flex-col border ${borderClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <SignalBadge signal={signal} />
            <span className="text-slate-400 text-sm">{filtered.length} sets</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No sets in this category.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-lego-card z-10">
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Theme</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <a
                        href={`https://www.bricklink.com/v2/catalog/catalogitem.page?S=${s.set_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 group/link"
                      >
                        <img
                          src={s.image_url}
                          alt={s.name}
                          className="w-10 h-10 object-contain rounded bg-white/10 flex-shrink-0"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                        <div>
                          <p className="font-bold text-white leading-tight group-hover/link:text-lego-yellow transition-colors">{s.name}</p>
                          <p className="text-xs text-slate-400">#{s.set_number}</p>
                        </div>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{s.theme}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {s.cost > 0 ? `$${s.cost.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.current_value > 0
                        ? <span className="text-green-400 font-bold">${s.current_value.toFixed(2)}</span>
                        : <span className="text-slate-500">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.roi !== 0
                        ? <span className={`font-black ${s.roi >= 40 ? "text-green-400" : s.roi >= 20 ? "text-yellow-400" : "text-slate-400"}`}>
                            {s.roi > 0 ? "+" : ""}{s.roi.toFixed(1)}%
                          </span>
                        : <span className="text-slate-500">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
