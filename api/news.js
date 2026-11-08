export default async function handler(req, res) {
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  if (!apiKey) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'News service is not configured' });
  }

  try {
    const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok || data.Response === 'Error' || !Array.isArray(data.Data) || data.Data.length === 0) {
      console.error('CryptoCompare news request failed:', data.Message || `HTTP ${response.status}`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: 'News provider is temporarily unavailable' });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    console.error('News provider request failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'News provider is temporarily unavailable' });
  }
}