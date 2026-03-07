import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";

const SIGNAL_COLORS = {
  "Strong Sell": "#22c55e",
  "Consider": "#eab308",
  "Hold": "#64748b",
  "No Data": "#ef4444",
};

const CAD = (v) => `$${v.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-lego-card border border-white/10 rounded-xl px-3 py-2 text-sm shadow-xl">
        <p className="font-bold text-white mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" && p.name?.includes("$") ? CAD(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ChartSection({ sets }) {
  // Pie: signal distribution
  const signalCounts = sets.reduce((acc, s) => {
    acc[s.signal] = (acc[s.signal] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(signalCounts).map(([name, value]) => ({ name, value }));

  // Bar: Cost vs Value per set (top 12 by profit)
  const barData = [...sets]
    .filter((s) => s.current_value > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 12)
    .map((s) => ({
      name: s.name.length > 16 ? s.name.slice(0, 14) + "…" : s.name,
      "Paid (CAD$)": s.cost,
      "Value (CAD$)": s.current_value,
    }));

  // Bar: Top 8 ROI
  const roiData = [...sets]
    .filter((s) => s.roi > 0)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 8)
    .map((s) => ({
      name: s.name.length > 16 ? s.name.slice(0, 14) + "…" : s.name,
      ROI: parseFloat(s.roi.toFixed(1)),
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
      {/* Pie: Signal breakdown */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Signal Breakdown</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={SIGNAL_COLORS[entry.name] || "#64748b"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#16213e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
              labelStyle={{ color: "#fff" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar: Cost vs Value */}
      <div className="card p-5 lg:col-span-2">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Cost vs Market Value (Top 12 by Profit)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ left: 10, right: 10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }} />
            <Bar dataKey="Paid (CAD$)" fill="#0f3460" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Value (CAD$)" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bar: ROI Leaders */}
      <div className="card p-5 lg:col-span-3">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">ROI Leaders (Top 8)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={roiData} layout="vertical" margin={{ left: 120, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, "dataMax + 20"]}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              width={110}
            />
            <Tooltip
              contentStyle={{ background: "#16213e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
              formatter={(v) => [`${v}%`, "ROI"]}
            />
            <Bar dataKey="ROI" radius={[0, 6, 6, 0]}>
              {roiData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.ROI >= 40 ? "#22c55e" : entry.ROI >= 20 ? "#eab308" : "#64748b"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
