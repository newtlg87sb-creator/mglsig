/**
 * MGL Signal - MyData Live Price Endpoint
 * Binance rate limit-аас сэрцээж өгөгдөл авахад memory cache ашиглаж байна.
 * Vercel serverless environment-д directBinance-ийн запроуудыг 2 секунд оноосондоо дахин авахгүй байна.
 */

const cache = new Map();
const CACHE_TTL_MS = 2000; // 2 секунд cache

function getCacheKey(symbol, market, interval) {
  return `${market}:${symbol}:${interval}`.toUpperCase();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { symbol, market = "spot", interval = "1m" } = req.query;

  if (!symbol || String(symbol).trim() === "") {
    return res.status(400).json({ error: "Symbol required" });
  }

  const cacheKey = getCacheKey(symbol, market, interval);
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now < cached.expiresAt) {
    return res.status(200).json(cached.data);
  }

  try {
    const baseUrl = market === "futures"
      ? "https://fapi.binance.com/fapi/v1/klines"
      : "https://api.binance.com/api/v3/klines";

    const binanceUrl = `${baseUrl}?symbol=${encodeURIComponent(String(symbol).trim().toUpperCase())}&interval=${encodeURIComponent(interval)}&limit=100`;

    const response = await fetch(binanceUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Binance data unavailable" });
    }

    const klines = await response.json();

    if (!Array.isArray(klines) || klines.length === 0) {
      return res.status(404).json({ error: "No kline data" });
    }

    const last = klines[klines.length - 1];
    const data = {
      symbol: String(symbol).trim().toUpperCase(),
      market,
      interval,
      price: Number(last[4]),
      open: Number(last[1]),
      high: Number(last[2]),
      low: Number(last[3]),
      close: Number(last[4]),
      volume: Number(last[5]),
      timestamp: Number(last[0]),
      source: "binance",
      cached: false
    };

    cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS });

    return res.status(200).json(data);
  } catch (error) {
    console.error("[MYDATA LIVE ERROR]", error.message);

    const stale = cache.get(cacheKey);
    if (stale) {
      return res.status(200).json({ ...stale.data, cached: true, stale: true });
    }

    return res.status(502).json({ error: "Unable to load market data" });
  }
}
