const CAD = (v) =>
  `$${Number(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`;

export function SummaryBar({ summary, onSignalClick }) {
  const profitPct =
    summary.total_cost > 0
      ? (((summary.total_market_value - summary.total_cost) / summary.total_cost) * 100).toFixed(1)
      : 0;

  const stats = [
    { label: "Total Sets", value: summary.total_sets, sub: "in inventory", color: "text-white" },
    { label: "Total Cost", value: CAD(summary.total_cost), sub: "invested", color: "text-slate-300" },
    { label: "Market Value", value: CAD(summary.total_market_value), sub: `+${profitPct}% overall`, color: "text-green-400" },
    { label: "Unrealized Gains", value: CAD(summary.total_profit_potential), sub: "if sold at BL avg", color: "text-yellow-400" },
    { label: "🔥 Strong Sell", value: summary.strong_sell_count, sub: "sets ready to flip", color: "text-green-400", signal: "Strong Sell" },
    { label: "👀 Consider", value: summary.consider_count, sub: "sets worth watching", color: "text-yellow-400", signal: "Consider" },
    { label: "💤 Hold", value: summary.hold_count, sub: "sets to keep", color: "text-slate-400", signal: "Hold" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-10">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`card p-4 text-center ${
            s.signal ? "cursor-pointer hover:brightness-125 hover:scale-[1.03] transition-all" : ""
          }`}
          onClick={s.signal && onSignalClick ? () => onSignalClick(s.signal) : undefined}
        >
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
          <p className={`text-lg font-black ${s.color} leading-tight`}>{s.value}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
