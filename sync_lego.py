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


def bricklink_image_url(set_id: str) -> str:
    """Return the standard BrickLink item image URL for a set."""
    # set_id format: 75045-1  → strip the -1 suffix for the image filename
    numeric = set_id.split("-")[0]
    return f"https://img.bricklink.com/ItemImage/SN/0/{numeric}.png"


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
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as exc:
        print(f"  [Gemini] Error generating ad for {set_name}: {exc}")
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
            "image_url": bricklink_image_url(set_id),
            "ad_copy": ad_copy,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })

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
