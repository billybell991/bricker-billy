import { useState } from "react";
import { X, DollarSign } from "lucide-react";

const PLATFORMS = ["BrickLink", "Facebook", "Kijiji", "eBay", "Other"];

export function SoldModal({ set, onClose, onConfirm }) {
  const [soldFor, setSoldFor] = useState("");
  const [soldOn, setSoldOn] = useState("BrickLink");

  const price = parseFloat(soldFor);
  const profit = soldFor && !isNaN(price) ? price - set.cost : null;
  const roi = profit !== null ? (profit / set.cost) * 100 : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!soldFor || isNaN(price) || price < 0) return;
    onConfirm({ soldFor: price, soldOn });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-sm flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Mark as Sold</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Set info */}
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-lego-yellow font-semibold uppercase tracking-widest mb-0.5">{set.theme}</p>
          <p className="font-black text-white leading-tight">{set.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">#{set.set_number} · Paid ${set.cost.toFixed(2)}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Sold for */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Sold For (CAD)</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={soldFor}
                onChange={(e) => setSoldFor(e.target.value)}
                className="w-full bg-lego-card border border-white/10 text-white text-sm rounded-xl pl-8 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue"
                autoFocus
              />
            </div>
          </div>

          {/* Sold on */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">Sold On</label>
            <select
              value={soldOn}
              onChange={(e) => setSoldOn(e.target.value)}
              className="w-full bg-lego-card border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue cursor-pointer"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Live profit preview */}
          {profit !== null && (
            <div className="bg-white/5 rounded-xl p-3 grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Actual Profit</p>
                <p className={`text-sm font-black ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Actual ROI</p>
                <p className={`text-sm font-black ${roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {roi >= 0 ? `+${roi.toFixed(1)}%` : `${roi.toFixed(1)}%`}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!soldFor || isNaN(price) || price < 0}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              Mark Sold ✓
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
