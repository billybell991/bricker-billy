"""
sync_lego.py
------------
Pulls LEGO inventory from Google Sheets, fetches live BrickLink price data,
calculates ROI, generates AI ad copy for strong-sell candidates, and writes
data.json for the React dashboard.

Environment variables (set as GitHub Actions secrets):
  SPREADSHEET_ID              - Google Sheet ID from URL
  GOOGLE_SERVICE_ACCOUNT_JSON - Full JSON content of the service account key
  BL_CONSUMER_KEY             - BrickLink API consumer key
  BL_CONSUMER_SECRET          - BrickLink API consumer secret
  BL_TOKEN                    - BrickLink OAuth token
  BL_TOKEN_SECRET             - BrickLink OAuth token secret
  GEMINI_API_KEY              - Google AI Studio Gemini API key
"""

import json
import os
import re
import time
from datetime import datetime, timezone

import gspread
import google.generativeai as genai
import requests
from bs4 import BeautifulSoup
from google.oauth2.service_account import Credentials
from requests_oauthlib import OAuth1

# ── Constants ─────────────────────────────────────────────────────────────────
SHEET_TAB = "New Sets - Revised"
BL_CURRENCY = "CAD"
BL_CONDITION = "N"          # N = New (sealed/retail)  U = Used
BL_GUIDE_TYPE = "sold"      # sold = completed listings avg
BL_TIME_PERIOD = "6M"       # last 6 months
STRONG_SELL_ROI = 0.40      # 40 % ROI threshold
STRONG_SELL_MIN_VALUE = 50  # CAD $50 minimum market value
CONSIDER_ROI = 0.20         # 20 % ROI threshold
SLEEP_BETWEEN_CALLS = 1.2   # seconds — respect BrickLink rate limits
OUTPUT_PATH = "public/data.json"
MANUAL_SETS_PATH = "public/manual_sets.json"
IMAGES_DIR = "public/images"
IMAGE_EXTENSIONS = ("png", "jpg")
MIN_IMAGE_SIZE_BYTES = 2000  # BrickLink serves a tiny 1×1 GIF for missing images

# Columns in the sheet (0-indexed after header row)
COL_THEME = 0
COL_NAME = 1
COL_SET_NUMBER = 2
COL_COST = 3
COL_CURRENT_VALUE = 4   # we ignore this, use BrickLink live value
COL_SELLING_ON = 5
COL_NOTES = 6


# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_set_id(raw: str) -> str:
    """Ensure set number ends with -1 as required by BrickLink."""
    raw = str(raw).strip()
    if not re.search(r"-\d+$", raw):
        raw = raw + "-1"
    return raw


def parse_currency(value: str) -> float:
    """Strip $ signs and commas, return float. Returns 0.0 on failure."""
    if value is None:
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", str(value))
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def sell_signal(roi: float, current_value: float) -> str:
    if roi >= STRONG_SELL_ROI and current_value >= STRONG_SELL_MIN_VALUE:
        return "Strong Sell"
    elif roi >= CONSIDER_ROI:
        return "Consider"
    else:
        return "Hold"


def download_set_image(set_id: str) -> str:
    """
    Download the set image from BrickLink and save it under public/images/.
    Returns a relative URL (images/<set_number>.png or .jpg) for use in
    data.json so the React app can serve it locally without hotlink issues.
    Falls back to the original BrickLink URL if both downloads fail.
    """
    os.makedirs(IMAGES_DIR, exist_ok=True)
    numeric = set_id.split("-")[0]

    # Re-use already-downloaded files to save time on subsequent syncs
    for ext in IMAGE_EXTENSIONS:
        if os.path.exists(os.path.join(IMAGES_DIR, f"{numeric}.{ext}")):
            return f"images/{numeric}.{ext}"

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    }
    for ext in IMAGE_EXTENSIONS:
        url = f"https://img.bricklink.com/ItemImage/SN/0/{numeric}.{ext}"
        local_path = os.path.join(IMAGES_DIR, f"{numeric}.{ext}")
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200 and len(resp.content) > MIN_IMAGE_SIZE_BYTES:
                with open(local_path, "wb") as fh:
                    fh.write(resp.content)
                return f"images/{numeric}.{ext}"
        except (requests.RequestException, OSError) as exc:
            print(f"    [img] Failed to download {url}: {exc}")

    # Both formats unavailable — keep the external URL as last resort
    print(f"    [img] Could not download image for {set_id}, using BrickLink URL")
    return f"https://img.bricklink.com/ItemImage/SN/0/{numeric}.png"


def get_manual_sets() -> list[dict]:
    """Read manually-added sets from public/manual_sets.json."""
    if not os.path.exists(MANUAL_SETS_PATH):
        return []
    try:
        with open(MANUAL_SETS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        print(f"[manual_sets] Could not read {MANUAL_SETS_PATH}: {exc}")
        return []


# ── Google Sheets auth ────────────────────────────────────────────────────────

def get_sheet_rows() -> list[list]:
    sa_json = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    sa_info = json.loads(sa_json)
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds = Credentials.from_service_account_info(sa_info, scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet_id = os.environ["SPREADSHEET_ID"]
    sheet = client.open_by_key(spreadsheet_id).worksheet(SHEET_TAB)
    return sheet.get_all_values()


# ── BrickLink API ─────────────────────────────────────────────────────────────

def get_bricklink_auth() -> OAuth1:
    return OAuth1(
        client_key=os.environ["BL_CONSUMER_KEY"],
        client_secret=os.environ["BL_CONSUMER_SECRET"],
        resource_owner_key=os.environ["BL_TOKEN"],
        resource_owner_secret=os.environ["BL_TOKEN_SECRET"],
    )


def fetch_bl_price(set_id: str, auth: OAuth1) -> dict | None:
    """
    Fetch 6-month average sold price for a LEGO set from BrickLink.
    Returns a dict with avg_price and qty_sold, or None on failure.
    """
    url = (
        f"https://api.bricklink.com/api/store/v1/items/SET/{set_id}/price"
        f"?guide_type={BL_GUIDE_TYPE}"
        f"&new_or_used={BL_CONDITION}"
        f"&currency_code={BL_CURRENCY}"
        f"&region=north_america"
    )
    try:
        resp = requests.get(url, auth=auth, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("meta", {}).get("code") != 200:
            print(f"  [BL] Non-200 meta for {set_id}: {data.get('meta')}")
            return None
        price_data = data["data"]
        avg_price = float(price_data.get("avg_price", 0) or 0)
        qty_avg = int(price_data.get("unit_quantity", 0) or 0)
        min_price = float(price_data.get("min_price", 0) or 0)
        max_price = float(price_data.get("max_price", 0) or 0)
        return {"avg_price": avg_price, "qty_sold": qty_avg, "min_price": min_price, "max_price": max_price}
    except Exception as exc:
        print(f"  [BL] Error fetching {set_id}: {exc}")
        return None


# ── BrickEconomy fallback (web scrape) ────────────────────────────────────────

BE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _be_parse_currency(text: str) -> float:
    if not text:
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", text)
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def fetch_brickeconomy(set_id: str) -> dict | None:
    """
    Scrape BrickEconomy for a set's name, theme, retail price and current
    market value (CAD). Returns None if the set page can't be located.
    Used as a fallback when BrickLink has no data (e.g. brand-new sets) and
    to enrich manually-added sets with name/theme.
    """
    numeric = set_id.split("-")[0]
    try:
        # 1. Search to discover the canonical set URL (which includes a slug)
        search_url = f"https://www.brickeconomy.com/search?query={numeric}"
        r = requests.get(search_url, headers=BE_HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"  [BE] search HTTP {r.status_code} for {set_id}")
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        link = None
        for a in soup.select("a[href^='/set/']"):
            href = a.get("href", "")
            # match /set/10307-1/lego-...
            m = re.match(rf"^/set/{re.escape(set_id)}(?:/|$)", href)
            if m:
                link = href
                break
        if not link:
            print(f"  [BE] No matching set link for {set_id}")
            return None

        # 2. Fetch the set detail page
        detail_url = f"https://www.brickeconomy.com{link}"
        r2 = requests.get(detail_url, headers=BE_HEADERS, timeout=15)
        if r2.status_code != 200:
            print(f"  [BE] detail HTTP {r2.status_code} for {set_id}")
            return None
        page = BeautifulSoup(r2.text, "html.parser")

        # 3. Pull name + theme + retail + market price
        name = ""
        theme = ""
        retail = 0.0
        market = 0.0

        # Set Details rows: <div>Name</div><div>Eiffel Tower</div> style
        for row in page.select("div.row"):
            label_el = row.select_one("div.col-xs-5, div.col-xs-4")
            value_el = row.select_one("div.col-xs-7, div.col-xs-8")
            if not label_el or not value_el:
                continue
            label = label_el.get_text(strip=True).lower()
            value = value_el.get_text(" ", strip=True)
            if label == "name" and not name:
                name = value
            elif label == "theme" and not theme:
                theme = value.split("/")[0].strip() or value
            elif "retail price" in label and not retail:
                retail = _be_parse_currency(value)
            elif label in ("market price", "value") and not market:
                market = _be_parse_currency(value)

        # Fallback: title tag like "10307 LEGO Landmarks Eiffel Tower"
        if not name:
            title = page.find("h1")
            if title:
                t = title.get_text(" ", strip=True)
                t = re.sub(r"^\d+\s+LEGO\s+", "", t)
                # drop leading subtheme word(s) heuristically
                name = t

        if not (name or retail or market):
            return None

        return {
            "name": name,
            "theme": theme,
            "retail_price": retail,
            "market_price": market,
            "source_url": detail_url,
        }
    except Exception as exc:
        print(f"  [BE] Error scraping {set_id}: {exc}")
        return None


# ── Gemini AI ad copy ─────────────────────────────────────────────────────────

def generate_ad_copy(set_name: str, set_id: str, current_value: float, cost: float) -> str:
    """Call Gemini to generate a Facebook Marketplace ad."""
    profit = current_value - cost
    prompt = (
        f"Act as a pro LEGO reseller. Write a Facebook Marketplace listing ad for the LEGO set "
        f'"{set_name}" (Set #{set_id.split("-")[0]}). '
        f"Mention it is a rare collector's item currently valued at CAD ${current_value:.2f}. "
        f"Keep it enthusiastic, conversational, and under 200 words. "
        f"Include relevant emojis throughout and finish with 3-5 relevant hashtags. "
        f"Do NOT include a price in the ad body — the price will be set separately on Marketplace."
    )
    try:
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as exc:
        print(f"  [Gemini] Error generating ad for {set_name}: {type(exc).__name__}: {exc}")
        return ""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting LEGO sync...")

    # 1. Load sheet rows
    print("Fetching Google Sheet data...")
    all_rows = get_sheet_rows()

    # Find the header row (first row containing "Set Number")
    header_row_idx = None
    for i, row in enumerate(all_rows):
        if any("Set Number" in str(cell) for cell in row):
            header_row_idx = i
            break

    if header_row_idx is None:
        raise ValueError("Could not find header row with 'Set Number' in the sheet.")

    data_rows = all_rows[header_row_idx + 1:]
    print(f"Found {len(data_rows)} data rows after header.")

    # 2. Authenticate BrickLink
    bl_auth = get_bricklink_auth()

    # 3. Process each row
    sets = []
    for row in data_rows:
        # Pad short rows
        while len(row) <= COL_NOTES:
            row.append("")

        raw_set_number = row[COL_SET_NUMBER].strip()
        if not raw_set_number:
            continue  # Skip blank set number rows (theme headers, etc.)

        set_id = normalize_set_id(raw_set_number)
        name = row[COL_NAME].strip() or f"Set {raw_set_number}"
        theme = row[COL_THEME].strip()
        cost = parse_currency(row[COL_COST])
        selling_on = row[COL_SELLING_ON].strip()
        notes = row[COL_NOTES].strip()

        # Filter out personal notes — strip the Notes field of anything
        # that could identify a person (names, addresses).
        # Simple rule: if a note is just a person's name (single word, no digits),
        # replace it with empty string.
        if notes and re.match(r"^[A-Za-z]{2,20}$", notes):
            notes = ""

        print(f"  Processing {set_id} ({name})...")

        # 4. Fetch BrickLink price
        bl_data = fetch_bl_price(set_id, bl_auth)
        time.sleep(SLEEP_BETWEEN_CALLS)

        if bl_data and bl_data["avg_price"] > 0:
            current_value = bl_data["avg_price"]
            qty_sold = bl_data["qty_sold"]
            min_price = bl_data["min_price"]
            max_price = bl_data["max_price"]
            has_bl_data = True
        else:
            current_value = 0.0
            qty_sold = 0
            min_price = 0.0
            max_price = 0.0
            has_bl_data = False
            print(f"    [!] No BrickLink data for {set_id}, marking as No Data")

        # 5. Calculate ROI
        roi = 0.0
        profit = 0.0
        if cost > 0 and current_value > 0:
            roi = (current_value - cost) / cost
            profit = current_value - cost

        # 6. Determine sell signal
        signal = sell_signal(roi, current_value) if has_bl_data else "No Data"

        # 7. Generate AI ad copy for all sets with BrickLink data
        ad_copy = ""
        if has_bl_data and current_value > 0:
            print(f"    [Gemini] Generating ad copy for {name}...")
            ad_copy = generate_ad_copy(name, set_id, current_value, cost)
            time.sleep(SLEEP_BETWEEN_CALLS)

        sets.append({
            "id": f"{set_id}_{len(sets)}",      # unique key for duplicates
            "set_id": set_id,
            "set_number": raw_set_number,
            "name": name,
            "theme": theme,
            "cost": round(cost, 2),
            "current_value": round(current_value, 2),
            "profit": round(profit, 2),
            "roi": round(roi * 100, 2),          # stored as percentage e.g. 45.3
            "signal": signal,
            "qty_sold_6m": qty_sold,
            "bl_min_price": round(min_price, 2),
            "bl_max_price": round(max_price, 2),
            "selling_on": selling_on,
            "notes": notes,
            "image_url": download_set_image(set_id),
            "ad_copy": ad_copy,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })

    # 7b. Process manual sets from manual_sets.json (sets not in the Google Sheet)
    sheet_set_ids = {s["set_id"] for s in sets}
    manual_file_entries = get_manual_sets()
    if manual_file_entries:
        print(f"\nProcessing {len(manual_file_entries)} manual set(s) from {MANUAL_SETS_PATH}...")
    for ms in manual_file_entries:
        raw_set_number = str(ms.get("set_number", ms.get("set_id", ""))).strip()
        if not raw_set_number:
            continue
        set_id = normalize_set_id(raw_set_number)
        if set_id in sheet_set_ids:
            print(f"  Skipping {set_id} — already present from Google Sheet.")
            continue

        name = str(ms.get("name", f"Set {raw_set_number}")).strip()
        theme = str(ms.get("theme", "")).strip()
        cost = parse_currency(ms.get("cost", 0))
        unit_cost = parse_currency(ms.get("unit_cost", ms.get("cost", 0)))
        qty_owned = int(ms.get("qty_owned", 1) or 1)
        if qty_owned < 1:
            qty_owned = 1
        entry_id = str(ms.get("entry_id", "")).strip()
        notes = str(ms.get("notes", "")).strip()

        print(f"  Processing manual {set_id} ({name}, qty {qty_owned})...")

        bl_data = fetch_bl_price(set_id, bl_auth)
        time.sleep(SLEEP_BETWEEN_CALLS)

        unit_value = 0.0
        qty_sold = 0
        min_price = 0.0
        max_price = 0.0
        has_data = False
        be_data = None

        if bl_data and bl_data["avg_price"] > 0:
            unit_value = bl_data["avg_price"]
            qty_sold = bl_data["qty_sold"]
            min_price = bl_data["min_price"]
            max_price = bl_data["max_price"]
            has_data = True

        # Always try BrickEconomy to fill in name/theme for placeholder entries
        # and to use as a value fallback when BrickLink has nothing.
        needs_meta = (
            not name
            or name.lower().startswith("set ")
            or not theme
        )
        if needs_meta or not has_data:
            be_data = fetch_brickeconomy(set_id)
            time.sleep(SLEEP_BETWEEN_CALLS)
            if be_data:
                if needs_meta:
                    if be_data.get("name"):
                        name = be_data["name"]
                    if be_data.get("theme"):
                        theme = be_data["theme"]
                if not has_data and be_data.get("market_price", 0) > 0:
                    unit_value = be_data["market_price"]
                    has_data = True
                    print(f"    [BE] Using market price ${unit_value:.2f} from BrickEconomy")

        if not has_data:
            print(f"    [!] No BrickLink or BrickEconomy data for {set_id}, marking as No Data")

        # Apply quantity multiplier — line item represents qty_owned units
        current_value = unit_value * qty_owned
        # `cost` from JSON is already total cost (unit_cost * qty) when added
        # via the modal. If only unit_cost is present, compute total here.
        if cost <= 0 and unit_cost > 0:
            cost = round(unit_cost * qty_owned, 2)

        roi = 0.0
        profit = 0.0
        if cost > 0 and current_value > 0:
            roi = (current_value - cost) / cost
            profit = current_value - cost

        signal = sell_signal(roi, current_value) if has_data else "No Data"

        ad_copy = ""
        if has_data and current_value > 0:
            print(f"    [Gemini] Generating ad copy for {name}...")
            ad_copy = generate_ad_copy(name, set_id, current_value, cost)
            time.sleep(SLEEP_BETWEEN_CALLS)

        sets.append({
            "id": f"{entry_id}_manual" if entry_id else f"{set_id}_manual",
            "set_id": set_id,
            "set_number": raw_set_number,
            "name": name,
            "theme": theme,
            "cost": round(cost, 2),
            "unit_cost": round(unit_cost or (cost / qty_owned if qty_owned else cost), 2),
            "qty_owned": qty_owned,
            "current_value": round(current_value, 2),
            "profit": round(profit, 2),
            "roi": round(roi * 100, 2),
            "signal": signal,
            "qty_sold_6m": qty_sold,
            "bl_min_price": round(min_price, 2),
            "bl_max_price": round(max_price, 2),
            "selling_on": str(ms.get("selling_on", "")).strip(),
            "notes": notes,
            "image_url": download_set_image(set_id),
            "ad_copy": ad_copy,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "isManual": True,
        })
        # Only block the set_id from re-processing if this is an old-format
        # record (no entry_id). New per-copy records each have their own
        # entry_id and must all be processed even when set_id repeats.
        if not entry_id:
            sheet_set_ids.add(set_id)

    # 8. Build summary stats
    valid_sets = [s for s in sets if s["signal"] != "No Data"]
    total_cost = round(sum(s["cost"] for s in sets), 2)
    total_value = round(sum(s["current_value"] for s in sets if s["current_value"] > 0), 2)
    total_profit_potential = round(sum(s["profit"] for s in sets if s["profit"] > 0), 2)
    strong_sell_count = sum(1 for s in sets if s["signal"] == "Strong Sell")
    consider_count = sum(1 for s in sets if s["signal"] == "Consider")

    output = {
        "last_synced": datetime.now(timezone.utc).isoformat(),
        "currency": BL_CURRENCY,
        "summary": {
            "total_sets": len(sets),
            "total_cost": total_cost,
            "total_market_value": total_value,
            "total_profit_potential": total_profit_potential,
            "strong_sell_count": strong_sell_count,
            "consider_count": consider_count,
            "hold_count": sum(1 for s in sets if s["signal"] == "Hold"),
        },
        "sets": sets,
    }

    # 9. Write data.json
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nSync complete. {len(sets)} sets written to {OUTPUT_PATH}")
    print(f"  Strong Sell: {strong_sell_count}  |  Consider: {consider_count}  |  Portfolio value: CAD ${total_value:,.2f}")


if __name__ == "__main__":
    main()
