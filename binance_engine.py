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

# Binance Exchange-ийг тохируулах
exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'spot', 'adjustForTimeDifference': True},
    # api1, api2, эсвэл api3 кластеруудыг туршиж үзэх
    'urls': {
        'api': {
            'public': 'https://api3.binance.com/api/v3',
            'private': 'https://api3.binance.com/api/v3',
        }
    }
})

session_initial_prices = {}
h1_ago_prices = {}
last_h1_fetch = 0
last_market_refresh = 0
cached_markets = {}

def fetch_h1_data(symbols):
    """Цаг тутамд нэг удаа 1 цагийн өмнөх үнийг кэшлэх"""
    print("📡 Fetching H1 anchor prices for Binance...")
    for sym in symbols:
        try:
            ohlcv = exchange.fetch_ohlcv(sym, timeframe='1h', limit=2)
            if len(ohlcv) >= 1:
                h1_ago_prices[sym] = float(ohlcv[0][4])
            time.sleep(0.1) # Rate limit protection
        except: pass

def run_engine():
    global session_initial_prices, last_h1_fetch, last_market_refresh, cached_markets
    print("🚀 Binance Market Data Engine Started (Running as binance_engine.py)...")
    
    while True:
        try:
            now = time.time()
            
            # 1 цаг тутамд Market мэдээллийг (ST статус, Limits) шинэчлэх
            if now - last_market_refresh > 3600 or not cached_markets:
                print("🔄 Refreshing Binance market definitions (ST status check)...")
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
                
                market_info = cached_markets[sym].get('info', {})
                is_st = market_info.get('isSpotTradingAllowed', True) == False or \
                        market_info.get('status') != 'TRADING'

                t = tickers[sym]
                ask = float(t.get('ask') or t.get('last') or 0.0)
                
                # Үнэ 0 байгаа үхмэл зооснуудыг алгасах (Delisted tokens check)
                if ask <= 0:
                    continue

                bid = float(t.get('bid') or 0)

                if sym not in session_initial_prices and ask > 0:
                    session_initial_prices[sym] = ask
                
                init_p = session_initial_prices.get(sym, ask)
                real_change = ((ask - init_p) / init_p * 100) if init_p > 0 else 0

                h1_price = h1_ago_prices.get(sym, ask)
                h1_change = ((ask - h1_price) / h1_price * 100) if h1_price > 0 else 0

                spread = ((ask - bid) / ask * 100) if ask > 0 else 0
                vol = float(t.get('quoteVolume') or 0)
                ch_24 = float(t.get('percentage') or 0)
                
                # Binance-ийн хамгийн бага арилжааны дүнг (Min Order Cost) min_usdt болгож ашиглана
                min_usdt = float(cached_markets[sym]['limits']['cost']['min'] or 0)

                payload.append({
                    "symbol": sym.replace('/', '-'),
                    "full_symbol": sym,
                    "bid": bid,
                    "ask": ask,
                    "spread": round(spread, 2),
                    "min_usdt": round(min_usdt, 4), # Хамгийн бага арилжааны дүн
                    "volume": round(vol, 2),
                    "real_change": round(real_change, 2),
                    "h1_change": round(h1_change, 2),
                    "change_24h": round(ch_24, 2),
                    "is_st": bool(is_st),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })

            if payload:
                for i in range(0, len(payload), 100):
                    batch = payload[i:i+100]
                    supabase.table("binance_market_data").upsert(batch).execute() # Binance-ийн хүснэгт рүү илгээнэ
                
                print(f"✅ Synced {len(payload)} Binance coins at {time.strftime('%H:%M:%S')}")

            time.sleep(5)

        except ccxt.ExchangeNotAvailable as e:
            if "451" in str(e):
                print("❌ Binance Region Block (451 Error): Таны сервер хориотой бүсэд байна. Railway-ийн Region-ийг (Европ эсвэл Ази) болгож солино уу.")
            else:
                print(f"❌ Exchange Not Available: {e}")
            time.sleep(30)
        except Exception as e:
            print(f"❌ Binance Loop Error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    run_engine()