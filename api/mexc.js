// api/mexc.js
export default async function handler(req, res) {
  // MEXC API-г 10 секунд кэшлэх
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  try {
    const response = await fetch('https://api.mexc.com/api/v3/ticker/24hr');
    if (!response.ok) {
      return res.status(response.status).json({ error: 'MEXC API error', status: response.status });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}