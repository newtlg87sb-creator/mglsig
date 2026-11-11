import { createClient } from '@supabase/supabase-js';

const CACHE_KEY = 'cryptocompare_latest';
const REFRESH_INTERVAL_SECONDS = 24 * 60 * 60;
const REFRESH_INTERVAL_MS = REFRESH_INTERVAL_SECONDS * 1000;
const CACHE_CONTROL = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400';
const STALE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

let cachedNews = null;
let cachedAt = 0;

function sendNews(res, data, stale = false) {
  res.setHeader('Cache-Control', stale ? STALE_CACHE_CONTROL : CACHE_CONTROL);
  if (stale) res.setHeader('X-News-Cache', 'stale');
  else res.setHeader('X-News-Cache', 'fresh');
  return res.status(200).json(data);
}

function sendUnavailable(res, retryAfter = REFRESH_INTERVAL_SECONDS) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', String(retryAfter));
  return res.status(503).json({ error: 'News provider is temporarily unavailable' });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error('News cache is not configured; refusing an unthrottled provider request');
    return sendUnavailable(res);
  }

  let cachedRecord;
  try {
    const { data, error } = await supabase
      .from('news_cache')
      .select('payload, fetched_at, last_attempt_at')
      .eq('cache_key', CACHE_KEY)
      .maybeSingle();

    if (error) throw error;
    cachedRecord = data;
  } catch (error) {
    console.error('News cache lookup failed:', error);
    return sendUnavailable(res);
  }

  const cachedPayload = cachedRecord?.payload || cachedNews;
  const fetchedAt = cachedRecord?.fetched_at
    ? Date.parse(cachedRecord.fetched_at)
    : cachedAt;
  const now = Date.now();

  if (cachedPayload && Number.isFinite(fetchedAt) && now - fetchedAt < REFRESH_INTERVAL_MS) {
    cachedNews = cachedPayload;
    cachedAt = fetchedAt;
    return sendNews(res, cachedPayload);
  }

  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  if (!apiKey) {
    console.error('CRYPTOCOMPARE_API_KEY is not configured');
    if (cachedPayload) return sendNews(res, cachedPayload, true);
    return sendUnavailable(res);
  }

  try {
    const { data: claimed, error: claimError } = await supabase
      .rpc('claim_news_refresh', {
        p_cache_key: CACHE_KEY,
        p_cooldown_seconds: REFRESH_INTERVAL_SECONDS
      });

    if (claimError) throw claimError;
    if (!claimed) {
      if (cachedPayload) return sendNews(res, cachedPayload, true);
      return sendUnavailable(res);
    }
  } catch (error) {
    console.error('News refresh lock failed:', error);
    if (cachedPayload) return sendNews(res, cachedPayload, true);
    return sendUnavailable(res);
  }

  try {
    const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok || data.Response === 'Error' || !Array.isArray(data.Data) || data.Data.length === 0) {
      throw new Error(data.Message || `HTTP ${response.status}`);
    }

    const refreshedAt = new Date().toISOString();
    const { error: saveError } = await supabase
      .from('news_cache')
      .upsert({
        cache_key: CACHE_KEY,
        payload: data,
        fetched_at: refreshedAt
      });

    if (saveError) throw saveError;

    cachedNews = data;
    cachedAt = Date.parse(refreshedAt);
    return sendNews(res, data);
  } catch (error) {
    console.error('News provider refresh failed:', error);
    if (cachedPayload) return sendNews(res, cachedPayload, true);
    return sendUnavailable(res);
  }
}
