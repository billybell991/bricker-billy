import { useState } from "react";
import { X, Plus } from "lucide-react";

const EMPTY_FORM = {
  name: "",
  set_number: "",
  theme: "",
  cost: "",
  notes: "",
};

function normalizeSetId(raw) {
  const trimmed = raw.trim();
  return /-\d+$/.test(trimmed) ? trimmed : `${trimmed}-1`;
}

function bricklinkImageUrl(setId) {
  const numeric = setId.split("-")[0];
  return `https://img.bricklink.com/ItemImage/SN/0/${numeric}.png`;
}

export function ManualEntryModal({ onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Set name is required.";
    if (!form.set_number.trim()) e.set_number = "Set number is required.";
    if (form.cost !== "" && isNaN(parseFloat(form.cost)))
      e.cost = "Cost must be a number.";
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const setId = normalizeSetId(form.set_number);
    const cost = form.cost !== "" ? parseFloat(parseFloat(form.cost).toFixed(2)) : 0;
    const entry = {
      id: `manual_${Date.now()}`,
      set_id: setId,
      set_number: form.set_number.trim(),
      name: form.name.trim(),
      theme: form.theme.trim(),
      cost: Math.round(cost * 100) / 100,
      current_value: 0,
      profit: 0,
      roi: 0,
      signal: "No Data",
      qty_sold_6m: 0,
      bl_min_price: 0,
      bl_max_price: 0,
      selling_on: "",
      notes: form.notes.trim(),
      image_url: bricklinkImageUrl(setId),
      ad_copy: "",
      last_updated: new Date().toISOString(),
      isManual: true,
    };

    onAdd(entry);
    onClose();
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md relative animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-black text-white">Add Set Manually</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              BrickLink prices sync automatically on the next daily run.
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
          {field("name", "Set Name *", "e.g. Eiffel Tower")}
          {field("set_number", "Set Number *", "e.g. 10307")}
          {field("theme", "Theme", "e.g. Icons")}
          {field("cost", "Cost Paid (CAD)", "e.g. 259.99", "number", { step: "0.01", min: "0" })}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Optional notes…"
              rows={2}
              className="w-full bg-lego-accent/30 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue placeholder-slate-600 resize-none"
            />
          </div>

          <p className="text-xs text-slate-500">
            BrickLink value and ROI will appear after the next scheduled sync
            (daily at 8 AM UTC). You can also trigger a manual sync from the
            GitHub Actions tab.
          </p>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 bg-lego-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors mt-1"
          >
            <Plus size={16} />
            Add Set
          </button>
        </form>
      </div>
    </div>
  );
}
