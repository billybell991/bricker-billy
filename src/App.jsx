import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Search, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import { SetCard } from "./components/SetCard.jsx";
import { AdModal } from "./components/AdModal.jsx";
import { ChartSection } from "./components/Charts.jsx";
import { SummaryBar } from "./components/SummaryBar.jsx";
import { SignalListModal } from "./components/SignalListModal.jsx";

const SIGNAL_ORDER = { "Strong Sell": 0, "Consider": 1, "Hold": 2, "No Data": 3 };

const SORT_OPTIONS = [
  { value: "signal", label: "Sell Signal" },
  { value: "roi_desc", label: "ROI (High → Low)" },
  { value: "profit_desc", label: "Profit $$ (High → Low)" },
  { value: "value_desc", label: "Market Value (High → Low)" },
  { value: "name_asc", label: "Name (A → Z)" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All Sets" },
  { value: "Strong Sell", label: "🔥 Strong Sell" },
  { value: "Consider", label: "👀 Consider" },
  { value: "Hold", label: "💤 Hold" },
  { value: "listed", label: "📦 Currently Listed" },
];

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [search, setSearch] = useState("");
  const [filterSignal, setFilterSignal] = useState("all");
  const [sortBy, setSortBy] = useState("signal");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [selectedSet, setSelectedSet] = useState(null); // for ad modal
  const [signalModalSignal, setSignalModalSignal] = useState(null); // for signal list modal
  const [listingOverrides, setListingOverrides] = useState({}); // local override for listing status

  // Load data.json
  useEffect(() => {
    fetch("./data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        // Pre-populate listing overrides from saved state (localStorage)
        try {
          const saved = JSON.parse(localStorage.getItem("listing_overrides") || "{}");
          setListingOverrides(saved);
        } catch (_) {}
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const handleListingChange = (setId, value) => {
    setListingOverrides((prev) => {
      const next = { ...prev, [setId]: value };
      try {
        localStorage.setItem("listing_overrides", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Merge listing overrides with data
  const sets = useMemo(() => {
    if (!data?.sets) return [];
    return data.sets.map((s) => ({
      ...s,
      selling_on: listingOverrides[s.id] !== undefined ? listingOverrides[s.id] : s.selling_on,
    }));
  }, [data, listingOverrides]);

  // Filter + sort
  const filteredSets = useMemo(() => {
    let result = sets;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.set_number.includes(q) ||
          s.theme.toLowerCase().includes(q)
      );
    }

    // Signal / listing filter
    if (filterSignal !== "all") {
      if (filterSignal === "listed") {
        result = result.filter((s) => s.selling_on && s.selling_on !== "");
      } else {
        result = result.filter((s) => s.signal === filterSignal);
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "signal":
          return (SIGNAL_ORDER[a.signal] ?? 99) - (SIGNAL_ORDER[b.signal] ?? 99);
        case "roi_desc":
          return b.roi - a.roi;
        case "profit_desc":
          return b.profit - a.profit;
        case "value_desc":
          return b.current_value - a.current_value;
        case "name_asc":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [sets, search, filterSignal, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🧱</div>
          <p className="text-slate-400 font-semibold animate-pulse">Loading your LEGO empire...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-black mb-2 text-red-400">Failed to Load Data</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <p className="text-slate-600 text-xs mt-2">Make sure public/data.json exists or the sync script has run.</p>
        </div>
      </div>
    );
  }

  const lastSynced = data?.last_synced
    ? new Date(data.last_synced).toLocaleString("en-CA", { timeZone: "America/Toronto" })
    : "Unknown";

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-lego-dark/90 backdrop-blur-md border-b border-white/10 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧱</span>
            <div>
              <h1 className="text-xl font-black text-white leading-none">Bricker Billy</h1>
              <p className="text-[10px] text-slate-500 tracking-wider uppercase">LEGO Investment Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw size={12} />
            <span>Last synced: {lastSynced}</span>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8">
        {/* ── Summary Stats ── */}
        <SummaryBar summary={data.summary} />

        {/* ── Charts ── */}
        <ChartSection sets={sets} onSliceClick={setSignalModalSignal} />

        {/* ── Sell Candidates Spotlight ── */}
        {sets.filter((s) => s.signal === "Strong Sell").length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔥</span>
              <h2 className="text-lg font-black text-white">Sell Now Candidates</h2>
              <span className="badge-strong-sell ml-1">
                {sets.filter((s) => s.signal === "Strong Sell").length} sets
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-xs uppercase tracking-wider border-b border-white/10">
                    <th className="pb-3 pr-4">Set</th>
                    <th className="pb-3 pr-4">Theme</th>
                    <th className="pb-3 pr-4 text-right">Paid</th>
                    <th className="pb-3 pr-4 text-right">Value</th>
                    <th className="pb-3 pr-4 text-right">Profit</th>
                    <th className="pb-3 pr-4 text-right">ROI</th>
                    <th className="pb-3 pr-4">Listed</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sets
                    .filter((s) => s.signal === "Strong Sell")
                    .sort((a, b) => b.roi - a.roi)
                    .map((s) => (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={s.image_url}
                              alt={s.name}
                              className="w-10 h-10 object-contain rounded bg-white/10"
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                            <div>
                              <p className="font-bold text-white text-sm">{s.name}</p>
                              <p className="text-xs text-slate-500">#{s.set_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-400">{s.theme}</td>
                        <td className="py-3 pr-4 text-right text-slate-300">${s.cost.toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-green-400 font-bold">${s.current_value.toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-green-300 font-bold">+${s.profit.toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-yellow-400 font-black">+{s.roi.toFixed(1)}%</td>
                        <td className="py-3 pr-4">
                          {s.selling_on ? (
                            <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                              {s.selling_on === "BL" ? "BrickLink" : s.selling_on === "FB" ? "Facebook" : s.selling_on}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">Not listed</span>
                          )}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedSet(s)}
                            className="text-xs bg-lego-red/10 hover:bg-lego-red/20 border border-lego-red/30 text-lego-red hover:text-red-300 px-3 py-1 rounded-lg transition-all font-bold"
                          >
                            Ad →
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Card Grid Controls ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h2 className="text-lg font-black text-white mr-2">All Sets</h2>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search name, set #, theme…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-lego-card border border-white/10 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue placeholder-slate-600"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-slate-500" />
            <select
              value={filterSignal}
              onChange={(e) => setFilterSignal(e.target.value)}
              className="bg-lego-card border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue cursor-pointer"
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-lego-card border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* View mode toggle */}
          <div className="flex items-center border border-white/10 rounded-xl overflow-hidden ml-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 transition-colors ${viewMode === "grid" ? "bg-lego-accent text-white" : "text-slate-500 hover:text-white"}`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 transition-colors ${viewMode === "list" ? "bg-lego-accent text-white" : "text-slate-500 hover:text-white"}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-slate-600 mb-4">
          Showing {filteredSets.length} of {sets.length} sets
        </p>

        {/* ── Grid ── */}
        {filteredSets.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-semibold">No sets match your filters.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredSets.map((s) => (
              <SetCard
                key={s.id}
                set={s}
                onAdClick={setSelectedSet}
                onListingChange={handleListingChange}
              />
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Theme</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                  <th className="px-4 py-3">Signal</th>
                  <th className="px-4 py-3">Listed</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSets.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={s.image_url}
                          alt={s.name}
                          className="w-10 h-10 object-contain rounded bg-white/10"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                        <div>
                          <p className="font-bold text-white">{s.name}</p>
                          <p className="text-xs text-slate-500">#{s.set_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.theme}</td>
                    <td className="px-4 py-3 text-right text-slate-300">${s.cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-bold">
                      {s.current_value > 0 ? `$${s.current_value.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-300">
                      {s.profit > 0 ? `+$${s.profit.toFixed(2)}` : `$${s.profit.toFixed(2)}`}
                    </td>
                    <td className={`px-4 py-3 text-right font-black ${s.roi >= 40 ? "text-green-400" : s.roi >= 20 ? "text-yellow-400" : "text-slate-400"}`}>
                      {s.roi > 0 ? `+${s.roi.toFixed(1)}%` : `${s.roi.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        s.signal === "Strong Sell" ? "bg-green-500/20 text-green-400 border-green-500/40" :
                        s.signal === "Consider" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" :
                        s.signal === "No Data" ? "bg-red-900/20 text-red-400 border-red-800/40" :
                        "bg-slate-500/20 text-slate-400 border-slate-500/40"
                      }`}>
                        {s.signal}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={s.selling_on || ""}
                        onChange={(e) => handleListingChange(s.id, e.target.value)}
                        className="bg-lego-accent/50 border border-white/10 text-white text-xs rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="">Not Listed</option>
                        <option value="BL">BrickLink</option>
                        <option value="FB">Facebook</option>
                        <option value="Both">Both</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedSet(s)}
                        className="text-xs bg-lego-red/10 hover:bg-lego-red/20 border border-lego-red/30 text-lego-red hover:text-red-300 px-3 py-1 rounded-lg transition-all font-bold whitespace-nowrap"
                      >
                        Ad →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="mt-16 mb-6 text-center text-xs text-slate-700">
          Bricker Billy · Data sourced from BrickLink · All values in CAD
        </footer>
      </main>

      {/* ── Ad Modal ── */}
      {selectedSet && (
        <AdModal set={selectedSet} onClose={() => setSelectedSet(null)} />
      )}

      {/* ── Signal List Modal ── */}
      {signalModalSignal && (
        <SignalListModal
          signal={signalModalSignal}
          sets={sets}
          onClose={() => setSignalModalSignal(null)}
        />
      )}
    </div>
  );
}
