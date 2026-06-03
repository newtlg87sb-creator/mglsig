// api/okx.js
export default async function handler(req, res) {
  // OKX API-г 10 секунд кэшлэх
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  try {
    // OKX V5 Spot Tickers API
    const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'OKX API error', status: response.status });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}