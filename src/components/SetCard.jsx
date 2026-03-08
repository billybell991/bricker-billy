import { useState } from "react";
import { Megaphone, TrendingUp } from "lucide-react";
import { SignalBadge, MarketplaceBadge } from "./Badges.jsx";
import { HoverTrigger } from "./SetHoverCard.jsx";

const LISTING_OPTIONS = ["", "BL", "FB", "Both"];

export function SetCard({ set, onAdClick, onListingChange }) {
  const [listing, setListing] = useState(set.selling_on || "");

  const handleListingChange = (e) => {
    const val = e.target.value;
    setListing(val);
    onListingChange(set.id, val);
  };

  const roiColor =
    set.roi >= 40
      ? "text-green-400"
      : set.roi >= 20
      ? "text-yellow-400"
      : "text-slate-400";

  const profitColor = set.profit > 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="card overflow-hidden flex flex-col group hover:border-white/20 hover:shadow-2xl transition-all duration-300">
      {/* Image banner */}
      <div className="relative bg-lego-accent/20 h-44 flex items-center justify-center overflow-hidden">
        {/* Blurred colour-fill backdrop using the set image */}
        <div
          className="absolute inset-0 scale-125 blur-2xl opacity-25"
          style={{
            backgroundImage: `url(${set.image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <img
          src={set.image_url}
          alt={set.name}
          referrerPolicy="no-referrer"
          className="relative h-40 w-full object-contain group-hover:scale-105 transition-transform duration-500 p-2 drop-shadow-lg z-10"
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentNode.innerHTML += `<div class="text-slate-500 text-sm text-center px-4">No image available</div>`;
          }}
        />
        {/* Signal badge top-right */}
        <div className="absolute top-3 right-3 z-20">
          <SignalBadge signal={set.signal} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Title */}
        <div>
          <p className="text-xs font-semibold text-lego-yellow uppercase tracking-widest mb-0.5">
            {set.theme}
          </p>
          <HoverTrigger set={set}>
            <a
              href={`https://www.bricklink.com/v2/catalog/catalogitem.page?S=${set.set_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-black text-base text-white leading-tight hover:text-lego-yellow transition-colors"
            >
              {set.name}
            </a>
            <p className="text-xs text-slate-400 mt-0.5">Set #{set.set_number}</p>
          </HoverTrigger>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Paid</p>
            <p className="text-sm font-bold text-slate-300">${set.cost.toFixed(2)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Value</p>
            <p className="text-sm font-bold text-green-300">
              {set.current_value > 0 ? `$${set.current_value.toFixed(2)}` : "—"}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Profit</p>
            <p className={`text-sm font-bold ${profitColor}`}>
              {set.profit > 0 ? `+$${set.profit.toFixed(2)}` : set.profit < 0 ? `-$${Math.abs(set.profit).toFixed(2)}` : "—"}
            </p>
          </div>
        </div>

        {/* ROI bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <TrendingUp size={11} /> ROI
            </span>
            <span className={`text-sm font-black ${roiColor}`}>
              {set.roi > 0 ? `+${set.roi.toFixed(1)}%` : `${set.roi.toFixed(1)}%`}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                set.roi >= 40 ? "bg-green-500" : set.roi >= 20 ? "bg-yellow-500" : "bg-slate-500"
              }`}
              style={{ width: `${Math.min(Math.max(set.roi, 0), 300) / 3}%` }}
            />
          </div>
        </div>

        {/* Qty sold note */}
        {set.qty_sold_6m > 0 && (
          <p className="text-xs text-slate-500">
            {set.qty_sold_6m} sold in last 6 months (BL)
          </p>
        )}

        {/* Marketplace tracker */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Listed On</label>
            <div className="flex items-center gap-2">
              <select
                value={listing}
                onChange={handleListingChange}
                className="bg-lego-accent/50 border border-white/10 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-lego-blue cursor-pointer"
              >
                <option value="">Not Listed</option>
                <option value="BL">BrickLink</option>
                <option value="FB">Facebook</option>
                <option value="Both">Both</option>
              </select>
              {listing && <MarketplaceBadge value={listing} />}
            </div>
          </div>

          {/* Ad button */}
          <button
            onClick={() => onAdClick(set)}
            className="flex items-center gap-1.5 bg-lego-red/10 hover:bg-lego-red/20 border border-lego-red/30 text-lego-red hover:text-red-300 text-xs font-bold px-3 py-2 rounded-xl transition-all"
          >
            <Megaphone size={13} />
            Ad
          </button>
        </div>
      </div>
    </div>
  );
}
