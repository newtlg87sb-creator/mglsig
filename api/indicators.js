// api/indicators.js - Цэвэр математик тооцооллын сан

export function calculateRSI(closes, period = 14) {
    if (closes.length <= period) return new Array(closes.length).fill(null);
    
    let results = new Array(closes.length).fill(null);
    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        let diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    results[period] = 100 - (100 / (1 + (avgGain / (avgLoss || 1))));

    for (let i = period + 1; i < closes.length; i++) {
        let diff = closes[i] - closes[i - 1];
        let gain = diff >= 0 ? diff : 0;
        let loss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        results[i] = 100 - (100 / (1 + (avgGain / (avgLoss || 1))));
    }
    return results;
}

export function calculateEMA(closes, period) {
    if (closes.length < period) return new Array(closes.length).fill(null);
    const k = 2 / (period + 1);
    let ema = new Array(closes.length).fill(null);
    
    let sum = 0;
    for(let i=0; i<period; i++) sum += closes[i];
    ema[period-1] = sum / period;

    for (let i = period; i < closes.length; i++) {
        ema[i] = (closes[i] - ema[i - 1]) * k + ema[i - 1];
    }
    return ema;
}

export function calculateSMA(closes, period) {
    if (closes.length < period) return new Array(closes.length).fill(null);
    let sma = new Array(closes.length).fill(null);
    for (let i = period - 1; i < closes.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += closes[i - j];
        sma[i] = sum / period;
    }
    return sma;
}

export function calculatePivots(candles, leftRight = 10) {
    const highs = [], lows = [];
    if (!candles || candles.length < leftRight * 2) return { highs, lows };
    for (let i = leftRight; i < candles.length - leftRight; i++) {
        const high = parseFloat(candles[i][2]), low = parseFloat(candles[i][3]);
        let isHigh = true, isLow = true;
        for (let k = 1; k <= leftRight; k++) {
            if (parseFloat(candles[i - k][2]) > high || parseFloat(candles[i + k][2]) > high) isHigh = false;
            if (parseFloat(candles[i - k][3]) < low || parseFloat(candles[i + k][3]) < low) isLow = false;
        }
        if (isHigh) highs.push({ i, price: high });
        if (isLow) lows.push({ i, price: low });
    }
    return { highs, lows };
}