import { X, Undo2, Trash2 } from "lucide-react";

export function SoldSetsModal({ soldSets, onClose, onRemove, onPurge }) {
  const totalRevenue = soldSets.reduce((sum, s) => sum + s.sold_for, 0);
  const totalCost = soldSets.reduce((sum, s) => sum + s.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgRoi =
    soldSets.length > 0
      ? soldSets.reduce((sum, s) => sum + ((s.sold_for - s.cost) / s.cost) * 100, 0) / soldSets.length
      : 0;

  const sorted = [...soldSets].sort((a, b) => new Date(b.sold_date) - new Date(a.sold_date));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-4xl max-h-[85vh] flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Sold Sets</h2>
            <p className="text-xs text-slate-400">{soldSets.length} {soldSets.length === 1 ? "set" : "sets"} sold</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {soldSets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 text-slate-500">
            <div className="text-center">
              <div className="text-5xl mb-3">📦</div>
              <p className="font-semibold">No sold sets recorded yet.</p>
              <p className="text-xs mt-1">Use the trash icon on any set to log a sale.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Sets Sold", value: soldSets.length, display: String(soldSets.length), color: "text-white" },
                { label: "Total Revenue", display: `$${totalRevenue.toFixed(2)}`, color: "text-white" },
                { label: "Total Profit", display: totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`, color: totalProfit >= 0 ? "text-green-400" : "text-red-400" },
                { label: "Avg ROI", display: avgRoi >= 0 ? `+${avgRoi.toFixed(1)}%` : `${avgRoi.toFixed(1)}%`, color: avgRoi >= 40 ? "text-green-400" : avgRoi >= 20 ? "text-yellow-400" : "text-slate-300" },
              ].map(({ label, display, color }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className={`text-sm font-black ${color}`}>{display}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 -mx-1 px-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-lego-card">
                  <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
                    <th className="pb-3 pr-4">Set</th>
                    <th className="pb-3 pr-4">Theme</th>
                    <th className="pb-3 pr-4 text-right">Paid</th>
                    <th className="pb-3 pr-4 text-right">Sold For</th>
                    <th className="pb-3 pr-4 text-right">Profit</th>
                    <th className="pb-3 pr-4 text-right">ROI</th>
                    <th className="pb-3 pr-4">Platform</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => {
                    const profit = s.sold_for - s.cost;
                    const roi = (profit / s.cost) * 100;
                    return (
                      <tr key={`${s.id}_${s.sold_date}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-bold text-white">{s.name}</p>
                          <p className="text-xs text-slate-400">#{s.set_number}</p>
                        </td>
                        <td className="py-3 pr-4 text-slate-400 text-xs">{s.theme}</td>
                        <td className="py-3 pr-4 text-right text-slate-300">${s.cost.toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-white font-bold">${s.sold_for.toFixed(2)}</td>
                        <td className={`py-3 pr-4 text-right font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`}
                        </td>
                        <td className={`py-3 pr-4 text-right font-black ${roi >= 40 ? "text-green-400" : roi >= 20 ? "text-yellow-400" : roi >= 0 ? "text-slate-300" : "text-red-400"}`}>
                          {roi >= 0 ? `+${roi.toFixed(1)}%` : `${roi.toFixed(1)}%`}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                            {s.sold_on}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-400">
                          {new Date(s.sold_date).toLocaleDateString("en-CA")}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onRemove(s)}
                              className="text-slate-600 hover:text-yellow-400 hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/20 p-1.5 rounded-lg transition-all"
                              title="Restore to active sets"
                            >
                              <Undo2 size={13} />
                            </button>
                            {onPurge && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Permanently delete this sale of "${s.name}"? The set will stay removed from your dashboard.`)) {
                                    onPurge(s);
                                  }
                                }}
                                className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 p-1.5 rounded-lg transition-all"
                                title="Delete forever"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
