import ccxt.pro as ccxtpro
import asyncio
from datetime import datetime

class ExchangeLogic:
    def __init__(self, exchange_id='binance', market_type='spot'):
        """
        VPS дээр ажиллуулахад зориулсан PyQt6-гүй "Headless" хувилбар.
        Зөвхөн өгөгдөл татах болон боловсруулах логикийг агуулна.
        """
        self.exchange_id = exchange_id
        self.market_type = market_type
        # CCXT тохиргоог эхлүүлэх
        options = {'enableRateLimit': True, 'options': {'defaultType': market_type}}
        # ccxt.pro ашиглан WebSocket холболт үүсгэх
        self.exchange = getattr(ccxtpro, exchange_id)(options)
        self.running = False

    async def main_loop(self):
        self.running = True
        ex_name = self.exchange_id.upper()
        m_type = "FUTURE" if self.market_type == 'swap' else "SPOT"
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ({ex_name} {m_type}) WebSocket холболт үүсгэж байна...")
        
        try:
            # Зоосны жагсаалтыг (Market Data) нэг удаа ачаална
            markets = await self.exchange.load_markets()
            symbols = [s for s, m in markets.items() 
                      if m['active'] and m.get('type') == self.market_type and m.get('quote') == 'USDT']
            print(f"Нийт {len(symbols)} USDT хос олдлоо.")

            while self.running:
                try:
                    # WebSocket-ээр үнэ өөрчлөгдөх мөчийг хүлээх (watch_tickers)
                    # watch_tickers нь зөвхөн шинэчлэгдсэн зооснуудын dict-ийг буцаадаг
                    updated_tickers = await self.exchange.watch_tickers(symbols)
                    
                    if not updated_tickers or not isinstance(updated_tickers, dict):
                        continue

                    batch_results = []
                    # Зөвхөн шинэчлэгдсэн зооснуудыг л боловсруулах
                    for symbol, t in updated_tickers.items():
                        if symbol not in symbols: continue
                        
                        m_data = markets[symbol]
                        
                        if t:
                            # 1. Зоосны бүтэн нэр хайх (Logic from Binance_spot.py)
                            base = symbol.split('/')[0]
                            full_name = base
                            if self.exchange.currencies and base in self.exchange.currencies:
                                full_name = self.exchange.currencies[base].get('name') or full_name
                            
                            if full_name == base:
                                info = m_data.get('info', {})
                                name_keys = ['fullName', 'baseCurrencyFullName', 'displayName', 'assetName', 'baseAsset', 'coinName', 'name']
                                for k in name_keys:
                                    val = info.get(k)
                                    if val and isinstance(val, str) and val.upper() != base.upper():
                                        full_name = val
                                        break
                            full_name = full_name.replace('/USDT', '').strip()
                            if ' ' in full_name or (len(full_name) > 1 and full_name[0].isalpha() and full_name[1:].islower()):
                                full_name = ' '.join([word.capitalize() for word in full_name.split(' ')])

                            # 2. Эрсдэлийн таг (Tags)
                            found_tags = set()
                            m_info = m_data.get('info', {})
                            if self.exchange_id == 'binance':
                                for b_tag in m_info.get('tags', []):
                                    if b_tag.upper() in ['MONITORING', 'SEED']: found_tags.add(b_tag.upper())
                            if any([m_info.get('isST'), m_info.get('is_st') == '1', m_info.get('st') == 1, m_info.get('state') == 'ST']):
                                found_tags.add('ST')
                            tag_str = "/".join(sorted(found_tags))

                            # 3. Үнэ, Spread, Min USDT тооцоолох
                            last_p = t.get('last', 0)
                            bid_p = t.get('bid') or last_p
                            ask_p = t.get('ask') or last_p
                            spread = ((ask_p - bid_p) / bid_p * 100) if bid_p > 0 else 0
                            min_qty = m_data.get('limits', {}).get('amount', {}).get('min')
                            min_usdt = min_qty * ask_p if min_qty and ask_p else 0

                            batch_results.append({
                                'symbol': symbol, 'name': full_name, 'last': last_p, 
                                'bid': bid_p, 'ask': ask_p, 'spread': f"{spread:.2f}%", 
                                'pct': f"{t.get('percentage', 0):+.2f}%", 
                                'min_usdt': f"{min_usdt:.2f}", 'tags': tag_str,
                                'timestamp': datetime.now().isoformat()
                            })
                    
                    if batch_results:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] {len(batch_results)} зоосны үнэ шинэчлэгдлээ.")
                        # ЭНД: batch_results-ийг вэбсайт руу дамжуулах функцээ дуудна
                    
                except Exception as loop_err:
                    if "connection" in str(loop_err).lower():
                        print("Connection lost, reconnecting...")
                        await asyncio.sleep(5)
                    else:
                        print(f"Loop Error: {loop_err}")

        except Exception as e:
            print(f"Critical Error: {e}")
        finally:
            self.running = False
            await self.exchange.close()

    def run(self):
        asyncio.run(self.main_loop())

if __name__ == "__main__":
    crawler = ExchangeLogic(exchange_id='binance', market_type='spot')
    crawler.run()