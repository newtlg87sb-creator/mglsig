// api/data.js - Proprietary Signal Logic (Server-side)
import { calculateRSI, calculateEMA, calculateSMA, calculatePivots } from './lib/indicators.js';

export default async function handler(req, res) {
    const { symbol = 'BTCUSDT', interval = '1m', rsiLen = 14, emaLen = 20, maLen = 20, market = 'spot' } = req.query;

    // 1 секунд кэшлэх - Сигналыг хамгийн хурдан байлгах
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');

    try {
        const baseUrl = market === 'futures' ? 'https://fapi.binance.com' : 'https://api.binance.com';
        // Increase limit to ensure enough data for SMA200
        const binanceUrl = `${baseUrl}${market === 'futures' ? '/fapi/v1' : '/api/v3'}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=250`;
        
        const response = await fetch(binanceUrl);
        if (response.status === 451) return res.status(451).json({ error: 'Region Blocked' });
        
        const candles = await response.json();

        // Handle case where Binance returns an error or empty array
        if (!Array.isArray(candles) || candles.length === 0) {
            return res.status(404).json({ error: 'No klines data found for this symbol/interval.' });
        }
        // Ensure enough candles for basic signal calculation (at least 3 for prev, prevPrev)
        if (candles.length < 3) {
            return res.status(400).json({ error: `Not enough recent data for signal calculation for ${symbol} ${interval}.` });
        }
        const closes = candles.map(c => parseFloat(c[4]));

        // Математик тооцооллуудыг сервер талд гүйцэтгэнэ
        const rsiValues = calculateRSI(closes, parseInt(rsiLen));
        const emaValues = calculateEMA(closes, parseInt(emaLen));
        const maValues = calculateSMA(closes, parseInt(maLen));
        const pivots = calculatePivots(candles, 10);

        // Сигналын логик (YES/NO шийдвэрүүд)
        const resData = {
            prices: {
                last: closes[lastIdx],
                prev: closes[lastIdx - 1],
                prevPrev: closes[lastIdx - 2],
                open: [candles[lastIdx][1], candles[lastIdx-1][1], candles[lastIdx-2][1]],
                high: [candles[lastIdx][2], candles[lastIdx-1][2], candles[lastIdx-2][2]],
                low: [candles[lastIdx][3], candles[lastIdx-1][3], candles[lastIdx-2][3]],
            },
            rsi: [rsiValues[lastIdx], rsiValues[lastIdx-1], rsiValues[lastIdx-2]],
            ema: [emaValues[lastIdx], emaValues[lastIdx-1], emaValues[lastIdx-2]],
            ma: [maValues[lastIdx], maValues[lastIdx-1], maValues[lastIdx-2]],
            pivots: {
                highs: pivots.highs.slice(-3).reverse(),
                lows: pivots.lows.slice(-3).reverse()
            },
            sma: {
                sma20: calculateSMA(closes, 20).slice(-3).reverse(),
                sma50: calculateSMA(closes, 50).slice(-3).reverse(),
                sma200: calculateSMA(closes, 200).slice(-3).reverse()
            },
            signals: {
                rsi30Up: (rsiValues[lastIdx-2] < 30 && rsiValues[lastIdx-1] > 30) ? "YES" : "NO",
                rsi70Down: (rsiValues[lastIdx-2] > 70 && rsiValues[lastIdx-1] < 70) ? "YES" : "NO"
            }
        };

        res.status(200).json(resData);
    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: 'Signal calculation failed' });
    }
}