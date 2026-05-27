import ccxt
import time
import os
import json
from datetime import datetime, timezone
from supabase import create_client, Client # type: ignore

# Railway-ийн Environment Variables-д эдгээрийг тохируулах хэрэгтэй
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

# URL-ийг цэвэрлэх (rest/v1 давхардахаас сэргийлж, илүүдэл / -ыг устгах)
if SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.replace("/rest/v1", "").rstrip("/")

if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"❌ Error: Environment variables are missing! URL: {'Set' if SUPABASE_URL else 'Not Set'}, Key: {'Set' if SUPABASE_KEY else 'Not Set'}")
    time.sleep(60) # Унтаж байгаад дахин оролдоно

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

exchange = ccxt.kucoin({
    'enableRateLimit': True,
    'options': {'defaultType': 'spot', 'adjustForTimeDifference': True}
})

session_initial_prices = {}
h1_ago_prices = {}
last_h1_fetch = 0
last_market_refresh = 0
cached_markets = {}

def fetch_h1_data(symbols):
    """Цаг тутамд нэг удаа 1 цагийн өмнөх үнийг кэшлэх"""
    print("📡 Fetching H1 anchor prices...")
    for sym in symbols:
        try:
            ohlcv = exchange.fetch_ohlcv(sym, timeframe='1h', limit=2)
            if len(ohlcv) >= 1:
                h1_ago_prices[sym] = float(ohlcv[0][4])
            time.sleep(0.1) # Rate limit protection
        except: pass

def run_engine():
    global session_initial_prices, last_h1_fetch, last_market_refresh, cached_markets
    print("🚀 Market Data Engine Started (Running as main.py)...")
    
    while True:
        try:
            now = time.time()
            
            # 1 цаг тутамд Market мэдээллийг (ST статус, Limits) шинэчлэх
            if now - last_market_refresh > 3600 or not cached_markets:
                print("🔄 Refreshing market definitions (ST status check)...")
                cached_markets = exchange.load_markets()
                last_market_refresh = now
            
            usdt_pairs = [s for s in cached_markets.keys() if s.endswith('/USDT')]
            
            # 1 цаг тутамд 1h% тооцох үнийг шинэчлэх
            if now - last_h1_fetch > 3600:
                fetch_h1_data(usdt_pairs)
                last_h1_fetch = now

            tickers = exchange.fetch_tickers()
            payload = []

            for sym in usdt_pairs:
                if sym not in tickers: continue
                
                # ST (Special Treatment) статус шалгах
                market_info = cached_markets[sym].get('info', {})
                is_st = market_info.get('isST', False) or market_info.get('st', False) or (market_info.get('enableTrading') == False)

                t = tickers[sym]
                # Ask үнэ 0 байсан ч ST бол payload-д оруулна
                ask = float(t.get('ask') or t.get('last') or 0.0)
                bid = float(t.get('bid') or 0)

                # Real% тооцоолол
                if sym not in session_initial_prices and ask > 0:
                    session_initial_prices[sym] = ask
                
                init_p = session_initial_prices.get(sym, ask)
                real_change = ((ask - init_p) / init_p * 100) if init_p > 0 else 0

                # 1h% тооцоолол
                h1_price = h1_ago_prices.get(sym, ask)
                h1_change = ((ask - h1_price) / h1_price * 100) if h1_price > 0 else 0

                # Бусад үзүүлэлтүүд
                spread = ((ask - bid) / ask * 100) if ask > 0 else 0
                vol = float(t.get('quoteVolume') or 0)
                ch_24 = float(t.get('percentage') or 0)
                min_amount = float(cached_markets[sym]['limits']['amount']['min'] or 0)
                min_usdt = min_amount * ask if ask > 0 else 0
                min_order_cost = float(cached_markets[sym]['limits']['cost']['min'] or 0)

                # Supabase-рүү илгээх бэлдэц
                payload.append({
                    "symbol": sym.replace('/', '-'), # ЭНЭ ЗӨВ: BTC-USDT гэж хадгална
                    "full_symbol": sym,
                    "bid": bid,
                    "ask": ask,
                    "spread": round(spread, 2),
                    "min_usdt": round(min_usdt, 4),
                    "volume": round(vol, 2),
                    "min_order_cost": round(min_order_cost, 4), # Add this to payload
                    "real_change": round(real_change, 2),
                    "h1_change": round(h1_change, 2),
                    "change_24h": round(ch_24, 2),
                    "is_st": bool(is_st),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })

            # Supabase-д БӨӨНӨӨР нь хадгалах (Upsert)
            if payload:
                # 100 100-аар багцалж илгээх (Supabase limit-ээс сэргийлнэ)
                for i in range(0, len(payload), 100):
                    batch = payload[i:i+100]
                    supabase.table("market_data").upsert(batch).execute()
                
                print(f"✅ Synced {len(payload)} coins at {time.strftime('%H:%M:%S')}")

            time.sleep(5) # 5 секунд тутамд шинэчлэх

        except Exception as e:
            print(f"❌ Loop Error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    run_engine()