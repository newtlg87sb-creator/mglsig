// api/binance.js
export default async function handler(req, res) {
  // Binance API-г 10 секунд кэшлэх (Rate limit-ээс хамгаална)
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  try {
    // api1.binance.com нь серверээс хандахад илүү тогтвортой байдаг
    const response = await fetch('https://api1.binance.com/api/v3/ticker/24hr');
    
    if (response.status === 451) {
      return res.status(451).json({ error: 'Binance is blocked in this server region. Please change Vercel function region to HK, Singapore or Europe.', status: 451 });
    }

    if (!response.ok) {
      // Алдааны кодыг шууд дамжуулна (429, 500 гэх мэт)
      return res.status(response.status).json({ error: 'Binance API error', status: response.status });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}