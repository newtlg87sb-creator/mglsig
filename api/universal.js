export default async function handler(req, res) {
  const { exchange, endpoint } = req.query;
  // 10 секунд кэшлэх нь Rate Limit-ээс хамгаалж, хурдыг нэмнэ
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  const urls = {
    binance: 'https://api.binance.com/api/v3/ticker/24hr',
    kucoin: 'https://api.kucoin.com/api/v1/market/allTickers',
    mexc: 'https://api.mexc.com/api/v3/ticker/24hr',
    bybit: 'https://api.bybit.com/v5/market/tickers?category=spot',
    okx: 'https://www.okx.com/api/v5/market/tickers?instType=SPOT'
  };

  try {
    const targetUrl = urls[exchange];
    if (!targetUrl) return res.status(400).json({ error: `Exchange ${exchange} not supported` });

    const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'MGLSignal-Terminal/1.0' },
        next: { revalidate: 10 }
    });
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gateway Fetch Failed', details: error.message });
  }
}