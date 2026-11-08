let cachedNews = null;
let cachedAt = 0;
let inFlight = null;

const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req, res) {
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'News service is not configured'
    });
  }

  const now = Date.now();

  // Serve cached news
  if (cachedNews && now - cachedAt < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json(cachedNews);
  }

  try {
    // Prevent duplicate requests in same function instance
    if (!inFlight) {
      inFlight = (async () => {
        const url =
          `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000)
        });

        const data = await response.json();

        if (
          !response.ok ||
          data.Response === 'Error' ||
          !Array.isArray(data.Data) ||
          data.Data.length === 0
        ) {
          throw new Error(data.Message || 'News provider failed');
        }

        cachedNews = data;
        cachedAt = Date.now();

        return data;
      })();
    }

    const data = await inFlight;

    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json(data);

  } catch (error) {
    console.error('CryptoCompare error:', error.message);

    // Return stale news if available
    if (cachedNews) {
      res.setHeader('Cache-Control', 'public, s-maxage=30');
      return res.status(200).json(cachedNews);
    }

    res.setHeader('Cache-Control', 'no-store');

    return res.status(502).json({
      error: 'News provider is temporarily unavailable'
    });

  } finally {
    inFlight = null;
  }
}