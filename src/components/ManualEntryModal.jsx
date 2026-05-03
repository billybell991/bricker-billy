import { useState, useEffect, useRef } from "react";
import { X, Plus, Loader2 } from "lucide-react";

function normalizeSetId(raw) {
  const trimmed = raw.trim();
  return /-\d+$/.test(trimmed) ? trimmed : `${trimmed}-1`;
}

function bricklinkImageUrl(num) {
  return `https://img.bricklink.com/ItemImage/SN/0/${num}.png`;
}

export function ManualEntryModal({ onClose, onAdd }) {
  const [setNumber, setSetNumber] = useState("");
  const [cost, setCost] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [errors, setErrors] = useState({});
  const [imgSrc, setImgSrc] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const debounceRef = useRef(null);

  // Show a live image preview as the user types a set number
  useEffect(() => {
    const num = setNumber.trim().split("-")[0];
    if (!num || !/^\d{4,7}$/.test(num)) {
      setImgSrc(null);
      setImgLoaded(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setImgLoaded(false);
      setImgSrc(bricklinkImageUrl(num));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [setNumber]);

  const validate = () => {
    const e = {};
    if (!setNumber.trim()) e.setNumber = "Set number is required.";
    if (cost !== "" && (isNaN(parseFloat(cost)) || parseFloat(cost) < 0))
      e.cost = "Enter a valid amount (e.g. 49.99).";
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 99)
      e.quantity = "Quantity must be between 1 and 99.";
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const setId = normalizeSetId(setNumber);
    const numeric = setId.split("-")[0];
    const costVal = cost !== "" ? parseFloat(parseFloat(cost).toFixed(2)) : 0;
    const qty = parseInt(quantity, 10) || 1;

    const entry = {
      id: `manual_${Date.now()}`,
      set_id: setId,
      set_number: setNumber.trim(),
      name: `Set ${numeric}`,          // sync will replace with real name
      theme: "",                         // sync will replace with real theme
      cost: Math.round(costVal * 100) / 100,
      quantity: qty,
      current_value: 0,
      profit: 0,
      roi: 0,
      signal: "Pending Sync",
      qty_sold_6m: 0,
      bl_min_price: 0,
      bl_max_price: 0,
      selling_on: "",
      notes: "",
      image_url: imgLoaded ? `images/${numeric}.png` : bricklinkImageUrl(numeric),
      ad_copy: "",
      last_updated: new Date().toISOString(),
      isManual: true,
    };

    onAdd(entry);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-sm relative animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-black text-white">Add Set</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Name, theme &amp; prices are fetched automatically on the next sync.
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
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Image preview */}
          <div className="relative h-32 rounded-xl bg-lego-accent/20 flex items-center justify-center overflow-hidden">
            {imgSrc ? (
              <>
                {!imgLoaded && (
                  <Loader2 size={24} className="text-slate-500 animate-spin absolute" />
                )}
                <img
                  key={imgSrc}
                  src={imgSrc}
                  alt="Set preview"
                  className={`h-28 w-full object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={(e) => {
                    // BrickLink returns a 1×1 GIF for unknown sets — treat as no image
                    if (e.target.naturalWidth <= 1 || e.target.naturalHeight <= 1) {
                      setImgSrc(null);
                    } else {
                      setImgLoaded(true);
                    }
                  }}
                  onError={() => { setImgSrc(null); setImgLoaded(false); }}
                />
              </>
            ) : (
              <p className="text-slate-600 text-xs text-center px-4">
                {setNumber.trim() ? "No preview available" : "Enter a set number to see a preview"}
              </p>
            )}
          </div>

          {/* Set number */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Set Number <span className="text-lego-red">*</span>
            </label>
            <input
              type="text"
              value={setNumber}
              onChange={(e) => { setSetNumber(e.target.value); setErrors((ev) => ({ ...ev, setNumber: undefined })); }}
              placeholder="e.g. 10307 or 10307-1"
              className="w-full bg-lego-accent/30 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue placeholder-slate-600"
            />
            {errors.setNumber && <p className="text-xs text-red-400 mt-1">{errors.setNumber}</p>}
          </div>

          {/* Cost + Quantity side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Cost Paid (CAD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => { setCost(e.target.value); setErrors((ev) => ({ ...ev, cost: undefined })); }}
                placeholder="e.g. 259.99"
                className="w-full bg-lego-accent/30 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue placeholder-slate-600"
              />
              {errors.cost && <p className="text-xs text-red-400 mt-1">{errors.cost}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setErrors((ev) => ({ ...ev, quantity: undefined })); }}
                placeholder="1"
                className="w-full bg-lego-accent/30 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-lego-blue placeholder-slate-600"
              />
              {errors.quantity && <p className="text-xs text-red-400 mt-1">{errors.quantity}</p>}
            </div>
          </div>

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
