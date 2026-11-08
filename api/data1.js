/**
 * MGL Signal - Quantitative Trading & Technical Analysis Engine (JavaScript Port)
 * Python data.py файлын логикийг бүрэн орлох JavaScript сан.
 */

// --- GMT+8 Цагийн форматлагч ---
function _formatTimeGmt8(timestamp) {
    if (timestamp === null || timestamp === undefined) return null;
    let num = Number(timestamp);
    if (num < 1e12) num *= 1000; // Секундийг миллисекунд болгох
    let d = new Date(num);
    let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    let gmt8Date = new Date(utc + (3600000 * 8));
    
    let year = gmt8Date.getFullYear();
    let month = String(gmt8Date.getMonth() + 1).padStart(2, '0');
    let day = String(gmt8Date.getDate()).padStart(2, '0');
    let hours = String(gmt8Date.getHours()).padStart(2, '0');
    let minutes = String(gmt8Date.getMinutes()).padStart(2, '0');
    let seconds = String(gmt8Date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// --- EMA (Exponential Moving Average) Туслах функц ---
function calculateEMA(data, span) {
    let k = 2 / (span + 1);
    let emaArray = [];
    let prevEMA = data[0];
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            prevEMA = data[0];
        } else {
            prevEMA = (data[i] * k) + (prevEMA * (1 - k));
        }
        emaArray.push(prevEMA);
    }
    return emaArray;
}

// --- Нэгдсэн MACD цуваа тооцоолох ---
function _calculateMacdSeries(klines, fast = 12, slow = 26, signal = 9) {
    if (!klines || klines.length === 0) {
        throw new Error("Kline data is empty");
    }
    let closes = klines.map(k => Number(k[4]));
    let fastEma = calculateEMA(closes, Number(fast));
    let slowEma = calculateEMA(closes, Number(slow));
    let macdLine = fastEma.map((v, i) => v - slowEma[i]);
    let macdSignal = calculateEMA(macdLine, Number(signal));
    let macdHistogram = macdLine.map((v, i) => v - macdSignal[i]);
    return { macdLine, macdSignal, macdHistogram };
}

// ==================== MACD VALUES ====================
function calculateMacdValues(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine, macdSignal, macdHistogram } = _calculateMacdSeries(klines, fast, slow, signal);
    if (macdLine.length < 5) {
        throw new Error("At least five MACD values are required");
    }
    let n = macdLine.length;
    return {
        "latest_macd_line": macdLine[n - 1].toFixed(8),
        "previous_macd_line": macdLine[n - 2].toFixed(8),
        "previous_2_macd_line": macdLine[n - 3].toFixed(8),
        "previous_3_macd_line": macdLine[n - 4].toFixed(8),
        "previous_4_macd_line": macdLine[n - 5].toFixed(8),
        "latest_macd_signal": macdSignal[n - 1].toFixed(8),
        "previous_macd_signal": macdSignal[n - 2].toFixed(8),
        "previous_2_macd_signal": macdSignal[n - 3].toFixed(8),
        "previous_3_macd_signal": macdSignal[n - 4].toFixed(8),
        "previous_4_macd_signal": macdSignal[n - 5].toFixed(8),
        "latest_macd_histogram": macdHistogram[n - 1].toFixed(8),
        "previous_macd_histogram": macdHistogram[n - 2].toFixed(8),
        "previous_2_macd_histogram": macdHistogram[n - 3].toFixed(8),
        "previous_3_macd_histogram": macdHistogram[n - 4].toFixed(8),
        "previous_4_macd_histogram": macdHistogram[n - 5].toFixed(8),
    };
}

// ==================== MACD CROSS ====================
function calculateMacdCross(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine, macdSignal } = _calculateMacdSeries(klines, fast, slow, signal);
    if (macdLine.length < 3) {
        throw new Error("At least three MACD values are required");
    }
    let n = macdLine.length;
    let prevMacdLine = macdLine[n - 2];
    let prev2MacdLine = macdLine[n - 3];
    let prevMacdSignal = macdSignal[n - 2];
    let prev2MacdSignal = macdSignal[n - 3];
    return {
        "macd_upcross": Boolean(prev2MacdLine <= prev2MacdSignal && prevMacdLine > prevMacdSignal),
        "macd_downcross": Boolean(prev2MacdLine >= prev2MacdSignal && prevMacdLine < prevMacdSignal),
    };
}

// ==================== MACD STATE ====================
function calculateMacdState(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine, macdSignal } = _calculateMacdSeries(klines, fast, slow, signal);
    let n = macdLine.length;
    let prevMacdLine = macdLine[n - 2];
    let prevMacdSignal = macdSignal[n - 2];
    return {
        "macd_line_up": Boolean(prevMacdLine > 0),
        "macd_line_down": Boolean(prevMacdLine < 0),
        "macd_up": Boolean(prevMacdLine > prevMacdSignal),
        "macd_down": Boolean(prevMacdLine < prevMacdSignal),
    };
}

// ==================== MACD TREND ====================
function calculateMacdTrend(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine, macdSignal } = _calculateMacdSeries(klines, fast, slow, signal);
    if (macdLine.length < 3) {
        throw new Error("At least three MACD values are required");
    }
    let trend = "None";
    for (let index = macdLine.length - 2; index >= 1; index--) {
        if (macdLine[index - 1] <= macdSignal[index - 1] && macdLine[index] > macdSignal[index]) {
            trend = "UP";
            break;
        }
        if (macdLine[index - 1] >= macdSignal[index - 1] && macdLine[index] < macdSignal[index]) {
            trend = "DOWN";
            break;
        }
    }
    return { "macd_trend": trend };
}

// ==================== MACD PEAKS ====================
function calculateMacdPeaks(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine } = _calculateMacdSeries(klines, fast, slow, signal);
    let offset = klines.length - macdLine.length;

    function pointAt(index) {
        let klineIndex = index + offset;
        if (klineIndex < 0 || klineIndex >= klines.length) return null;
        return {
            "macd_value": Number(macdLine[index]),
            "price": Number(klines[klineIndex][1]),
            "time": _formatTimeGmt8(klines[klineIndex][0]),
        };
    }

    let macd_peak = { "macd_value": 0.0, "price": 0.0 };
    let macd_trough = { "macd_value": 0.0, "price": 0.0 };
    let active_peak = null;
    let active_trough = null;
    let last_peak = null;
    let last_trough = null;
    let closed_length = Math.max(0, macdLine.length - 1);

    for (let index = 0; index < closed_length; index++) {
        let value = Number(macdLine[index]);
        let previous = index > 0 ? Number(macdLine[index - 1]) : 0.0;
        let point = pointAt(index);

        if (previous >= 0 && value < 0) {
            if (active_peak !== null) {
                macd_peak = { "macd_value": active_peak.macd_value, "price": active_peak.price };
            }
            active_peak = null;
            active_trough = point;
        } else if (previous <= 0 && value > 0) {
            if (active_trough !== null) {
                macd_trough = { "macd_value": active_trough.macd_value, "price": active_trough.price };
            }
            active_trough = null;
            active_peak = point;
        } else if (value > 0) {
            if (active_peak === null || point.macd_value > active_peak.macd_value) {
                active_peak = point;
            }
        } else if (value < 0) {
            if (active_trough === null || point.macd_value < active_trough.macd_value) {
                active_trough = point;
            }
        }
    }

    let latest_closed = macdLine.length > 1 ? Number(macdLine[macdLine.length - 2]) : null;
    if (latest_closed !== null && latest_closed > 0) {
        last_peak = active_peak;
    } else if (latest_closed !== null && latest_closed < 0) {
        last_trough = active_trough;
    }

    return {
        "macd_peak": macd_peak,
        "macd_trough": macd_trough,
        "last_peak": last_peak,
        "last_trough": last_trough,
    };
}

// ==================== MACD AVERAGE ====================
function calculateMacdAverage(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine } = _calculateMacdSeries(klines, fast, slow, signal);
    if (macdLine.length < 4) {
        throw new Error("At least four MACD values are required");
    }
    let values = macdLine.slice(Math.max(0, macdLine.length - 5), macdLine.length - 1).map(Number);
    let peaks = calculateMacdPeaks(klines, fast, slow, signal);
    let peak_value = peaks.macd_peak.macd_value;
    let trough_value = peaks.macd_trough.macd_value;
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    return {
        "macd_min": minVal.toFixed(8),
        "macd_max": maxVal.toFixed(8),
        "macd_average": ((peak_value + trough_value) / 2.0).toFixed(8),
    };
}

// ==================== MACD LIMITS ====================
function calculateMacdLimits(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine, macdSignal } = _calculateMacdSeries(klines, fast, slow, signal);
    if (macdLine.length < 5) {
        throw new Error("At least five MACD values are required");
    }

    let up_limit = null;
    let down_limit = null;
    let up_cross_line = null;
    let down_cross_line = null;

    for (let index = macdLine.length - 2; index > 2; index--) {
        let previous_macd_line = macdLine[index];
        let previous_2_macd_line = macdLine[index - 1];
        let previous_macd_signal = macdSignal[index];
        let previous_2_macd_signal = macdSignal[index - 1];
        let windowSlice = macdLine.slice(index - 3, index + 1);

        if (up_limit === null && previous_macd_line > previous_macd_signal && previous_2_macd_line < previous_2_macd_signal) {
            up_limit = Math.min(...windowSlice);
            up_cross_line = Number(previous_macd_line);
        }
        if (down_limit === null && previous_macd_line < previous_macd_signal && previous_2_macd_line > previous_2_macd_signal) {
            down_limit = Math.max(...windowSlice);
            down_cross_line = Number(previous_macd_line);
        }
        if (up_limit !== null && down_limit !== null) {
            break;
        }
    }

    return {
        "macd_uplimit": up_limit,
        "macd_downlimit": down_limit,
        "uplimit_cross_line": up_cross_line,
        "downlimit_cross_line": down_cross_line,
    };
}

// ==================== MACD INITIAL CROSSES ====================
function calculateMacdInitialCrosses(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine, macdSignal } = _calculateMacdSeries(klines, fast, slow, signal);
    let offset = klines.length - macdLine.length;
    let macd_initial_up = null;
    let macd_initial_down = null;
    let signal_initial_up = null;
    let signal_initial_down = null;

    for (let index = macdLine.length - 2; index > 0; index--) {
        let previous_macd_line = macdLine[index];
        let previous_2_macd_line = macdLine[index - 1];
        let previous_macd_signal = macdSignal[index];
        let previous_2_macd_signal = macdSignal[index - 1];
        let kline_index = index + offset;
        if (kline_index < 0 || kline_index >= klines.length) continue;

        let item = {
            "price": Number(klines[kline_index][1]),
            "time": _formatTimeGmt8(klines[kline_index][0]),
        };
        if (macd_initial_up === null && previous_2_macd_line < 0 && previous_macd_line > 0) {
            macd_initial_up = item;
        }
        if (macd_initial_down === null && previous_2_macd_line > 0 && previous_macd_line < 0) {
            macd_initial_down = item;
        }
        if (signal_initial_up === null && previous_2_macd_signal < 0 && previous_macd_signal > 0) {
            signal_initial_up = item;
        }
        if (signal_initial_down === null && previous_2_macd_signal > 0 && previous_macd_signal < 0) {
            signal_initial_down = item;
        }
        if (macd_initial_up !== null && macd_initial_down !== null && signal_initial_up !== null && signal_initial_down !== null) {
            break;
        }
    }

    return {
        "macd_initial_up_price": macd_initial_up ? macd_initial_up.price : null,
        "macd_initial_up_time": macd_initial_up ? macd_initial_up.time : null,
        "macd_initial_down_price": macd_initial_down ? macd_initial_down.price : null,
        "macd_initial_down_time": macd_initial_down ? macd_initial_down.time : null,
        "signal_initial_up_price": signal_initial_up ? signal_initial_up.price : null,
        "signal_initial_up_time": signal_initial_up ? signal_initial_up.time : null,
        "signal_initial_down_price": signal_initial_down ? signal_initial_down.price : null,
        "signal_initial_down_time": signal_initial_down ? signal_initial_down.time : null,
    };
}

// ==================== CUMULATIVE WEIGHT ====================
function calculateCumulativeWeight(klines) {
    if (!klines || klines.length < 2) {
        throw new Error("At least two klines are required");
    }
    let total_weight = 0.0;
    let bar_weights = [];

    for (let kline of klines) {
        let open_price = Number(kline[1]);
        let close_price = Number(kline[4]);
        let weight = close_price - open_price;
        total_weight += weight;
        bar_weights.push(weight);
    }

    let latest_weight = bar_weights[bar_weights.length - 1];

    return {
        "latest_bar_weight": (latest_weight >= 0 ? "+" : "") + latest_weight.toFixed(2),
        "cumulative_weight": (total_weight >= 0 ? "+" : "") + total_weight.toFixed(2),
        "cumulative_weight_float": Number(total_weight),
        "is_positive": Boolean(total_weight > 0),
        "is_negative": Boolean(total_weight < 0),
    };
}

// ==================== ALL MACD INDICATORS ====================
function calculateAllMacdIndicators(klines, fast = 12, slow = 26, signal = 9) {
    return {
        ...calculateMacdValues(klines, fast, slow, signal),
        ...calculateMacdCross(klines, fast, slow, signal),
        ...calculateMacdState(klines, fast, slow, signal),
        ...calculateMacdTrend(klines, fast, slow, signal),
        ...calculateMacdAverage(klines, fast, slow, signal),
        ...calculateMacdLimits(klines, fast, slow, signal),
        ...calculateMacdInitialCrosses(klines, fast, slow, signal),
        ...calculateMacdPeaks(klines, fast, slow, signal),
        ...calculateCumulativeWeight(klines),
    };
}

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

function calculateRsiValues(klines, window = 7) {
    let rsi_series = calculateRsiArray(klines, window);
    if (rsi_series.length < 4) {
        throw new Error("At least four RSI values are required");
    }
    let n = rsi_series.length;
    return {
        "rsi0": Number(rsi_series[n - 1]),
        "rsi1": Number(rsi_series[n - 2]),
        "rsi2": Number(rsi_series[n - 3]),
        "rsi3": Number(rsi_series[n - 4]),
    };
}

// ==================== RSI CROSS ====================
function calculateRsiCross(klines, window = 7) {
    let rsi_series = calculateRsiArray(klines, window);
    if (rsi_series.length < 4) {
        throw new Error("At least four RSI values are required");
    }
    let n = rsi_series.length;
    let rsi1 = Number(rsi_series[n - 2]);
    let rsi2 = Number(rsi_series[n - 3]);

    return {
        "30_up": (rsi2 <= 30 && rsi1 > 30) ? "UP" : "--",
        "70_up": (rsi2 <= 70 && rsi1 > 70) ? "UP" : "--",
        "30_down": (rsi2 >= 30 && rsi1 < 30) ? "DOWN" : "--",
        "70_down": (rsi2 >= 70 && rsi1 < 70) ? "DOWN" : "--",
    };
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

// ==================== RSI LAST STATUS ====================
function calculateRsiLaststatus(klines, window = 7) {
    let rsi_series = calculateRsiArray(klines, window);
    if (rsi_series.length < 4) {
        return { "last_status": "None", "last_status_time": null };
    }

    let offset = klines.length - rsi_series.length;
    for (let index = rsi_series.length - 2; index > 0; index--) {
        let previous_rsi = Number(rsi_series[index - 1]);
        let current_rsi = Number(rsi_series[index]);
        let status_time = _formatTimeGmt8(klines[index + offset][0]);

        if (previous_rsi <= 30 && current_rsi > 30) return { "last_status": "30U", "last_status_time": status_time };
        if (previous_rsi >= 30 && current_rsi < 30) return { "last_status": "30D", "last_status_time": status_time };
        if (previous_rsi <= 70 && current_rsi > 70) return { "last_status": "70U", "last_status_time": status_time };
        if (previous_rsi >= 70 && current_rsi < 70) return { "last_status": "70D", "last_status_time": status_time };
    }

    return { "last_status": "None", "last_status_time": null };
}

// ==================== RSI TREND ====================
function calculateRsiTrend(klines, window = 7) {
    let rsi_series = calculateRsiArray(klines, window);
    if (rsi_series.length < 4) {
        return { "trend": "None" };
    }

    let trend_status_history = [];
    for (let index = rsi_series.length - 2; index > 0; index--) {
        let previous_rsi = Number(rsi_series[index - 1]);
        let current_rsi = Number(rsi_series[index]);
        let status = null;

        if (previous_rsi <= 30 && current_rsi > 30) status = "30U";
        else if (previous_rsi >= 30 && current_rsi < 30) status = "30D";
        else if (previous_rsi <= 50 && current_rsi > 50) status = "50U";
        else if (previous_rsi >= 50 && current_rsi < 50) status = "50D";
        else if (previous_rsi <= 70 && current_rsi > 70) status = "70U";
        else if (previous_rsi >= 70 && current_rsi < 70) status = "70D";

        if (status && (trend_status_history.length === 0 || trend_status_history[0] !== status)) {
            trend_status_history.unshift(status);
        }
    }

    let trend = "None";
    for (let index = trend_status_history.length - 1; index > 0; index--) {
        let current_status = trend_status_history[index];
        let previous_status = trend_status_history[index - 1];
        if (previous_status === "30U" && current_status === "50U") { trend = "uptrand1"; break; }
        if (previous_status === "50U" && current_status === "70U") { trend = "uptrand2"; break; }
        if (previous_status === "70D" && current_status === "50D") { trend = "downtrand1"; break; }
        if (previous_status === "50D" && current_status === "30D") { trend = "downtrand2"; break; }
    }

    return { "trend": trend };
}

// ==================== RSI AVERAGE ====================
function calculateRsiAverage(klines, window = 7) {
    let rsi_series = calculateRsiArray(klines, window);
    if (rsi_series.length < 4) {
        return { "average_status": null };
    }

    let offset = klines.length - rsi_series.length;
    let price_history = {
        "rsi_30_up": [], "rsi_30_down": [],
        "rsi_70_up": [], "rsi_70_down": []
    };

    for (let index = rsi_series.length - 2; index > 2; index--) {
        let previous_rsi = Number(rsi_series[index - 1]);
        let current_rsi = Number(rsi_series[index]);
        let window_klines = klines.slice(index + offset - 3, index + offset + 1);
        let opens = window_klines.map(k => Number(k[1]));

        if (previous_rsi <= 30 && current_rsi > 30) price_history.rsi_30_up.push(Math.min(...opens));
        if (previous_rsi >= 30 && current_rsi < 30) price_history.rsi_30_down.push(Math.max(...opens));
        if (previous_rsi <= 70 && current_rsi > 70) price_history.rsi_70_up.push(Math.min(...opens));
        if (previous_rsi >= 70 && current_rsi < 70) price_history.rsi_70_down.push(Math.max(...opens));
    }

    let s30u = price_history.rsi_30_up.length > 0 ? price_history.rsi_30_up[0] : null;
    let s70d = price_history.rsi_70_down.length > 0 ? price_history.rsi_70_down[0] : null;

    return {
        "average_status": (s30u !== null && s70d !== null) ? (s30u + s70d) / 2.0 : null,
    };
}

// ==================== ALL RSI INDICATORS ====================
function calculateAllRsiIndicators(klines, window = 7) {
    return {
        ...calculateRsiValues(klines, window),
        ...calculateRsiCross(klines, window),
        ...calculateRsiStates(klines, window),
        ...calculateRsiLaststatus(klines, window),
        ...calculateRsiTrend(klines, window),
        ...calculateRsiAverage(klines, window),
    };
}

// ==================== ADVANCED OHLC TRACKER ====================
function calculateOhlcTrackerReport(klines, symbol = "UNKNOWN", stateDict = {}) {
    if (!stateDict[symbol]) {
        stateDict[symbol] = {
            "last_openup_limit": null,
            "last_opendown_limit": null,
            "prev_openup": false,
            "prev_opendown": false,
        };
    }

    try {
        if (!klines || klines.length < 4) {
            return { "error": "Not enough kline data for OHLC tracker" };
        }

        let last_4 = klines.slice(-4);
        let index_keys = ["-3", "-2", "-1", "0"];
        let ohlc_dict = {};
        let ohlc_list_for_df = [];

        for (let i = 0; i < 4; i++) {
            let kline = last_4[i];
            let idx_key = index_keys[i];
            let candle_data = {
                "open": Number(kline[1]),
                "high": Number(kline[2]),
                "low": Number(kline[3]),
                "close": Number(kline[4]),
            };
            ohlc_dict[idx_key] = candle_data;
            ohlc_list_for_df.push(candle_data);
        }

        let opens = ohlc_list_for_df.map(c => c.open);
        let closes = ohlc_list_for_df.map(c => c.close);
        let highs = ohlc_list_for_df.map(c => c.high);
        let lows = ohlc_list_for_df.map(c => c.low);

        let min_open = Math.min(...opens);
        let max_open = Math.max(...opens);
        let min_close = Math.min(...closes);
        let max_close = Math.max(...closes);
        let max_high = Math.max(...highs);
        let min_low = Math.min(...lows);

        let open0 = ohlc_list_for_df[3].open;
        let open1 = ohlc_list_for_df[2].open;

        let openup = open0 > open1;
        let opendown = open0 < open1;

        let st = stateDict[symbol];

        if (openup && !st.prev_openup) {
            st.last_openup_limit = min_open;
        }
        if (opendown && !st.prev_opendown) {
            st.last_opendown_limit = max_open;
        }

        st.prev_openup = openup;
        st.prev_opendown = opendown;

        return {
            "symbol": symbol,
            "candle_open_0": ohlc_dict["0"] ? ohlc_dict["0"].open : 0,
            "candle_high_0": ohlc_dict["0"] ? ohlc_dict["0"].high : 0,
            "candle_low_0": ohlc_dict["0"] ? ohlc_dict["0"].low : 0,
            "candle_close_0": ohlc_dict["0"] ? ohlc_dict["0"].close : 0,
            "candle_open_1": ohlc_dict["-1"] ? ohlc_dict["-1"].open : 0,
            "candle_high_1": ohlc_dict["-1"] ? ohlc_dict["-1"].high : 0,
            "candle_low_1": ohlc_dict["-1"] ? ohlc_dict["-1"].low : 0,
            "candle_close_1": ohlc_dict["-1"] ? ohlc_dict["-1"].close : 0,
            "candle_open_2": ohlc_dict["-2"] ? ohlc_dict["-2"].open : 0,
            "candle_high_2": ohlc_dict["-2"] ? ohlc_dict["-2"].high : 0,
            "candle_low_2": ohlc_dict["-2"] ? ohlc_dict["-2"].low : 0,
            "candle_close_2": ohlc_dict["-2"] ? ohlc_dict["-2"].close : 0,
            "candle_open_3": ohlc_dict["-3"] ? ohlc_dict["-3"].open : 0,
            "candle_high_3": ohlc_dict["-3"] ? ohlc_dict["-3"].high : 0,
            "candle_low_3": ohlc_dict["-3"] ? ohlc_dict["-3"].low : 0,
            "candle_close_3": ohlc_dict["-3"] ? ohlc_dict["-3"].close : 0,
            "min_open": min_open,
            "max_open": max_open,
            "min_close": min_close,
            "max_close": max_close,
            "max_high": max_high,
            "min_low": min_low,
            "openup": openup,
            "opendown": opendown,
            "openup_limit": st.last_openup_limit,
            "opendown_limit": st.last_opendown_limit,
        };
    } catch (e) {
        return { "error": e.toString() };
    }
}

// ==================== MACD ARRAYS ====================
function calculateMacdArrays(klines, fast = 12, slow = 26, signal = 9) {
    let { macdLine, macdSignal, macdHistogram } = _calculateMacdSeries(klines, fast, slow, signal);
    return {
        "macd_line_array": macdLine.map(Number),
        "macd_signal_array": macdSignal.map(Number),
        "macd_histogram_array": macdHistogram.map(Number),
    };
}

function calculateIcebergCandleStates(klines, fast, slow, signal) {
    const states = new Array(klines.length).fill(null);
    let state = null;

    for (let index = 3; index < klines.length - 1; index++) {
        const closedKlines = klines.slice(0, index + 2);
        const {
            previous_macd_line,
            previous_2_macd_line,
        } = calculateMacdValues(closedKlines, fast, slow, signal);
        const { macd_peak, macd_trough } = calculateMacdPeaks(closedKlines, fast, slow, signal);
        const previous = Number(previous_macd_line);
        const previous2 = Number(previous_2_macd_line);
        const peak = Number(macd_peak.macd_value);
        const trough = Number(macd_trough.macd_value);

        const crossedUp = (previous > peak && previous2 < peak) ||
            (previous > trough && previous2 < trough);
        const crossedDown = (previous < peak && previous2 > peak) ||
            (previous < trough && previous2 > trough);

        if (crossedUp) state = 'up';
        else if (crossedDown) state = 'down';
        states[index] = state;
    }

    states[klines.length - 1] = state;
    return states;
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseApiKey = req.headers.apikey;
    if (!accessToken || !supabaseApiKey) {
        return res.status(401).json({ error: "Sign in to use Iceberg" });
    }
    if (!supabaseUrl) {
        console.error("[ICEBERG ACCESS ERROR] Supabase configuration is incomplete");
        return res.status(503).json({ error: "Iceberg access is temporarily unavailable" });
    }

    try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey: supabaseApiKey,
                Authorization: `Bearer ${accessToken}`
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!authResponse.ok) {
            return res.status(401).json({ error: "Your session has expired. Please sign in again." });
        }

        const user = await authResponse.json();
        if (!user.id) {
            return res.status(401).json({ error: "Unable to verify your account" });
        }

        const profileUrl = new URL("/rest/v1/User%20control", supabaseUrl);
        profileUrl.searchParams.set("id", `eq.${user.id}`);
        profileUrl.searchParams.set("select", "membership_type,membership_expires_at");
        const profileResponse = await fetch(profileUrl, {
            headers: {
                apikey: supabaseApiKey,
                Authorization: `Bearer ${accessToken}`
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!profileResponse.ok) {
            console.error("[ICEBERG ACCESS ERROR] Failed to load membership profile");
            return res.status(503).json({ error: "Unable to verify Iceberg access" });
        }

        const profiles = await profileResponse.json();
        const profile = Array.isArray(profiles) ? profiles[0] : null;
        const membershipType = String(profile?.membership_type || "").toLowerCase();
        const expiration = profile?.membership_expires_at ? Date.parse(profile.membership_expires_at) : null;
        const isExpired = expiration !== null && (!Number.isFinite(expiration) || expiration <= Date.now());
        if (!["alpha", "beta"].includes(membershipType) || isExpired) {
            return res.status(403).json({ error: "An active Beta or Alpha subscription is required to use Iceberg" });
        }
    } catch (error) {
        console.error("[ICEBERG ACCESS ERROR]", error.message);
        return res.status(503).json({ error: "Unable to verify Iceberg access" });
    }

    const { klines, fast = 12, slow = 26, signal = 9 } = req.body || {};
    if (!Array.isArray(klines) || klines.length < 5 || klines.length > 2000 ||
        klines.some(kline => !Array.isArray(kline) || kline.length < 6 ||
            ![0, 1, 2, 3, 4, 5].every(index => Number.isFinite(Number(kline[index]))))) {
        return res.status(400).json({ error: "Invalid candle data" });
    }

    const periods = [fast, slow, signal].map(Number);
    if (!periods.every(period => Number.isInteger(period) && period > 0 && period <= 500) ||
        periods[0] >= periods[1]) {
        return res.status(400).json({ error: "Invalid MACD periods" });
    }

    try {
        const states = calculateIcebergCandleStates(klines, ...periods);
        return res.status(200).json({ states });
    } catch (error) {
        console.error("[ICEBERG STRATEGY ERROR]", error);
        return res.status(500).json({ error: "Iceberg strategy calculation failed" });
    }
}