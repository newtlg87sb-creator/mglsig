let cachedNews = null;
let cachedAt = 0;
let inFlight = null;

const CACHE_TTL = 12 * 60 * 60 * 1000;
const CACHE_CONTROL = 'public, max-age=300, s-maxage=43200, stale-while-revalidate=86400';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  const now = Date.now();
  if (cachedNews && now - cachedAt < CACHE_TTL) {
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(cachedNews);
  }

  if (!apiKey) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'News service is not configured' });
  }

  try {
    if (!inFlight) {
      inFlight = (async () => {
        const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const data = await response.json();
        if (!response.ok || data.Response === 'Error' || !Array.isArray(data.Data) || data.Data.length === 0) {
          throw new Error(data.Message || `HTTP ${response.status}`);
        }

        cachedNews = data;
        cachedAt = Date.now();
        return data;
      })();
    }

    const request = inFlight;
    const data = await request;
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json(data);
  } catch (error) {
    console.error('News provider request failed:', error);
    if (cachedNews) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
      return res.status(200).json(cachedNews);
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'News provider is temporarily unavailable' });
  } finally {
    inFlight = null;
  }
}