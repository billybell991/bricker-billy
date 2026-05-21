import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { SignalBadge } from "./Badges.jsx";

const CARD_WIDTH = 320;
const DELAY_MS = 500;

function HoverPopup({ set, x, y }) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let left = x + 18;
  let top = y - 24;

  // Flip left if near right edge
  if (left + CARD_WIDTH > viewportW - 16) {
    left = x - CARD_WIDTH - 18;
  }
  // Clamp vertically
  const CARD_HEIGHT = 380;
  if (top + CARD_HEIGHT > viewportH - 16) {
    top = viewportH - CARD_HEIGHT - 16;
  }
  if (top < 8) top = 8;

  const roiColor =
    set.roi >= 40 ? "text-green-400" : set.roi >= 20 ? "text-yellow-400" : "text-slate-400";
  const profitColor = set.profit > 0 ? "text-green-300" : "text-red-400";

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none animate-fade-in"
      style={{ left, top, width: CARD_WIDTH }}
    >
      <div className="card overflow-hidden shadow-2xl border border-white/25 backdrop-blur-sm">
        {/* Image hero */}
        <div className="relative h-44 overflow-hidden">
          <div
            className="absolute inset-0 scale-150 blur-2xl opacity-30"
            style={{
              backgroundImage: `url(${set.image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-lego-card" />
          <img
            src={set.image_url}
            alt={set.name}
            referrerPolicy="no-referrer"
            className="relative w-full h-full object-contain p-4 z-10 drop-shadow-2xl"
          />
        </div>

        {/* Content */}
        <div className="p-4 pt-3 space-y-3">
          {/* Title */}
          <div>
            <p className="text-[10px] font-bold text-lego-yellow uppercase tracking-widest">
              {set.theme} · #{set.set_number}
            </p>
            <p className="font-black text-white text-sm leading-snug mt-0.5">{set.name}</p>
          </div>

          {/* Signal */}
          <SignalBadge signal={set.signal} />

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">Paid</p>
              <p className="text-white font-bold">${set.cost.toFixed(2)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">BL Avg</p>
              <p className="text-green-400 font-bold">
                {set.current_value > 0 ? `$${set.current_value.toFixed(2)}` : "—"}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">Profit</p>
              <p className={`font-bold ${profitColor}`}>
                {set.profit > 0
                  ? `+$${set.profit.toFixed(2)}`
                  : set.profit < 0
                  ? `-$${Math.abs(set.profit).toFixed(2)}`
                  : "—"}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">ROI</p>
              <p className={`font-black ${roiColor}`}>
                {set.roi > 0 ? `+${set.roi.toFixed(1)}%` : `${set.roi.toFixed(1)}%`}
              </p>
            </div>
          </div>

          {/* BrickLink market data */}
          {set.current_value > 0 && (
            <div className="border-t border-white/10 pt-2.5 space-y-1.5 text-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                BrickLink Market (6 mo sold, New)
              </p>
              {set.qty_sold_6m > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Units sold</span>
                  <span className="text-white font-bold">{set.qty_sold_6m}</span>
                </div>
              )}
              {set.bl_min_price > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Price range</span>
                  <span className="text-white font-bold">
                    ${set.bl_min_price.toFixed(2)} – ${set.bl_max_price.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Avg sold</span>
                <span className="text-green-400 font-bold">${set.current_value.toFixed(2)} CAD</span>
              </div>
            </div>
          )}

          {/* Notes */}
          {set.notes && (
            <p className="text-[10px] text-slate-500 italic truncate border-t border-white/5 pt-2">
              {set.notes}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Wrap any element to get the hover card on mouseover.
 * Usage: <HoverTrigger set={s}><span>...</span></HoverTrigger>
 */
export function HoverTrigger({ set, children, className = "" }) {
  const [popup, setPopup] = useState(null);
  const timerRef = useRef(null);
  const posRef = useRef({ x: 0, y: 0 });

  const handleMouseEnter = useCallback((e) => {
    posRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = setTimeout(() => {
      setPopup({ x: posRef.current.x, y: posRef.current.y });
    }, DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setPopup(null);
  }, []);

  const handleMouseMove = useCallback((e) => {
    posRef.current = { x: e.clientX, y: e.clientY };
    // Update popup position live if already showing
    setPopup((prev) => (prev ? { x: e.clientX, y: e.clientY } : null));
  }, []);

  return (
    <span
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {children}
      {popup && <HoverPopup set={set} x={popup.x} y={popup.y} />}
    </span>
  );
}
