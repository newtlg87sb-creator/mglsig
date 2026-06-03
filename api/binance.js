// api/binance.js
export default async function handler(req, res) {
  // Binance API-г 10 секунд кэшлэх (Rate limit-ээс хамгаална)
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
}