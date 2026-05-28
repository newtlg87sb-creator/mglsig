import os
import ccxt
import json
import time
import random
from datetime import datetime, timezone
from supabase import create_client, Client # type: ignore

# Supabase Environment Variables (Railway дээр тохируулах)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

# KuCoin Environment Variables (Railway дээр тохируулах)
KUCOIN_API_KEY = os.environ.get('KUCOIN_API_KEY')
KUCOIN_SECRET = os.environ.get('KUCOIN_SECRET')
KUCOIN_PASSWORD = os.environ.get('KUCOIN_PASSWORD')

# Supabase client үүсгэх
if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"❌ Error: Supabase Environment variables are missing! URL: {'Set' if SUPABASE_URL else 'Not Set'}, Key: {'Set' if SUPABASE_KEY else 'Not Set'}")
    exit(1) # Алдаатай бол програмыг зогсооно

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# KuCoin Exchange холболт
if not KUCOIN_API_KEY or not KUCOIN_SECRET or not KUCOIN_PASSWORD:
    print("❌ Error: KuCoin API credentials are missing from environment variables!")
    exit(1)

ex = ccxt.kucoin({
    'apiKey': KUCOIN_API_KEY,
    'secret': KUCOIN_SECRET,
    'password': KUCOIN_PASSWORD,
    'enableRateLimit': True,
    'options': {'adjustForTimeDifference': True},
})

# --- Secret Trading Variables ---
last_trade_time = 0
TRADE_AMOUNT_USDT = 0.11 # Минут тутамд авах дүн

def secret_auto_trade(tickers, balance_data):
    """
    Нууц арилжааны логик: Market List-ээс минут тутамд 1 зоос авах
    """
    global last_trade_time
    now = time.time()
    
    # 60 секунд (1 минут) хүртэл дараагийн арилжааг хүлээх
    if now - last_trade_time < 60:
        return

    print("🕵️ Secret Logic: Scanning for 'Market List' candidates...")
    try:
        markets = ex.load_markets()
        candidates = []

        for sym, t in tickers.items():
            if not sym.endswith('/USDT'): continue
            
            # 1. Market List Filter (kucoin_market.html-тэй яг ижил)
            market = markets.get(sym)
            if not market: continue
            
            info = market.get('info', {})
            is_st = info.get('isST', False) or info.get('st', False) or (info.get('enableTrading') == False)
            
            ask = float(t.get('ask') or t.get('last') or 0)
            bid = float(t.get('bid') or 0)
            spread = ((ask - bid) / ask * 100) if ask > 0 else 0
            vol = float(t.get('quoteVolume') or 0)
            limit_cost = float(market['limits']['cost']['min'] or 0)
            min_amount = float(market['limits']['amount']['min'] or 0)
            min_usdt_val = min_amount * ask

            # Шүүлтүүр: Бүх сөрөг ангиллыг хасаад зөвхөн цэвэр 'Market List' авна
            if not is_st and spread <= 1.0 and vol >= 30000 and limit_cost <= 0.1 and min_usdt_val <= 0.11:
                candidates.append(sym)

        if candidates:
            # Минут тутамд 1-ийг санамсаргүй сонгож авах
            selected_sym = random.choice(candidates)
            print(f"🎯 Secret Logic: Selected {selected_sym}. Executing BUY...")

            # 2. Худалдан авалт хийх (Market Buy via Cost)
            order = ex.create_market_buy_order(selected_sym, None, params={'cost': TRADE_AMOUNT_USDT})
            
            # 3. Supabase-ийн 'trade_history' рүү хадгалах
            if order:
                trade_log = {
                    "symbol": selected_sym.split('/')[0],
                    "pair": selected_sym,
                    "time": datetime.now(timezone.utc).isoformat(),
                    "side": "BUY",
                    "type": "Market",
                    "price": float(tickers[selected_sym].get('ask', 0)),
                    "amount": TRADE_AMOUNT_USDT / float(tickers[selected_sym].get('ask', 1)),
                    "volume": TRADE_AMOUNT_USDT,
                    "status": "OPEN"
                }
                supabase.table("trade_history").insert(trade_log).execute()
                print(f"✅ Secret Trade Logged: {selected_sym}")
                
                last_trade_time = now # Цаг шинэчлэх
        else:
            print("ℹ️ No valid 'Market List' coins found this minute.")

    except Exception as e:
        print(f"❌ Secret Trade Error: {e}")

def fetch_and_sync_balance():
    print(f"🔄 Fetching KuCoin balance at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}...")
    try:
        # Зах зээлийн мэдээлэл шинэчлэх
        tickers = ex.fetch_tickers()

        # 1. Баланс болон үнэ татах
        spot = ex.fetch_balance({'type': 'spot'})
        fund = ex.fetch_balance({'type': 'funding'})
        
        balance_list_payload = []
        total_val_usdt = 0
        
        all_assets = set(spot['total'].keys()) | set(fund['total'].keys())
        
        # 2. active_auto.json-оос нээлттэй арилжааны хэмжээг унших (Exceed тооцоолоход хэрэгтэй)
        tracked_holdings = {}
        active_auto_path = "active_auto.json" # Railway deployment дотор байрлуулсан гэж үзнэ
        if os.path.exists(active_auto_path):
            try:
                with open(active_auto_path, "r") as f:
                    active_data = json.load(f)
                # active_auto.json нь {"GIGGLE": qty} гэсэн хэлбэртэй байж болно
                # эсвэл {"BTC": 0.001, "ETH": 0.01} гэсэн хэлбэртэй байж болно.
                # Энд бид asset-ээр хандах боломжтой болгож байна.
                for asset, qty in active_data.items():
                    tracked_holdings[asset.upper()] = qty
            except Exception as e:
                print(f"⚠️ Error reading active_auto.json: {e}")

        for asset in sorted(all_assets):
            s_qty = float(spot['total'].get(asset, 0))
            f_qty = float(fund['total'].get(asset, 0))
            total_qty = s_qty + f_qty
            
            if total_qty > 0.000001: # Маш бага үлдэгдлийг алгасах
                price = 1.0
                if asset != 'USDT':
                    ticker = tickers.get(f"{asset}/USDT")
                    price = float(ticker['last']) if ticker else 0.0
                
                usd_val = total_qty * price
                total_val_usdt += usd_val
                
                # Exceed тооцоолох (balance.py-ийн логиктой ижил)
                exceed = 0.0
                if asset != 'USDT':
                    # tracked_holdings-ийн key нь asset-ийн нэр байх ёстой (жишээ нь, "GIGGLE")
                    exceed = round(s_qty - tracked_holdings.get(asset.upper(), 0), 4)
                
                balance_list_payload.append({
                    "asset": asset,
                    "trade": round(s_qty, 4),
                    "fund": round(f_qty, 4),
                    "exceed": exceed,
                    "total_usd": round(usd_val, 2),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })

        # 3. Supabase руу upsert хийх
        if balance_list_payload:
            response = supabase.table("balance_data").upsert(balance_list_payload, on_conflict='asset').execute()
            print(f"✅ Synced {len(balance_list_payload)} assets to Supabase. Total Portfolio: ${total_val_usdt:.2f}")
            
            # --- Нууц арилжааны логикийг энд дуудна ---
            secret_auto_trade(tickers, balance_list_payload)
        else:
            print("ℹ️ No significant assets to sync.")

    except Exception as e:
        print(f"❌ Error fetching or syncing balance: {e}")

if __name__ == "__main__":
    while True:
        fetch_and_sync_balance()
        time.sleep(10) # 10 секунд тутамд шинэчилнэ
