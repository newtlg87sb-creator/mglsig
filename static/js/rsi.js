



// ==================== RSI ARRAY & SERIES (Wilder's Smoothing) ====================
function calculateRsiArray(klines, window = 7) {
    if (!klines || klines.length === 0) {
        throw new Error("Kline data is empty");
    }
    let closes = klines.map(k => Number(k[4]));
    let win = Number(window);

    let deltas = [];
    for (let i = 1; i < closes.length; i++) {
        deltas.push(closes[i] - closes[i - 1]);
    }
    let gains = deltas.map(d => d > 0 ? d : 0);
    let losses = deltas.map(d => d < 0 ? -d : 0);

    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < win; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
    }
    avgGain /= win;
    avgLoss /= win;

    let rsiArrayFull = new Array(closes.length).fill(NaN);
    if (avgLoss === 0) {
        rsiArrayFull[win] = 100;
    } else {
        let rs = avgGain / avgLoss;
        rsiArrayFull[win] = 100 - (100 / (1 + rs));
    }

    for (let i = win + 1; i < closes.length; i++) {
        let gain = gains[i - 1];
        let loss = losses[i - 1];
        avgGain = (avgGain * (win - 1) + gain) / win;
        avgLoss = (avgLoss * (win - 1) + loss) / win;
        if (avgLoss === 0) {
            rsiArrayFull[i] = 100;
        } else {
            let rs = avgGain / avgLoss;
            rsiArrayFull[i] = 100 - (100 / (1 + rs));
        }
    }

    return rsiArrayFull.filter(v => !isNaN(v));
}

// ==================== RSI STATES ====================
function calculateRsiStates(klines, window = 7) {
    let rsi_series = calculateRsiArray(klines, window);
    if (rsi_series.length < 5) {
        return { "cross_history": {} };
    }

    let offset = klines.length - rsi_series.length;
    let price_history = {
        "rsi_30_up": [], "rsi_30_down": [],
        "rsi_70_up": [], "rsi_70_down": []
    };
    let time_history = {
        "rsi_30_up": [], "rsi_30_down": [],
        "rsi_70_up": [], "rsi_70_down": []
    };

    for (let index = rsi_series.length - 2; index > 2; index--) {
        let previous_rsi = Number(rsi_series[index - 1]);
        let current_rsi = Number(rsi_series[index]);
        let window_klines = klines.slice(index + offset - 3, index + offset + 1);
        let opens = window_klines.map(k => Number(k[1]));
        if (opens.length < 4) continue;

        let matched_time = _formatTimeGmt8(klines[index + offset][0]);
        if (previous_rsi <= 30 && current_rsi > 30) {
            price_history.rsi_30_up.push(Math.min(...opens));
            time_history.rsi_30_up.push(matched_time);
        } else if (previous_rsi >= 30 && current_rsi < 30) {
            price_history.rsi_30_down.push(Math.max(...opens));
            time_history.rsi_30_down.push(matched_time);
        } else if (previous_rsi <= 70 && current_rsi > 70) {
            price_history.rsi_70_up.push(Math.min(...opens));
            time_history.rsi_70_up.push(matched_time);
        } else if (previous_rsi >= 70 && current_rsi < 70) {
            price_history.rsi_70_down.push(Math.max(...opens));
            time_history.rsi_70_down.push(matched_time);
        }
    }

    let cross_history = {
        "s30u": price_history.rsi_30_up[0] !== undefined ? price_history.rsi_30_up[0] : null,
        "s30u_time": time_history.rsi_30_up[0] !== undefined ? time_history.rsi_30_up[0] : null,
        "s30u_prev": price_history.rsi_30_up[1] !== undefined ? price_history.rsi_30_up[1] : null,
        "s30u_prev_time": time_history.rsi_30_up[1] !== undefined ? time_history.rsi_30_up[1] : null,
        "s30d": price_history.rsi_30_down[0] !== undefined ? price_history.rsi_30_down[0] : null,
        "s30d_time": time_history.rsi_30_down[0] !== undefined ? time_history.rsi_30_down[0] : null,
        "s30d_prev": price_history.rsi_30_down[1] !== undefined ? price_history.rsi_30_down[1] : null,
        "s30d_prev_time": time_history.rsi_30_down[1] !== undefined ? time_history.rsi_30_down[1] : null,
        "s70u": price_history.rsi_70_up[0] !== undefined ? price_history.rsi_70_up[0] : null,
        "s70u_time": time_history.rsi_70_up[0] !== undefined ? time_history.rsi_70_up[0] : null,
        "s70u_prev": price_history.rsi_70_up[1] !== undefined ? price_history.rsi_70_up[1] : null,
        "s70u_prev_time": time_history.rsi_70_up[1] !== undefined ? time_history.rsi_70_up[1] : null,
        "s70d": price_history.rsi_70_down[0] !== undefined ? price_history.rsi_70_down[0] : null,
        "s70d_time": time_history.rsi_70_down[0] !== undefined ? time_history.rsi_70_down[0] : null,
        "s70d_prev": price_history.rsi_70_down[1] !== undefined ? price_history.rsi_70_down[1] : null,
        "s70d_prev_time": time_history.rsi_70_down[1] !== undefined ? time_history.rsi_70_down[1] : null,
    };

    return { "cross_history": cross_history };
}