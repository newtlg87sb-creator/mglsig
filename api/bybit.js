// api/bybit.js
export default async function handler(req, res) {
  // Bybit API-г 10 секунд кэшлэх
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  try {
    // Bybit V5 Spot Tickers API
    const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Bybit API error', status: response.status });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}