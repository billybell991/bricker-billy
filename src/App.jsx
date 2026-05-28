import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, Search, SlidersHorizontal, LayoutGrid, List, Plus, Trash2, Github, LogOut } from "lucide-react";
import { SetCard } from "./components/SetCard.jsx";
import { AdModal } from "./components/AdModal.jsx";
import { ChartSection } from "./components/Charts.jsx";
import { SummaryBar } from "./components/SummaryBar.jsx";
import { SignalListModal } from "./components/SignalListModal.jsx";
import { HoverTrigger } from "./components/SetHoverCard.jsx";
import { ManualEntryModal } from "./components/ManualEntryModal.jsx";
import { GitHubTokenModal } from "./components/GitHubTokenModal.jsx";
import { SoldModal } from "./components/SoldModal.jsx";
import { SoldSetsModal } from "./components/SoldSetsModal.jsx";

const MANUAL_ENTRIES_KEY = "manual_entries";
const GH_TOKEN_KEY = "gh_access_token";

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

// ── GitHub persistence helpers ────────────────────────────────────────────────
const GH_OWNER = import.meta.env.VITE_REPO_OWNER;
const GH_REPO  = import.meta.env.VITE_REPO_NAME;
const MANUAL_SETS_FILE = "public/manual_sets.json";
const SOLD_SETS_FILE = "public/sold_sets.json";

async function fetchManualSetsFile(token) {
  if (!token || !GH_OWNER || !GH_REPO) return null;
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${MANUAL_SETS_FILE}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } }
    );
    if (resp.status === 401) return { unauthorized: true };
    if (resp.status === 404) return { sha: null, sets: [] };
    if (!resp.ok) return { sha: null, sets: [] };
    const file = await resp.json();
    const sets = JSON.parse(atob(file.content.replace(/\n/g, "")));
    return { sha: file.sha, sets };
  } catch {
    return null;
  }
}

async function fetchSoldSetsFile(token) {
  if (!token || !GH_OWNER || !GH_REPO) return null;
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${SOLD_SETS_FILE}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } }
    );
    if (resp.status === 401) return { unauthorized: true };
    if (resp.status === 404) return { sha: null, sets: [] };
    if (!resp.ok) return { sha: null, sets: [] };
    const file = await resp.json();
    const sets = JSON.parse(atob(file.content.replace(/\n/g, "")));
    return { sha: file.sha, sets };
  } catch {
    return null;
  }
}

function toBase64(str) {
  return btoa(new TextEncoder().encode(str).reduce((data, byte) => data + String.fromCharCode(byte), ""));
}

async function persistManualSetToGitHub(entry, token) {
  if (!token || !GH_OWNER || !GH_REPO) {
    return { pushed: false, error: "No GitHub token configured." };
  }
  const fileData = await fetchManualSetsFile(token);
  if (!fileData) {
    return { pushed: false, error: "Could not read manual_sets.json from GitHub." };
  }
  if (fileData.unauthorized) {
    return { pushed: false, unauthorized: true, error: "GitHub token expired or invalid. Please reconnect." };
  }
  const { sha, sets } = fileData;
  // Deduplicate by entry_id (unique per copy). Fall back to set_id for
  // old records that predate the entry_id field.
  const alreadyPresent = sets.some((s) =>
    s.entry_id ? s.entry_id === entry.id : s.set_id === entry.set_id
  );
  if (alreadyPresent) return { pushed: true, alreadyPresent: true };
  const record = {
    entry_id: entry.id,
    set_id: entry.set_id,
    set_number: entry.set_number,
    name: entry.name,
    theme: entry.theme,
    cost: entry.cost,
    unit_cost: entry.unit_cost ?? entry.cost,
    qty_owned: entry.qty_owned || 1,
    notes: entry.notes,
    selling_on: entry.selling_on || "",
  };
  sets.push(record);
  const content = toBase64(JSON.stringify(sets, null, 2) + "\n");
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${MANUAL_SETS_FILE}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `chore: add manual set ${entry.set_id}`,
          content,
          ...(sha ? { sha } : {}),
        }),
      }
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn("[GitHub] Push failed", resp.status, body);
      if (resp.status === 401) {
        return { pushed: false, unauthorized: true, error: "GitHub token expired or invalid. Please reconnect." };
      }
      return { pushed: false, error: `GitHub responded ${resp.status}` };
    }
    return { pushed: true };
  } catch (e) {
    console.warn("[GitHub] Failed to persist manual set:", e);
    return { pushed: false, error: e.message || String(e) };
  }
}

async function persistManualSetsToGitHub(entries, token) {
  if (!entries || entries.length === 0) return { pushed: true };
  if (!token || !GH_OWNER || !GH_REPO) {
    return { pushed: false, error: "No GitHub token configured." };
  }
  const fileData = await fetchManualSetsFile(token);
  if (!fileData) {
    return { pushed: false, error: "Could not read manual_sets.json from GitHub." };
  }
  if (fileData.unauthorized) {
    return { pushed: false, unauthorized: true, error: "GitHub token expired or invalid. Please reconnect." };
  }
  const { sha, sets } = fileData;
  let added = 0;
  for (const entry of entries) {
    // Dedupe only by entry_id (each copy has its own unique id). Multiple
    // copies of the same set_id are intentionally allowed.
    const alreadyPresent = sets.some((s) => s.entry_id && s.entry_id === entry.id);
    if (alreadyPresent) continue;
    sets.push({
      entry_id: entry.id,
      set_id: entry.set_id,
      set_number: entry.set_number,
      name: entry.name,
      theme: entry.theme,
      cost: entry.cost,
      unit_cost: entry.unit_cost ?? entry.cost,
      qty_owned: entry.qty_owned || 1,
      notes: entry.notes,
      selling_on: entry.selling_on || "",
    });
    added++;
  }
  if (added === 0) return { pushed: true, alreadyPresent: true };
  const content = toBase64(JSON.stringify(sets, null, 2) + "\n");
  const firstId = entries[0].set_id;
  const message =
    entries.length > 1
      ? `chore: add ${added} manual sets (${firstId}${added > 1 ? " +" + (added - 1) : ""})`
      : `chore: add manual set ${firstId}`;
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${MANUAL_SETS_FILE}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          content,
          ...(sha ? { sha } : {}),
        }),
      }
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn("[GitHub] Batch push failed", resp.status, body);
      if (resp.status === 401) {
        return { pushed: false, unauthorized: true, error: "GitHub token expired or invalid. Please reconnect." };
      }
      return { pushed: false, error: `GitHub responded ${resp.status}` };
    }
    return { pushed: true };
  } catch (e) {
    console.warn("[GitHub] Failed to persist manual sets:", e);
    return { pushed: false, error: e.message || String(e) };
  }
}

async function removeManualSetFromGitHub(entry, token) {
  if (!token || !GH_OWNER || !GH_REPO) return;
  const fileData = await fetchManualSetsFile(token);
  if (!fileData) return;
  const { sha, sets } = fileData;
  // Match by entry_id when present; fall back to set_id for old-format records.
  const updated = sets.filter((s) =>
    s.entry_id ? s.entry_id !== entry.id : s.set_id !== entry.set_id
  );
  if (updated.length === sets.length) return; // nothing to remove
  const content = toBase64(JSON.stringify(updated, null, 2) + "\n");
  try {
    await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${MANUAL_SETS_FILE}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `chore: remove manual set ${entry.set_id}`,
          content,
          ...(sha ? { sha } : {}),
        }),
      }
    );
  } catch (e) {
    console.warn("[GitHub] Failed to remove manual set:", e);
  }
}

async function persistSoldSetToGitHub(record, token) {
  if (!token || !GH_OWNER || !GH_REPO) {
    return { pushed: false, error: "No GitHub token configured." };
  }
  const fileData = await fetchSoldSetsFile(token);
  if (!fileData) {
    return { pushed: false, error: "Could not read sold_sets.json from GitHub." };
  }
  if (fileData.unauthorized) {
    return { pushed: false, unauthorized: true, error: "GitHub token expired or invalid. Please reconnect." };
  }
  const { sha, sets } = fileData;
  const alreadyPresent = sets.some((s) => (s.sale_id || `${s.id}::${s.sold_date}`) === (record.sale_id || `${record.id}::${record.sold_date}`));
  if (alreadyPresent) return { pushed: true, alreadyPresent: true };

  sets.push(record);
  const content = toBase64(JSON.stringify(sets, null, 2) + "\n");

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${SOLD_SETS_FILE}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `chore: add sold set ${record.set_id}`,
          content,
          ...(sha ? { sha } : {}),
        }),
      }
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn("[GitHub] Sold-set push failed", resp.status, body);
      if (resp.status === 401) {
        return { pushed: false, unauthorized: true, error: "GitHub token expired or invalid. Please reconnect." };
      }
      return { pushed: false, error: `GitHub responded ${resp.status}` };
    }
    return { pushed: true };
  } catch (e) {
    console.warn("[GitHub] Failed to persist sold set:", e);
    return { pushed: false, error: e.message || String(e) };
  }
}

async function removeSoldSetFromGitHub(record, token) {
  if (!token || !GH_OWNER || !GH_REPO) return;
  const fileData = await fetchSoldSetsFile(token);
  if (!fileData || fileData.unauthorized) return;
  const { sha, sets } = fileData;
  const targetKey = record.sale_id || `${record.id}::${record.sold_date}`;
  const updated = sets.filter((s) => (s.sale_id || `${s.id}::${s.sold_date}`) !== targetKey);
  if (updated.length === sets.length) return;

  const content = toBase64(JSON.stringify(updated, null, 2) + "\n");
  try {
    await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${SOLD_SETS_FILE}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `chore: remove sold set ${record.set_id}`,
          content,
          ...(sha ? { sha } : {}),
        }),
      }
    );
  } catch (e) {
    console.warn("[GitHub] Failed to remove sold set:", e);
  }
}

// ── Manual workflow trigger ───────────────────────────────────────────────────
const SYNC_WORKFLOW_FILE = "sync.yml";

// Dispatches the Daily LEGO Sync workflow and polls until it finishes.
// Returns { ok: true } on success, or { ok: false, error } / { unauthorized: true }.
// onStatus is called with short human-readable status strings for UI feedback.
async function triggerRemoteSync(token, onStatus = () => {}) {
  if (!token || !GH_OWNER || !GH_REPO) {
    return { ok: false, error: "No GitHub token configured." };
  }
  const api = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  // Record the time we kicked the dispatch so we can identify the new run.
  const dispatchedAt = Date.now();

  onStatus("Triggering sync…");
  try {
    const dispatch = await fetch(
      `${api}/actions/workflows/${SYNC_WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ref: "main" }),
      }
    );
    if (dispatch.status === 401) return { unauthorized: true, ok: false, error: "GitHub token expired or invalid." };
    if (dispatch.status === 404) {
      return { ok: false, error: "Sync workflow not found. Token may be missing 'workflow' scope." };
    }
    if (!dispatch.ok) {
      const body = await dispatch.text().catch(() => "");
      console.warn("[GitHub] workflow dispatch failed", dispatch.status, body);
      return { ok: false, error: `GitHub responded ${dispatch.status}` };
    }
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }

  // Poll for the run we just created. GitHub takes a few seconds to register it.
  const runsUrl = `${api}/actions/workflows/${SYNC_WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=5`;
  const start = Date.now();
  const MAX_WAIT_MS = 20 * 60 * 1000; // sync can take 10\u201315 min when BrickLink is slow
  const POLL_MS = 5000;
  let runId = null;

  while (Date.now() - start < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const resp = await fetch(runsUrl, { headers });
      if (resp.status === 401) return { unauthorized: true, ok: false, error: "GitHub token expired or invalid." };
      if (!resp.ok) continue;
      const json = await resp.json();
      const runs = json.workflow_runs || [];

      if (!runId) {
        // Find the first run created at-or-after our dispatch timestamp.
        const candidate = runs.find((r) => {
          const created = Date.parse(r.created_at);
          return Number.isFinite(created) && created >= dispatchedAt - 5000;
        });
        if (candidate) {
          runId = candidate.id;
          onStatus("Sync running…");
        } else {
          onStatus("Waiting for run to start…");
          continue;
        }
      }

      const current = runs.find((r) => r.id === runId);
      if (!current) continue;
      if (current.status === "completed") {
        if (current.conclusion === "success") return { ok: true };
        return { ok: false, error: `Sync ${current.conclusion || "failed"}.` };
      }
      onStatus(`Sync ${current.status}…`);
    } catch (e) {
      console.warn("[GitHub] poll failed", e);
    }
  }
  return { ok: false, error: "Sync did not complete in time.", stillRunning: true };
}
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("site_unlocked") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(""); // human-readable progress while syncing
  const [error, setError] = useState(null);

  // GitHub token — stored in localStorage, never baked into the bundle
  const [ghToken, setGhToken] = useState(() => localStorage.getItem(GH_TOKEN_KEY) || "");
  const [showTokenModal, setShowTokenModal] = useState(false);

  const handleGhConnect = (token) => {
    localStorage.setItem(GH_TOKEN_KEY, token);
    setGhToken(token);
    setShowTokenModal(false);
  };

  const handleGhDisconnect = () => {
    localStorage.removeItem(GH_TOKEN_KEY);
    setGhToken("");
  };

  // Sync button: if a GH token is connected, trigger the workflow run remotely
  // and wait for it to complete; otherwise just refetch the published data.json.
  const handleSyncClick = async () => {
    if (syncing) return;
    if (!ghToken) {
      // No token \u2014 fall back to a plain refetch of data.json.
      fetchData(true);
      return;
    }
    setSyncing(true);
    setSyncStatus("Triggering sync\u2026");
    try {
      const result = await triggerRemoteSync(ghToken, (msg) => setSyncStatus(msg));
      if (result?.unauthorized) {
        localStorage.removeItem(GH_TOKEN_KEY);
        setGhToken("");
        setShowTokenModal(true);
        setSyncStatus("");
        setError("GitHub token expired \u2014 please reconnect.");
        return;
      }
      if (!result?.ok) {
        if (result?.stillRunning) {
          // The workflow is still running on GitHub \u2014 don't surface as an error.
          setError(null);
          setSyncStatus("Sync still running on GitHub. Click Sync again later to refresh.");
          // Clear the status after a moment so it doesn't stick around forever.
          setTimeout(() => setSyncStatus(""), 8000);
        } else {
          setError(result?.error || "Sync failed.");
          setSyncStatus("");
        }
        return;
      }
      // Sync finished \u2014 give Pages a moment to redeploy data.json, then refetch.
      setSyncStatus("Fetching updated data\u2026");
      // Pages deploy of data.json typically takes ~30\u201360s after the sync commit.
      // Poll data.json's last_synced timestamp until it changes, up to ~90s.
      const previousLastSynced = data?.last_synced || "";
      const refreshStart = Date.now();
      const REFRESH_MAX_MS = 120 * 1000;
      while (Date.now() - refreshStart < REFRESH_MAX_MS) {
        try {
          const r = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
          if (r.ok) {
            const fresh = await r.json();
            if (fresh.last_synced && fresh.last_synced !== previousLastSynced) {
              setData(fresh);
              setError(null);
              break;
            }
          }
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 5000));
      }
      setSyncStatus("");
    } finally {
      setSyncing(false);
    }
  };

  // UI state
  const [search, setSearch] = useState("");
  const [filterSignal, setFilterSignal] = useState("all");
  const [sortBy, setSortBy] = useState("signal");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [selectedSet, setSelectedSet] = useState(null); // for ad modal
  const [signalModalSignal, setSignalModalSignal] = useState(null); // for signal list modal
  const [listingOverrides, setListingOverrides] = useState({}); // local override for listing status
  const [manualEntries, setManualEntries] = useState([]); // manually added sets
  const [showManualModal, setShowManualModal] = useState(false);
  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("deleted_ids") || "[]"));
    } catch (_) {
      return new Set();
    }
  });
  const [soldSets, setSoldSets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sold_sets") || "[]");
    } catch (_) {
      return [];
    }
  });
  const [sellTarget, setSellTarget] = useState(null); // set being logged as sold
  const [showSoldSets, setShowSoldSets] = useState(false);

  const fetchData = useCallback((isRefresh = false) => {
    if (isRefresh) setSyncing(true);
    // Cache-bust so we always get the latest data.json
    fetch(`./data.json?t=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (!isRefresh) {
          // Pre-populate listing overrides from saved state (localStorage)
          try {
            const saved = JSON.parse(localStorage.getItem("listing_overrides") || "{}");
            setListingOverrides(saved);
          } catch (_) {}

          // Load manual entries: prefer the deployed manual_sets.json (cross-device),
          // merged with any localStorage-only entries pending their next deploy.
          fetch(`./manual_sets.json?t=${Date.now()}`)
            .then((r) => r.ok ? r.json() : [])
            .then((githubSets) => {
              const entries = githubSets.map((s) => ({
                id: s.entry_id || `manual_${s.set_id}`,
                set_id: s.set_id,
                set_number: s.set_number,
                name: s.name,
                theme: s.theme || "",
                cost: s.cost || 0,
                unit_cost: s.unit_cost ?? s.cost ?? 0,
                qty_owned: s.qty_owned || 1,
                current_value: 0,
                profit: 0,
                roi: 0,
                signal: "No Data",
                qty_sold_6m: 0,
                bl_min_price: 0,
                bl_max_price: 0,
                selling_on: s.selling_on || "",
                notes: s.notes || "",
                image_url: `images/${s.set_id.split("-")[0]}.png`,
                ad_copy: "",
                last_updated: new Date().toISOString(),
                isManual: true,
              }));
              // Also include any localStorage entries not yet committed (e.g. added moments ago)
              const githubSetIds = new Set(githubSets.map((s) => s.set_id));
              let pendingLocal = [];
              try {
                const local = JSON.parse(localStorage.getItem(MANUAL_ENTRIES_KEY) || "[]");
                pendingLocal = local.filter((e) => !githubSetIds.has(e.set_id));
              } catch (_) {}
              const merged = [...entries, ...pendingLocal];
              setManualEntries(merged);
              try {
                localStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(merged));
              } catch (_) {}
            })
            .catch(() => {
              // Fall back to localStorage only
              try {
                const saved = JSON.parse(localStorage.getItem(MANUAL_ENTRIES_KEY) || "[]");
                setManualEntries(saved);
              } catch (e) { console.error("Failed to load manual entries:", e); }
            });
        }

        // Load sold entries from sold_sets.json and merge with local entries.
        // Local entries are kept so a just-logged sale appears immediately even
        // before the GitHub commit is deployed to Pages.
        fetch(`./sold_sets.json?t=${Date.now()}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((githubSold) => {
            const normalizedGithub = (githubSold || []).map((s) => ({
              ...s,
              sale_id: s.sale_id || `${s.id}::${s.sold_date}`,
            }));
            let local = [];
            try {
              local = JSON.parse(localStorage.getItem("sold_sets") || "[]");
            } catch (_) {}
            const seen = new Set(normalizedGithub.map((s) => s.sale_id || `${s.id}::${s.sold_date}`));
            const pendingLocal = local
              .map((s) => ({ ...s, sale_id: s.sale_id || `${s.id}::${s.sold_date}` }))
              .filter((s) => !seen.has(s.sale_id));
            const merged = [...normalizedGithub, ...pendingLocal];
            setSoldSets(merged);
            try { localStorage.setItem("sold_sets", JSON.stringify(merged)); } catch (_) {}
          })
          .catch(() => {
            try {
              const saved = JSON.parse(localStorage.getItem("sold_sets") || "[]");
              setSoldSets(saved);
            } catch (_) {}
          });

        setError(null);
        setLoading(false);
        setSyncing(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
        setSyncing(false);
      });
  }, []);

  // Load data.json on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = (setId) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(setId);
      try {
        localStorage.setItem("deleted_ids", JSON.stringify([...next]));
      } catch (_) {}
      return next;
    });
  };

  const handleListingChange = (setId, value) => {
    setListingOverrides((prev) => {
      const next = { ...prev, [setId]: value };
      try {
        localStorage.setItem("listing_overrides", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const commitManualEntriesToState = (entries) => {
    setManualEntries((prev) => {
      const next = [...prev, ...entries];
      try {
        localStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(next));
      } catch (e) { console.error("Failed to save manual entries to localStorage:", e); }
      return next;
    });
  };

  const handleAddManualBatch = async (entries) => {
    const list = Array.isArray(entries) ? entries : [entries];
    if (list.length === 0) return { pushed: true };

    // If no token configured, save locally only (no network).
    if (!ghToken) {
      commitManualEntriesToState(list);
      return { pushed: false, error: "No GitHub token configured." };
    }

    // Single batched PUT — avoids GitHub Contents API CDN staleness 409s.
    const result = await persistManualSetsToGitHub(list, ghToken);
    if (result?.unauthorized) {
      localStorage.removeItem(GH_TOKEN_KEY);
      setGhToken("");
      setShowTokenModal(true);
      return result; // do not mutate local state on auth failure
    }
    if (result?.pushed) {
      commitManualEntriesToState(list);
    }
    return result;
  };

  const handleDeleteManual = (id) => {
    setManualEntries((prev) => {
      const removed = prev.find((e) => e.id === id);
      const next = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(next));
      } catch (e) { console.error("Failed to save manual entries to localStorage:", e); }
      if (removed) removeManualSetFromGitHub(removed, ghToken);
      return next;
    });
  };

  const handleMarkSold = async ({ soldFor, soldOn }) => {
    if (!sellTarget) return;
    const s = sellTarget;
    const record = {
      sale_id: `sale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      id: s.id,
      set_id: s.set_id,
      set_number: s.set_number,
      name: s.name,
      theme: s.theme,
      cost: s.cost,
      sold_for: soldFor,
      sold_on: soldOn,
      sold_date: new Date().toISOString(),
    };
    setSoldSets((prev) => {
      const next = [...prev, record];
      try { localStorage.setItem("sold_sets", JSON.stringify(next)); } catch (_) {}
      return next;
    });
    // Always persist to deletedIds so the set stays gone after page reload
    handleDelete(s.id);
    if (s.isManual) handleDeleteManual(s.id);
    setSellTarget(null);

    if (ghToken) {
      const result = await persistSoldSetToGitHub(record, ghToken);
      if (result?.unauthorized) {
        localStorage.removeItem(GH_TOKEN_KEY);
        setGhToken("");
        setShowTokenModal(true);
        setError("GitHub token expired — please reconnect.");
      } else if (!result?.pushed) {
        setError(result?.error || "Failed to sync sold set to GitHub.");
      }
    }
  };

  const handleUnsell = async (record) => {
    // Remove from sold log
    setSoldSets((prev) => {
      // Remove only the specific sale entry (matched by id + sold_date)
      const next = prev.filter((s) => !(s.id === record.id && s.sold_date === record.sold_date));
      try { localStorage.setItem("sold_sets", JSON.stringify(next)); } catch (_) {}
      return next;
    });
    // Remove from deletedIds so it reappears on the dashboard
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(record.id);
      try { localStorage.setItem("deleted_ids", JSON.stringify([...next])); } catch (_) {}
      return next;
    });

    if (ghToken) {
      removeSoldSetFromGitHub(record, ghToken);
    }
  };

  const handlePurgeSold = async (record) => {
    // Permanently remove this sale entry from the sold log.
    // Keep the set in deletedIds so it does NOT return to the active dashboard.
    setSoldSets((prev) => {
      const next = prev.filter((s) => !(s.id === record.id && s.sold_date === record.sold_date));
      try { localStorage.setItem("sold_sets", JSON.stringify(next)); } catch (_) {}
      return next;
    });

    if (ghToken) {
      removeSoldSetFromGitHub(record, ghToken);
    }
  };

  const soldSetIds = useMemo(() => {
    return new Set(soldSets.map((s) => s.id));
  }, [soldSets]);

  // Merge listing overrides with data, then append manual entries that haven't
  // been picked up by the sync yet (avoid duplicates once the sync runs).
  const sets = useMemo(() => {
    if (!data?.sets) return [];
    const synced = data.sets
      .filter((s) => !deletedIds.has(s.id) && !soldSetIds.has(s.id))
      .map((s) => ({
        ...s,
        selling_on: listingOverrides[s.id] !== undefined ? listingOverrides[s.id] : s.selling_on,
      }));
    const syncedSetIds = new Set(data.sets.map((s) => s.set_id));
    // Only show local-only manual entries that the sync hasn't processed yet
    const manual = manualEntries
      .filter((s) => !syncedSetIds.has(s.set_id) && !deletedIds.has(s.id) && !soldSetIds.has(s.id))
      .map((s) => ({
        ...s,
        selling_on: listingOverrides[s.id] !== undefined ? listingOverrides[s.id] : s.selling_on,
      }));

    // Expand any entry with qty_owned > 1 into individual cards so each
    // physical copy gets its own card (matching how the Google Sheet works).
    const expand = (s) => {
      if (!s.qty_owned || s.qty_owned <= 1) return [s];
      const unitCost = +(s.unit_cost ?? (s.cost / s.qty_owned)).toFixed(2);
      const unitValue = s.current_value > 0 ? +(s.current_value / s.qty_owned).toFixed(2) : 0;
      const unitProfit = +((unitValue || 0) - unitCost).toFixed(2);
      return Array.from({ length: s.qty_owned }, (_, i) => ({
        ...s,
        id: `${s.id}_copy${i}`,
        qty_owned: 1,
        cost: unitCost,
        unit_cost: unitCost,
        current_value: unitValue,
        profit: unitProfit,
      }));
    };

    // Filter again after expansion so individually-deleted virtual copies
    // (tracked in deletedIds by their virtual id) stay hidden.
    return [...synced, ...manual].flatMap(expand).filter((s) => !deletedIds.has(s.id) && !soldSetIds.has(s.id));
  }, [data, listingOverrides, manualEntries, deletedIds, soldSetIds]);

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

    // Sort — but always pin newly-added manual entries (no sync data yet) to the top
    // so they're visible immediately after adding instead of being buried.
    const isPending = (s) => s.isManual && (s.signal === "No Data" || !s.current_value);
    result = [...result].sort((a, b) => {
      const pa = isPending(a) ? 0 : 1;
      const pb = isPending(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <form 
          className="card p-8 max-w-sm w-full text-center space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput === "lego4life") {
              localStorage.setItem("site_unlocked", "true");
              setIsAuthenticated(true);
            } else {
              alert("Incorrect password");
              setPasswordInput("");
            }
          }}
        >
          <img src="./zombie-cap.jpg" alt="Locked" className="w-24 h-24 mx-auto object-contain rounded-full shadow-lg" />
          <div>
            <h2 className="text-xl font-black text-white mb-2">Restricted Access</h2>
            <p className="text-sm text-slate-400">Please enter the password to view the dashboard.</p>
          </div>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            className="w-full bg-lego-accent/30 border border-white/10 text-white text-lg tracking-[0.3em] text-center rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lego-blue placeholder-slate-500 placeholder:tracking-normal"
            placeholder="Password..."
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button type="submit" className="flex items-center justify-center gap-2 bg-lego-blue hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl w-full transition-colors">
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img src="./zombie-cap.jpg" alt="" className="w-20 h-20 object-contain mx-auto mb-4 animate-pulse" />
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
          <p className="text-slate-500 text-xs mt-2">Make sure public/data.json exists or the sync script has run.</p>
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
            <img src="./zombie-cap.jpg" alt="Bricker Billy" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-black text-white leading-none">Bricker Billy</h1>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase">LEGO Investment Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw size={12} />
              <span>
                {syncing && syncStatus ? syncStatus : `Last synced: ${lastSynced}`}
              </span>
            </div>
            <button
              onClick={handleSyncClick}
              disabled={syncing}
              className="flex items-center gap-1.5 bg-lego-card hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={ghToken ? "Trigger Daily LEGO Sync workflow and refresh" : "Re-fetch data.json"}
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing\u2026" : "Sync"}
            </button>

            {/* GitHub token connect / disconnect */}
            {ghToken ? (
              <button
                onClick={handleGhDisconnect}
                title="Disconnect GitHub — stops cross-device sync"
                className="flex items-center gap-1.5 bg-green-500/10 hover:bg-red-500/10 border border-green-500/30 hover:border-red-500/30 text-green-400 hover:text-red-400 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                <Github size={13} />
                <LogOut size={12} />
              </button>
            ) : (
              <button
                onClick={() => setShowTokenModal(true)}
                title="Connect GitHub to sync data across devices"
                className="flex items-center gap-1.5 bg-lego-card hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                <Github size={13} />
                Connect
              </button>
            )}
          </div>

          <button
            onClick={() => setShowSoldSets(true)}
            className="flex items-center gap-1.5 bg-lego-card hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
          >
            📦 Sold ({soldSets.length})
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 bg-lego-blue hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} />
            Add Set
          </button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8">
        {/* ── Summary Stats ── */}
        <SummaryBar summary={data.summary} onSignalClick={setSignalModalSignal} />

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
                  <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
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
                          <a
                            href={`https://www.bricklink.com/v2/catalog/catalogitem.page?S=${s.set_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 group/link"
                          >
                            <img
                              src={s.image_url}
                              alt={s.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-contain rounded bg-white/10"
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                            <HoverTrigger set={s}>
                              <div>
                                <p className="font-bold text-white text-sm group-hover/link:text-lego-yellow transition-colors">{s.name}</p>
                                <p className="text-xs text-slate-400">#{s.set_number}</p>
                              </div>
                            </HoverTrigger>
                          </a>
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
                            <span className="text-xs text-slate-500">Not listed</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedSet(s)}
                              className="text-xs bg-lego-red/10 hover:bg-lego-red/20 border border-lego-red/30 text-lego-red hover:text-red-300 px-3 py-1 rounded-lg transition-all font-bold"
                            >
                              Ad →
                            </button>
                            <button
                              onClick={() => setSellTarget(s)}
                              className="text-slate-600 hover:text-green-400 p-1 rounded-lg transition-colors"
                              title="Mark as sold"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
            <SlidersHorizontal size={14} className="text-slate-400" />
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
        <p className="text-xs text-slate-500 mb-4">
          Showing {filteredSets.length} of {sets.length} sets
        </p>

        {/* ── Grid ── */}
        {filteredSets.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
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
                onSell={setSellTarget}
              />
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
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
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 object-contain rounded bg-white/10"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                        <HoverTrigger set={s}>
                          <div>
                            <p className="font-bold text-white">{s.name}</p>
                            <p className="text-xs text-slate-400">#{s.set_number}</p>
                          </div>
                        </HoverTrigger>
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedSet(s)}
                          className="text-xs bg-lego-red/10 hover:bg-lego-red/20 border border-lego-red/30 text-lego-red hover:text-red-300 px-3 py-1 rounded-lg transition-all font-bold whitespace-nowrap"
                        >
                          Ad →
                        </button>
                        <button
                          onClick={() => setSellTarget(s)}
                          className="text-slate-600 hover:text-green-400 p-1 rounded-lg transition-colors"
                          title="Mark as sold"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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

      {/* ── Sold Modal ── */}
      {sellTarget && (
        <SoldModal
          set={sellTarget}
          onClose={() => setSellTarget(null)}
          onConfirm={handleMarkSold}
        />
      )}

      {/* ── Sold Sets Modal ── */}
      {showSoldSets && (
        <SoldSetsModal
          soldSets={soldSets}
          onClose={() => setShowSoldSets(false)}
          onRemove={handleUnsell}
          onPurge={handlePurgeSold}
        />
      )}

      {/* ── Manual Entry Modal ── */}
      {showManualModal && (
        <ManualEntryModal
          onClose={() => setShowManualModal(false)}
          onAdd={handleAddManualBatch}
          hasGhToken={Boolean(ghToken)}
          existingSets={sets}
        />
      )}

      {/* ── GitHub Token Modal ── */}
      {showTokenModal && (
        <GitHubTokenModal
          onClose={() => setShowTokenModal(false)}
          onConnect={handleGhConnect}
        />
      )}
    </div>
  );
}
