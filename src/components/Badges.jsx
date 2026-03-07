export function SignalBadge({ signal }) {
  const map = {
    "Strong Sell": "badge-strong-sell",
    "Consider": "badge-consider",
    "Hold": "badge-hold",
    "No Data": "badge-no-data",
  };
  const icons = {
    "Strong Sell": "🔥",
    "Consider": "👀",
    "Hold": "💤",
    "No Data": "❓",
  };
  const cls = map[signal] || "badge-hold";
  return (
    <span className={cls}>
      {icons[signal] || ""} {signal}
    </span>
  );
}

export function MarketplaceBadge({ value }) {
  if (!value) return null;
  const map = {
    BL: { label: "On BrickLink", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
    FB: { label: "On Facebook", color: "bg-blue-600/20 text-blue-200 border-blue-600/40" },
    Both: { label: "BL + FB", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  };
  const config = map[value];
  if (!config) return null;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${config.color}`}>
      {config.label}
    </span>
  );
}
