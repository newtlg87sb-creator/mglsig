(function() {
    const currentScript = document.currentScript;
    if (!currentScript) return;

    const chartHTML = `
    <div id="chart-wrapper" class="relative w-full h-[600px] bg-[#05070a] border-y border-brand-border overflow-hidden">
        <canvas id="chart" class="block w-full h-full cursor-crosshair"></canvas>
    </div>
    `;
    currentScript.insertAdjacentHTML('beforebegin', chartHTML);
})();

// Глобал дата шинэчлэгч функц
window.dispatchChartUpdate = function(allData) {
    // Хэрэв data.js ачаалагдсан байвал функцийг нь дуудна
    if (typeof window.updateSignalData === 'function') {
        window.updateSignalData(allData);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById("chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let socket;

    const marketEl = document.getElementById("market");
    const intervalEl = document.getElementById("interval");
    const coinEl = document.getElementById("coin");

    let symbol = coinEl && coinEl.value ? coinEl.value.toUpperCase() : "BTCUSDT";
    let interval = intervalEl ? intervalEl.value : "1m";
    let allData = [];
    let visibleCount = 80;
    let offset = 0;
    const minVisible = 20, maxVisible = 200;
    let mouse = { x:null, y:null }, dragging = false, lastX = 0;
    let priceScale = 1, priceOffset = 0, draggingPrice = false, lastY = 0, lastPriceRange = 0, lastChartHeight = 0;

    function resize() {
        if (canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
        }
        draw();
    }
    window.addEventListener("resize", resize);
    setTimeout(resize, 100);

    function formatPrice(price) {
        if (price >= 100) return price.toFixed(2);
        if (price >= 1) return price.toFixed(4);
        return price.toFixed(6);
    }

    async function fetchCandles() {
        if (!marketEl || !coinEl) return;
        if (!symbol) symbol = "BTCUSDT";
        let url = marketEl.value === "futures" 
            ? `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500`
            : `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`;
        try {
            const res = await fetch(url);
            allData = (await res.json()).map(d => [Number(d[0]), Number(d[1]), Number(d[2]), Number(d[3]), Number(d[4]), Number(d[5])]);
            draw();
            window.dispatchChartUpdate(allData); // Анхны ачаалалтаар датаг илгээх
            startWebSocket();
        } catch (e) { console.error("Error fetching candles:", e); }
    }

    function draw() {
        if (!allData || !allData.length) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isMobile = window.innerWidth < 768;
        const padding = isMobile ? 15 : 40;
        const priceScaleWidth = isMobile ? 55 : 80;
        const timeScaleHeight = isMobile ? 20 : 30;

        const chartHeight = canvas.height - padding * 2 - timeScaleHeight;
        lastChartHeight = chartHeight;
        const chartWidth = canvas.width - padding * 2 - priceScaleWidth;
        const end = allData.length - offset;
        const start = Math.max(0, end - visibleCount);
        const data = allData.slice(start, end);
        if (!data.length) return;
        const prices = data.flatMap(d => [d[2], d[3]]);
        let maxPrice = Math.max(...prices), minPrice = Math.min(...prices);
        if (priceScale !== 1) {
            const mid = (maxPrice + minPrice) / 2;
            const halfRange = (maxPrice - minPrice) / 2 * priceScale;
            maxPrice = mid + halfRange; minPrice = mid - halfRange;
        }
        lastPriceRange = maxPrice - minPrice;
        maxPrice += priceOffset; minPrice += priceOffset;
        const priceToY = p => padding + (maxPrice - p) / (maxPrice - minPrice) * chartHeight;
        const yToPrice = y => maxPrice - ((y - padding) / chartHeight) * (maxPrice - minPrice);
        const candleWidth = chartWidth / data.length;

        // Grid & Ticks
        ctx.font = isMobile ? "9px Arial" : "12px Arial"; ctx.strokeStyle = "#1f2630"; ctx.fillStyle = "#aaa";
        for (let i = 0; i <= 6; i++) {
            const price = minPrice + (i / 6) * (maxPrice - minPrice);
            const y = priceToY(price);
            ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + chartWidth, y); ctx.stroke();
            ctx.fillText(formatPrice(price), padding + chartWidth + 5, y + 4);
        }

        // ── TIME GRID (Цагийн хуваарь нэмэв) ──
        const numTicks = Math.max(2, Math.floor(chartWidth / 100));
        const step = Math.ceil(data.length / numTicks);
        ctx.textAlign = "center";

        for (let i = 0; i < data.length; i += step) {
            const x = padding + i * candleWidth + candleWidth / 2;
            const ts = data[i][0];
            const date = new Date(ts);
            
            let label;
            if (interval.endsWith('d') || interval.endsWith('w') || interval.endsWith('M')) {
                label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
            } else if (interval === '1s') {
                label = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0') + ':' + date.getSeconds().toString().padStart(2, '0');
            } else {
                label = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
            }

            ctx.strokeStyle = "#1f2630";
            ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, padding + chartHeight); ctx.stroke();
            
            ctx.fillStyle = "#aaa";
            ctx.fillText(label, x, padding + chartHeight + (isMobile ? 15 : 20));
        }
        ctx.textAlign = "left";

        data.forEach((d, i) => {
            const open = d[1], high = d[2], low = d[3], close = d[4];
            const x = padding + i * candleWidth, yO = priceToY(open), yC = priceToY(close), yH = priceToY(high), yL = priceToY(low);
            const bull = close >= open;
            const grd = ctx.createLinearGradient(x, yH, x, yL);
            if (bull) { grd.addColorStop(0, "#3ee69b"); grd.addColorStop(1, "#0ecb81"); }
            else { grd.addColorStop(0, "#ffffff"); grd.addColorStop(1, "#ffffff"); }
            ctx.fillStyle = grd; ctx.strokeStyle = bull ? "#0ecb81" : "#ffffff";
            ctx.shadowColor = bull ? "#0ecb81" : "#ffffff"; ctx.shadowBlur = 1;
            ctx.beginPath(); ctx.moveTo(x + candleWidth / 2, yH); ctx.lineTo(x + candleWidth / 2, yL); ctx.stroke();
            ctx.fillRect(x + candleWidth * 0.2, Math.min(yO, yC), candleWidth * 0.6, Math.max(1, Math.abs(yO - yC)));
            ctx.shadowBlur = 0;
        });

        // Current price line
        const lastClose = data[data.length - 1][4];
        const yLast = priceToY(lastClose);
        ctx.setLineDash([5, 5]); ctx.strokeStyle = "#f0b90b";
        ctx.beginPath(); ctx.moveTo(padding, yLast); ctx.lineTo(padding + chartWidth, yLast); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "#f0b90b";
        ctx.fillText(formatPrice(lastClose), padding + chartWidth + 5, yLast - 4);

        // ── СИГНАЛЫН ХӨГЖҮҮЛЭГЧИД ЗОРИУЛСАН HOOK ──
        if (typeof window.onChartDrawOverlay === 'function') {
            window.onChartDrawOverlay(ctx, {
                priceToY,
                candleWidth,
                padding,
                chartWidth,
                chartHeight,
                visibleData: data,
                visibleStartIndex: start,
                allData: allData
            });
        }

        // ── CROSSHAIR & PRICE LABEL BOX ──
        if (mouse.x && mouse.y && mouse.x > padding && mouse.x < padding + chartWidth && mouse.y > padding && mouse.y < padding + chartHeight) {
            const index = Math.floor((mouse.x - padding) / candleWidth);
            if (data[index]) {
                ctx.strokeStyle = "#444";
                ctx.beginPath(); ctx.moveTo(mouse.x, padding); ctx.lineTo(mouse.x, padding + chartHeight); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(padding, mouse.y); ctx.lineTo(padding + chartWidth, mouse.y); ctx.stroke();

                ctx.fillStyle = "#111"; ctx.fillRect(padding + chartWidth, mouse.y - 10, priceScaleWidth, 20);
                ctx.fillStyle = "#fff"; ctx.fillText(formatPrice(yToPrice(mouse.y)), padding + chartWidth + 5, mouse.y + 4);
            }
        }
    }

    function startWebSocket() {
        if (socket) { socket.onclose = null; socket.close(); }
        let currentCoin = coinEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || "BTCUSDT";
        const wsUrl = `wss://stream.binance.com/ws/${currentCoin.toLowerCase()}@kline_${interval}`;
        socket = new WebSocket(wsUrl);
        const dot = document.getElementById('ws-dot'), text = document.getElementById('ws-text');

        socket.onopen = () => {
            if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse";
            if (text) { text.innerText = `${marketEl.value.toUpperCase()} LIVE`; text.className = "text-[9px] font-black uppercase text-green-500"; }
        };
        socket.onmessage = e => {
            const res = JSON.parse(e.data);
            if (res.k) {
                const k = res.k;
                const currentCandle = [k.t, Number(k.o), Number(k.h), Number(k.l), Number(k.c), Number(k.v)];
                if (allData.length > 0) {
                    if (allData[allData.length-1][0] === k.t) allData[allData.length-1] = currentCandle;
                    else { allData.push(currentCandle); if (allData.length > 500) allData.shift(); }
                    draw();
                    window.dispatchChartUpdate(allData); // Секунд тутамд үнэ орох бүрт илгээх
                }
            }
        };
    }

    let updateTimer = null;
    const triggerAutoUpdate = () => {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            if (!coinEl || !intervalEl || !marketEl) return;
            if (typeof window.syncControlsAndFetch === 'function') window.syncControlsAndFetch();
            interval = intervalEl.value;
            symbol = coinEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || "BTCUSDT";
            fetchCandles();
        }, 300);
    };

    if (marketEl) marketEl.addEventListener("change", triggerAutoUpdate);
    if (intervalEl) intervalEl.addEventListener("change", triggerAutoUpdate);
    if (coinEl) {
        coinEl.addEventListener("change", triggerAutoUpdate);
        coinEl.addEventListener("keydown", (e) => { if (e.key === "Enter") triggerAutoUpdate(); });
    }

    canvas.addEventListener("mousemove", e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top;
        if (draggingPrice) {
            const dy = e.clientY - lastY; lastY = e.clientY;
            priceScale *= (1 + dy * 0.005); priceScale = Math.max(0.1, Math.min(priceScale, 10));
            draw(); return;
        }
        if (dragging) {
            const dx = e.clientX - lastX;
            offset = Math.max(0, Math.min(allData.length - visibleCount, offset + Math.round(dx / 10)));
            lastX = e.clientX;
            const dy = e.clientY - lastY;
            if (lastChartHeight > 0) priceOffset += dy * (lastPriceRange / lastChartHeight);
            lastY = e.clientY;
        }
        const isMobile = window.innerWidth < 768;
        const padding = isMobile ? 15 : 40;
        const priceScaleWidth = isMobile ? 55 : 80;
        canvas.style.cursor = mouse.x > canvas.width - padding - priceScaleWidth ? "ns-resize" : (dragging ? "grabbing" : "crosshair");
        draw();
    });

    canvas.addEventListener("mousedown", e => { 
        const isMobile = window.innerWidth < 768;
        const padding = isMobile ? 15 : 40;
        const priceScaleWidth = isMobile ? 55 : 80;
        if (mouse.x > canvas.width - padding - priceScaleWidth) { draggingPrice = true; lastY = e.clientY; }
        else { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    });
    canvas.addEventListener("mouseup", () => { dragging = false; draggingPrice = false; });
    canvas.addEventListener("mouseleave", () => { dragging = false; draggingPrice = false; mouse.x = null; draw(); });
    canvas.addEventListener("dblclick", () => { priceScale = 1; priceOffset = 0; draw(); });
    canvas.addEventListener("wheel", e => {
        e.preventDefault();
        visibleCount = Math.max(minVisible, Math.min(maxVisible, visibleCount + (e.deltaY > 0 ? 10 : -10)));
        offset = Math.min(offset, allData.length - visibleCount);
        draw();
    }, { passive:false });

    fetchCandles();
});