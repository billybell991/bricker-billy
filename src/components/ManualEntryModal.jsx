import { useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";

const EMPTY_FORM = {
  set_number: "",
  cost: "",
  qty: "1",
};

function normalizeSetId(raw) {
  const trimmed = raw.trim();
  return /-\d+$/.test(trimmed) ? trimmed : `${trimmed}-1`;
}

function bricklinkImageUrl(setId) {
  const numeric = setId.split("-")[0];
  return `https://img.bricklink.com/ItemImage/SN/0/${numeric}.png`;
}

export function ManualEntryModal({ onClose, onAdd, hasGhToken, existingSets = [] }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { kind: 'ok'|'warn'|'err', msg }
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.set_number.trim()) e.set_number = "Set number is required.";
    if (form.cost === "" || isNaN(parseFloat(form.cost)))
      e.cost = "Cost is required.";
    const qtyNum = parseInt(form.qty, 10);
    if (!Number.isFinite(qtyNum) || qtyNum < 1) e.qty = "Quantity must be ≥ 1.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const setId = normalizeSetId(form.set_number);
    const unitCost = parseFloat(parseFloat(form.cost).toFixed(2));
    const qty = parseInt(form.qty, 10) || 1;
    const baseTime = Date.now();

    // Build one entry per copy so each gets its own card (same as how the
    // Google-Sheet sync produces separate cards for duplicate set rows).
    const entries = Array.from({ length: qty }, (_, i) => ({
      id: `manual_${baseTime + i}`,
      set_id: setId,
      set_number: form.set_number.trim(),
      name: `Set ${form.set_number.trim()}`,
      theme: "",
      cost: unitCost,
      unit_cost: unitCost,
      qty_owned: 1,
      current_value: 0,
      profit: 0,
      roi: 0,
      signal: "No Data",
      qty_sold_6m: 0,
      bl_min_price: 0,
      bl_max_price: 0,
      selling_on: "",
      notes: "",
      image_url: bricklinkImageUrl(setId),
      ad_copy: "",
      last_updated: new Date().toISOString(),
      isManual: true,
    }));

    setSubmitting(true);
    setStatus(null);
    try {
      let lastResult = null;
      for (const entry of entries) {
        lastResult = await onAdd(entry);
      }
      const result = lastResult;
      if (result?.pushed) {
        setStatus({ kind: "ok", msg: qty > 1 ? `${qty} copies saved & pushed to GitHub.` : "Saved & pushed to GitHub. Sync will run in ~1 min." });
        setTimeout(() => onClose(), 1200);
      } else if (!hasGhToken) {
        setStatus({
          kind: "warn",
          msg: "Saved locally. Connect a GitHub token to sync BrickLink prices across devices.",
        });
        setTimeout(() => onClose(), 1800);
      } else {
        setStatus({
          kind: "err",
          msg: result?.error || "Saved locally, but GitHub push failed. Check token scopes.",
        });
      }
    } catch (err) {
      setStatus({ kind: "err", msg: err.message || "Failed to save." });
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, label, placeholder, type = "text", extraProps = {}) => (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }));
          setErrors((ev) => ({ ...ev, [key]: undefined }));
          if (key === "set_number") setConfirmedDuplicate(false);
        }}
        placeholder={placeholder}
        {...extraProps}
        className="w-full bg-lego-accent/30 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue placeholder-slate-600"
      />
      {errors[key] && (
        <p className="text-xs text-red-400 mt-1">{errors[key]}</p>
      )}
    </div>
  );

  const setIdPreview = form.set_number.trim() ? normalizeSetId(form.set_number) : null;
  const unitCostNum = parseFloat(form.cost);
  const qtyNum = parseInt(form.qty, 10) || 0;
  const totalPreview =
    Number.isFinite(unitCostNum) && qtyNum > 0 ? unitCostNum * qtyNum : null;

  // How many copies of this set are already on the dashboard
  const existingCount = setIdPreview
    ? existingSets.filter((s) => s.set_id === setIdPreview).length
    : 0;
  const isDuplicate = existingCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md relative animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-black text-white">Add Set</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Just the set number, what you paid, and how many. BrickLink + BrickEconomy data fills in on the next sync.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1.5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {field("set_number", "Set Number *", "e.g. 10307")}

          <div className="grid grid-cols-2 gap-3">
            {field("cost", "Cost Paid Each (CAD) *", "e.g. 259.99", "number", { step: "0.01", min: "0" })}
            {field("qty", "Quantity *", "1", "number", { step: "1", min: "1" })}
          </div>

          {/* Preview */}
          {setIdPreview && (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <img
                src={bricklinkImageUrl(setIdPreview)}
                alt=""
                referrerPolicy="no-referrer"
                className="w-14 h-14 object-contain bg-black/20 rounded-lg"
                onError={(e) => {
                  if (e.target.src.endsWith(".png")) {
                    e.target.src = e.target.src.replace(".png", ".jpg");
                  } else {
                    e.target.style.visibility = "hidden";
                  }
                }}
              />
              <div className="flex-1 min-w-0 text-xs">
                <p className="text-slate-300 font-semibold truncate">Set {setIdPreview}</p>
                {totalPreview !== null && (
                  <p className="text-slate-400 mt-0.5">
                    Total cost:{" "}
                    <span className="text-white font-bold">${totalPreview.toFixed(2)}</span>
                    {qtyNum > 1 && (
                      <span className="text-slate-500"> ({qtyNum} × ${unitCostNum.toFixed(2)})</span>
                    )}
                  </p>
                )}
                {isDuplicate && (
                  <p className="text-amber-400 font-bold mt-1">
                    ⚠️ You already have {existingCount} of this set
                  </p>
                )}
              </div>
            </div>
          )}

          {isDuplicate && !confirmedDuplicate && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-xs text-amber-300">
                You already own {existingCount} cop{existingCount === 1 ? "y" : "ies"} of this set. Add {qtyNum > 1 ? `${qtyNum} more` : "another"}?
              </p>
              <button
                type="button"
                onClick={() => setConfirmedDuplicate(true)}
                className="ml-3 shrink-0 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                Yes, add
              </button>
            </div>
          )}

          {!hasGhToken && (
            <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
              No GitHub token connected — set will save locally only. Connect a token to sync across devices and pull BrickLink prices.
            </p>
          )}

          {status && (
            <p
              className={`text-xs rounded-lg p-2.5 border ${
                status.kind === "ok"
                  ? "text-green-300 bg-green-500/10 border-green-500/30"
                  : status.kind === "warn"
                  ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                  : "text-red-300 bg-red-500/10 border-red-500/30"
              }`}
            >
              {status.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || (isDuplicate && !confirmedDuplicate)}
            className="flex items-center justify-center gap-2 bg-lego-blue hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors mt-1"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus size={16} />
                Add Set
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
