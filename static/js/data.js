let isFetchingSignal = false;
let lastFetchTime = 0;

window.updateSignalData = async function(allData) {
    // Throttle: 5 секундээс хурдан дахин хүсэлт явуулахгүй (Ачаалал бууруулна)
    const now = Date.now();
    if (isFetchingSignal || (now - lastFetchTime < 5000)) return;

    const coin = document.getElementById('coin')?.value || 'BTCUSDT';
    const interval = document.getElementById('interval')?.value || '1m';
    const market = document.getElementById('market')?.value || 'spot';
    const rsiLen = document.getElementById('rsi-period')?.value || 14;
    const emaLen = document.getElementById('ema-period')?.value || 20;
    const maLen = document.getElementById('ma-period')?.value || 20;

    try {
        isFetchingSignal = true;
        const res = await fetch(`/api/data?symbol=${coin}&interval=${interval}&rsiLen=${rsiLen}&emaLen=${emaLen}&maLen=${maLen}&market=${market}`);
        const data = await res.json();
        lastFetchTime = Date.now();

        if (data.error) {
            if (data.error === 'Region Blocked') console.error("Vercel Region is blocked by Binance. Check vercel.json");
            return;
        }

        // UI шинэчлэх
        renderToUI(data);
    } catch (e) {
        console.error("Signal API Fetch Failed");
    } finally {
        isFetchingSignal = false;
    }
};

function renderToUI(data) {
    const lastClose = data.prices.last;
    const formattedPrice = lastClose >= 1 ? lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : lastClose.toFixed(8);

    const marketEl = document.getElementById('market');
    const spotDisplay = document.getElementById('spot-price-display');
    const futuresDisplay = document.getElementById('futures-price-display');

    if (!marketEl) return;
    const currentMarket = marketEl.value; // 'spot' or 'futures'
    const format = (val) => (val === null || val === undefined) ? '--' : (Number(val) >= 1 
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

    if (document.getElementById('val-open')) document.getElementById('val-open').innerHTML = renderTriple(data.prices.open[0], data.prices.open[1], data.prices.open[2]);
    if (document.getElementById('val-high')) document.getElementById('val-high').innerHTML = renderTriple(data.prices.high[0], data.prices.high[1], data.prices.high[2]);
    if (document.getElementById('val-low')) document.getElementById('val-low').innerHTML = renderTriple(data.prices.low[0], data.prices.low[1], data.prices.low[2]);
    if (document.getElementById('val-close')) document.getElementById('val-close').innerHTML = renderTriple(data.prices.last, data.prices.prev, data.prices.prevPrev);
    
    if (document.getElementById('rsi-display')) document.getElementById('rsi-display').innerHTML = renderTriple(data.rsi[0], data.rsi[1], data.rsi[2]);
    if (document.getElementById('ema-display')) document.getElementById('ema-display').innerHTML = renderTriple(data.ema[0], data.ema[1], data.ema[2]);
    if (document.getElementById('ma-display')) document.getElementById('ma-display').innerHTML = renderTriple(data.ma[0], data.ma[1], data.ma[2]);
    
    if (document.getElementById('val-hh')) document.getElementById('val-hh').innerHTML = renderTriple(data.pivots.highs[0]?.price, data.pivots.highs[1]?.price, data.pivots.highs[2]?.price);
    if (document.getElementById('val-ll')) document.getElementById('val-ll').innerHTML = renderTriple(data.pivots.lows[0]?.price, data.pivots.lows[1]?.price, data.pivots.lows[2]?.price);

    // RSI Stats
    if (document.getElementById('val-rsi-prev')) document.getElementById('val-rsi-prev').textContent = format(data.rsi[1]);
    if (document.getElementById('val-rsi-before-prev')) document.getElementById('val-rsi-before-prev').textContent = format(data.rsi[2]);
    
    if (document.getElementById('rsi-status')) {
        let state = "NEUTRAL";
        if (data.rsi[0] > 70) state = "OVERBOUGHT";
        else if (data.rsi[0] < 30) state = "OVERSOLD";
        document.getElementById('rsi-status').textContent = state;
        document.getElementById('rsi-status').className = `value font-black ${state !== 'NEUTRAL' ? 'text-brand-gold' : 'text-gray-500'}`;
    }

    // SMA Cross Display
    const updateSMA = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        const price = data.prices.last;
        const status = price > val[0] ? "ABOVE" : "BELOW";
        el.textContent = status;
        el.className = `value font-black ${status === 'ABOVE' ? 'text-green-500' : 'text-red-500'}`;
    };
    updateSMA('val-sma20', data.sma.sma20);
    updateSMA('val-sma50', data.sma.sma50);
    updateSMA('val-sma200', data.sma.sma200);

    // Cross UI Update
    const updateC = (id, v) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = v;
        el.className = `value font-black ${v === "YES" ? (id.includes('up') ? 'text-green-500 animate-pulse' : 'text-red-500 animate-pulse') : 'text-gray-700 opacity-20'}`;
    };
    updateC('val-rsi-30-up-cross', data.signals.rsi30Up);
    updateC('val-rsi-70-down-cross', data.signals.rsi70Down);

    if (currentMarket === 'spot') {
        if (spotDisplay) spotDisplay.textContent = `$${formattedPrice}`;
        if (futuresDisplay) futuresDisplay.textContent = '--';
    } else {
        if (futuresDisplay) futuresDisplay.textContent = `$${formattedPrice}`;
        if (spotDisplay) spotDisplay.textContent = '--';
    }
}