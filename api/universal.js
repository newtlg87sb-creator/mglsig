export default async function handler(req, res) {
  const { exchange, type = 'spot' } = req.query;
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');

  const urls = {
    binance: type === 'spot' ? 'https://api.binance.com/api/v3/ticker/24hr' : 'https://fapi.binance.com/fapi/v1/ticker/24hr',
    kucoin: type === 'spot' ? 'https://api.kucoin.com/api/v1/market/allTickers' : 'https://api-futures.kucoin.com/api/v1/allTickers',
    mexc: 'https://api.mexc.com/api/v3/ticker/24hr',
    bybit: `https://api.bybit.com/v5/market/tickers?category=${type === 'spot' ? 'spot' : 'linear'}`,
    okx: `https://www.okx.com/api/v5/market/tickers?instType=${type === 'spot' ? 'SPOT' : 'SWAP'}`,
    gateio: `https://api.gateio.ws/api/v4/${type === 'spot' ? 'spot' : 'futures/usdt'}/tickers`,
    bitget: `https://api.bitget.com/api/v2/${type === 'spot' ? 'spot' : 'mix'}/market/tickers`,
    htx: type === 'spot' ? 'https://api.huobi.pro/market/tickers' : 'https://api.hbdm.com/linear-swap-ex/market/detail/batch_merged',
    bitmart: `https://api-cloud.bitmart.com/${type === 'spot' ? 'spot/v3/tickers' : 'contract/v1/tickers'}`,
    phemex: 'https://api.phemex.com/v1/md/ticker/24hr/all'
  };

  try {
    const targetUrl = urls[exchange];
    if (!targetUrl) return res.status(400).json({ error: `Exchange ${exchange} not supported` });

    const response = await fetch(targetUrl, { headers: { 'User-Agent': 'MGLSignal-Terminal/1.0' } });
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Fetch Failed', details: error.message });
  }
}