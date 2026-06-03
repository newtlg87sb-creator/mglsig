/**
 * ⚠️ WARNING: CONFIDENTIAL MATERIAL
 * --------------------------------------------------
 * THIS FILE (DATA.JS) CONTAINS PROPRIETARY ALGORITHMS AND SIGNAL LOGIC 
 * OWNED BY MGL SIGNAL. DO NOT SHARE, DISTRIBUTE, OR REPRODUCE 
 * WITHOUT EXPLICIT PERMISSION FROM THE OWNER.
 */

/**
 * DATA.JS - Signal Data Processing Engine
 * Энэ файл нь candle.js-ээс ирсэн түүхий датаг боловсруулж UI grid-ийг шинэчилнэ.
 */

// RSI тооцоолох туслах функц (Binance/Wilder's Smoothed Moving Average - RMA)
function calculateRSI(data, period = 7) {
    if (data.length <= period) return new Array(data.length).fill(null);
    
    const closes = data.map(d => Number(d[4]));
    let results = new Array(closes.length).fill(null);
    let gains = 0, losses = 0;

    // 1. Initial SMA (First average gain/loss)
    for (let i = 1; i <= period; i++) {
        let diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    results[period] = 100 - (100 / (1 + rs));

    // 2. Smoothed Moving Average (RMA) calculation
    for (let i = period + 1; i < data.length; i++) {
        let diff = closes[i] - closes[i - 1];
        let gain = diff >= 0 ? diff : 0;
        let loss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const currentRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
        results[i] = 100 - (100 / (1 + currentRS));
    }
    return results;
}

// EMA тооцоолох туслах функц
function calculateEMA(data, period) {
    if (data.length < period) return new Array(data.length).fill(null);
    const closes = data.map(d => Number(d[4]));
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

// SMA тооцоолох туслах функц
function calculateSMA(data, period) {
    if (data.length < period) return new Array(data.length).fill(null);
    const closes = data.map(d => Number(d[4]));
    let sma = new Array(closes.length).fill(null);
    
    for (let i = period - 1; i < closes.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += closes[i - j];
        }
        sma[i] = sum / period;
    }
    return sma;
}

// Pivot (Support/Resistance) тооцоолох туслах функц
function calculatePivots(data, leftRight = 10) {
    const highs = [];
    const lows = [];
    if (data.length < leftRight * 2) return { highs, lows };

    for (let i = leftRight; i < data.length - leftRight; i++) {
        const high = data[i][2];
        const low = data[i][3];
        let isHigh = true, isLow = true;
        for (let k = 1; k <= leftRight; k++) {
            if (data[i - k][2] > high || data[i + k][2] > high) isHigh = false;
            if (data[i - k][3] < low || data[i + k][3] < low) isLow = false;
        }
        if (isHigh) highs.push({ i, price: high });
        if (isLow) lows.push({ i, price: low });
    }
    return { highs, lows };
}

window.updateSignalData = function(allData) {
    if (!allData || allData.length === 0) return;

    // Глобал кэш үүсгэх (Индикаторуудыг overlay-д бэлдэж өгөх)
    window.mglIndicators = window.mglIndicators || {};

    // 1. Сүүлийн 3 лааны өгөгдлийг авах (Last, Prev, PrevPrev)
    const lastCandle = allData[allData.length - 1];
    const prevCandle = allData.length > 1 ? allData[allData.length - 2] : null;
    const prevPrevCandle = allData.length > 2 ? allData[allData.length - 3] : null;

    // Open Values
    const lastOpen = lastCandle[1], prevOpen = prevCandle ? prevCandle[1] : null, prevPrevOpen = prevPrevCandle ? prevPrevCandle[1] : null;
    // High Values
    const lastHigh = lastCandle[2], prevHigh = prevCandle ? prevCandle[2] : null, prevPrevHigh = prevPrevCandle ? prevPrevCandle[2] : null;
    // Low Values
    const lastLow = lastCandle[3], prevLow = prevCandle ? prevCandle[3] : null, prevPrevLow = prevPrevCandle ? prevPrevCandle[3] : null;
    // Close Values
    const lastClose = lastCandle[4], prevClose = prevCandle ? prevCandle[4] : null, prevPrevClose = prevPrevCandle ? prevPrevCandle[4] : null;

    const marketEl = document.getElementById('market');
    const spotDisplay = document.getElementById('spot-price-display');
    const futuresDisplay = document.getElementById('futures-price-display');

    if (!marketEl) return;

    const currentMarket = marketEl.value; // 'spot' or 'futures'

    const format = (val) => (val === null || val === undefined) ? '--' : (val >= 1 
        ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
        : val.toFixed(8));

    // UI-д босоо дарааллаар (0, -1, -2) харуулах логик
    const renderTriple = (v0, v1, v2) => {
        return `
            <div class="flex flex-col gap-1.5 w-full font-mono mt-1">
                <div class="flex justify-between items-center bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    <span class="text-[9px] text-brand-gold font-black opacity-60">0</span>
                    <span class="text-[11px] text-white font-black">${format(v0)}</span>
                </div>
                <div class="flex justify-between items-center px-2 py-0.5">
                    <span class="text-[9px] text-gray-500 font-bold">-1</span>
                    <span class="text-[10px] text-gray-400 font-medium">${format(v1)}</span>
                </div>
                <div class="flex justify-between items-center px-2 py-0.5">
                    <span class="text-[9px] text-gray-700 font-bold">-2</span>
                    <span class="text-[10px] text-gray-600 font-medium">${format(v2)}</span>
                </div>
            </div>`;
    };

    if (document.getElementById('val-open')) document.getElementById('val-open').innerHTML = renderTriple(lastOpen, prevOpen, prevPrevOpen);
    if (document.getElementById('val-high')) document.getElementById('val-high').innerHTML = renderTriple(lastHigh, prevHigh, prevPrevHigh);
    if (document.getElementById('val-low')) document.getElementById('val-low').innerHTML = renderTriple(lastLow, prevLow, prevPrevLow);
    if (document.getElementById('val-close')) document.getElementById('val-close').innerHTML = renderTriple(lastClose, prevClose, prevPrevClose);

    // 2. RSI Sequence тооцоолж харуулах (Control-оос утгыг авна)
    const rsiPeriodInput = document.getElementById('rsi-period');
    const rsiPeriod = rsiPeriodInput ? parseInt(rsiPeriodInput.value) : 7;

    const rsiValues = calculateRSI(allData, rsiPeriod);
    window.mglIndicators.rsi = rsiValues; // Кэш рүү хадгалах

    const lastRSI = rsiValues[rsiValues.length - 1];
    const prevRSI = rsiValues[rsiValues.length - 2];
    const prevPrevRSI = rsiValues[rsiValues.length - 3];

    if (document.getElementById('rsi-display')) document.getElementById('rsi-display').innerHTML = renderTriple(lastRSI, prevRSI, prevPrevRSI);

    // 3. RSI Logic Engine (-2 болон -1 лаа дээр суурилсан)
    
    // A. Immediate Cross Detection (Яг одоо болж буй огтлолцол - Зөвхөн нэг агшинд YES байна)
    const isNull = (v) => v === null || v === undefined;
    const rsi30UpImm = (!isNull(prevPrevRSI) && !isNull(prevRSI) && prevPrevRSI < 30 && prevRSI > 30) ? "YES" : "NO";
    const rsi30DownImm = (!isNull(prevPrevRSI) && !isNull(prevRSI) && prevPrevRSI > 30 && prevRSI < 30) ? "YES" : "NO";
    const rsi70UpImm = (!isNull(prevPrevRSI) && !isNull(prevRSI) && prevPrevRSI < 70 && prevRSI > 70) ? "YES" : "NO";
    const rsi70DownImm = (!isNull(prevPrevRSI) && !isNull(prevRSI) && prevPrevRSI > 70 && prevRSI < 70) ? "YES" : "NO";

    // B. State Machine (Хамгийн сүүлийн төлөвийг түүхээс хайж олох - Солигдох хүртлээ хадгалагдана)
    let activeState = null;
    
    // Түүхээс урагш хайж хамгийн сүүлийн баталгаатай огтлолцлыг олно
    for (let i = rsiValues.length - 2; i >= 1; i--) {
        const v1 = rsiValues[i];     
        const v2 = rsiValues[i - 1]; 
        if (v1 === null || v2 === null) continue;

        if (v2 < 30 && v1 > 30) { activeState = '30 UP'; break; }
        if (v2 > 30 && v1 < 30) { activeState = '30 DOWN'; break; }
        if (v2 < 70 && v1 > 70) { activeState = '70 UP'; break; }
        if (v2 > 70 && v1 < 70) { activeState = '70 DOWN'; break; }
    }

    // C. UI Update (Immediate Cross Indicators)
    const updateCrossUI = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = val;
            if (val === "YES") {
                el.className = `value font-black ${id.includes('up') ? 'text-green-500' : 'text-red-500'} animate-pulse`;
            } else {
                el.className = "value text-gray-700 opacity-20";
            }
        }
    };

    updateCrossUI('val-rsi-30-up-cross', rsi30UpImm);
    updateCrossUI('val-rsi-30-down-cross', rsi30DownImm);
    updateCrossUI('val-rsi-70-up-cross', rsi70UpImm);
    updateCrossUI('val-rsi-70-down-cross', rsi70DownImm);

    // D. Update Persistent Status Display
    const statusEl = document.getElementById('rsi-status');
    if (statusEl) {
        statusEl.textContent = activeState || "SCANNING...";
        statusEl.className = `value font-black ${activeState?.includes('UP') ? 'text-green-500' : 'text-red-500'}`;
    }

    // Extra RSI metadata
    if (document.getElementById('val-rsi-prev')) document.getElementById('val-rsi-prev').textContent = format(prevRSI);
    if (document.getElementById('val-rsi-before-prev')) document.getElementById('val-rsi-before-prev').textContent = format(prevPrevRSI);

    // 3. EMA Sequence тооцоолж харуулах (Control-оос утгыг авна)
    const emaPeriodInput = document.getElementById('ema-period');
    const emaPeriod = emaPeriodInput ? parseInt(emaPeriodInput.value) : 20;

    const emaValues = calculateEMA(allData, emaPeriod);
    const lastEMA = emaValues[emaValues.length - 1];
    const prevEMA = emaValues[emaValues.length - 2];
    const prevPrevEMA = emaValues[emaValues.length - 3];

    if (document.getElementById('ema-display')) document.getElementById('ema-display').innerHTML = renderTriple(lastEMA, prevEMA, prevPrevEMA);

    // 4. SMA Sequence тооцоолж харуулах (Control-оос утгыг авна)
    const maPeriodInput = document.getElementById('ma-period');
    const maPeriod = maPeriodInput ? parseInt(maPeriodInput.value) : 20;

    const maValues = calculateSMA(allData, maPeriod);
    window.mglIndicators.ma = maValues; // Кэш рүү хадгалах

    const lastMA = maValues[maValues.length - 1];
    const prevMA = maValues[maValues.length - 2];
    const prevPrevMA = maValues[maValues.length - 3];

    if (document.getElementById('ma-display')) document.getElementById('ma-display').innerHTML = renderTriple(lastMA, prevMA, prevPrevMA);

    // 5. Pivot Points (S/R) тооцоолж кэшлэх
    const pivots = calculatePivots(allData, 10);
    window.mglIndicators.pivots = pivots;

    // Сүүлийн 3 HH болон LL-ийг Sequence болгож харуулах
    const last3Highs = pivots.highs.slice(-3).reverse();
    const last3Lows = pivots.lows.slice(-3).reverse();

    if (document.getElementById('val-hh')) document.getElementById('val-hh').innerHTML = renderTriple(last3Highs[0]?.price, last3Highs[1]?.price, last3Highs[2]?.price);
    if (document.getElementById('val-ll')) document.getElementById('val-ll').innerHTML = renderTriple(last3Lows[0]?.price, last3Lows[1]?.price, last3Lows[2]?.price);

    const formattedPrice = format(lastClose);
    if (currentMarket === 'spot') {
        if (spotDisplay) spotDisplay.textContent = `$${formattedPrice}`;
        if (futuresDisplay) futuresDisplay.textContent = '--';
    } else {
        if (futuresDisplay) futuresDisplay.textContent = `$${formattedPrice}`;
        if (spotDisplay) spotDisplay.textContent = '--';
    }

    // ── PAGE SPECIFIC SIGNAL HOOK ──
    if (typeof window.onSignalUpdate === 'function') {
        window.onSignalUpdate(allData);
    }
};