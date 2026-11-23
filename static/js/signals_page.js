(function () {
    "use strict";

    const market = document.body.dataset.market === "futures" ? "futures" : "spot";
    const canvas = document.getElementById("signal-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = {
        symbol: "BTCUSDT",
        interval: "1m",
        candles: [],
        hover: null,
        visible: 100,
        offset: 0,
        scale: 1,
        shift: 0,
        drag: null,
        timeframeCache: new Map()
    };

    const symbolInput = document.getElementById("signal-symbol");
    const intervalInput = document.getElementById("signal-interval");
    const marketBadge = document.getElementById("market-badge");
    const status = document.getElementById("signal-status");
    const reload = document.getElementById("reload-signal");
    const timeframePanel = document.getElementById("timeframe-signals");

    const intervals = [
        { label: "1M", value: "1m" },
        { label: "5M", value: "5m" },
        { label: "15M", value: "15m" },
        { label: "1H", value: "1h" },
        { label: "4H", value: "4h" },
        { label: "1D", value: "1d" }
    ];

    function endpoint(symbol, interval, limit) {
        const base = market === "futures"
            ? "https://fapi.binance.com/fapi/v1/klines"
            : "https://api.binance.com/api/v3/klines";
        const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
        return `${base}?${params}`;
    }

    function parseRows(rows) {
        return rows.map(row => [
            Number(row[0]),
            Number(row[1]),
            Number(row[2]),
            Number(row[3]),
            Number(row[4]),
            Number(row[5])
        ]).filter(row => row.every(Number.isFinite));
    }

    function ema(values, period) {
        if (!values.length) return [];
        const multiplier = 2 / (period + 1);
        const result = new Array(values.length).fill(NaN);
        let sum = 0;
        let count = Math.min(period, values.length);
        for (let i = 0; i < count; i++) sum += values[i];
        if (values.length < period) return values.slice();
        result[period - 1] = sum / period;
        for (let i = period; i < values.length; i++) {
            result[i] = values[i] * multiplier + result[i - 1] * (1 - multiplier);
        }
        return result;
    }

    function rsi(values, period = 14) {
        const result = new Array(values.length).fill(NaN);
        if (values.length <= period) return result;
        let gain = 0;
        let loss = 0;
        for (let i = 1; i <= period; i++) {
            const change = values[i] - values[i - 1];
            gain += Math.max(change, 0);
            loss += Math.max(-change, 0);
        }
        let avgGain = gain / period;
        let avgLoss = loss / period;
        result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        for (let i = period + 1; i < values.length; i++) {
            const change = values[i] - values[i - 1];
            avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
            result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        }
        return result;
    }

    function analyze(rows) {
        const closes = rows.map(row => row[4]);
        const fast = ema(closes, 20);
        const slow = ema(closes, 50);
        const momentum = rsi(closes, 14);
        if (!closes.length) return { direction: "neutral", score: 0, rsi: null, price: null };
        const index = closes.length - 1;
        const fastValue = fast[index];
        const slowValue = slow[index];
        const momentumValue = momentum[index];
        let score = 0;
        if (Number.isFinite(fastValue) && Number.isFinite(slowValue)) {
            score += fastValue > slowValue ? 1 : -1;
        }
        score += closes[index] > closes[index - 1] ? 1 : -1;
        if (Number.isFinite(momentumValue)) {
            if (momentumValue >= 55) score += 1;
            if (momentumValue <= 45) score -= 1;
        }
        return {
            direction: score >= 2 ? "bull" : score <= -2 ? "bear" : "neutral",
            score,
            rsi: Number.isFinite(momentumValue) ? momentumValue : null,
            price: closes[index]
        };
    }

    function formatPrice(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "--";
        if (number >= 1000) return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
        if (number >= 1) return number.toLocaleString("en-US", { maximumFractionDigits: 4 });
        return number.toLocaleString("en-US", { maximumFractionDigits: 8 });
    }

    async function loadCandles(reset = true) {
        const nextSymbol = (symbolInput?.value || "BTCUSDT").trim().toUpperCase();
        if (!/^[A-Z0-9]{2,20}$/.test(nextSymbol)) {
            setStatus("Хослолын нэр буруу байна", "error");
            return;
        }
        state.symbol = nextSymbol;
        state.interval = intervalInput?.value || "1m";
        if (reset) {
            state.offset = 0;
            state.scale = 1;
            state.shift = 0;
        }
        setStatus("Лаа ачаалж байна...", "loading");
        reload.disabled = true;
        try {
            const response = await fetch(endpoint(state.symbol, state.interval, 500), { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            state.candles = parseRows(await response.json()).slice(-500);
            if (!state.candles.length) throw new Error("Лааны өгөгдөл алга");
            setStatus(`${state.symbol} · ${state.interval} · LIVE`, "live");
            render();
            scanTimeframes();
        } catch (error) {
            setStatus(error.message, "error");
        } finally {
            reload.disabled = false;
        }
    }

    async function pollLive() {
        if (document.hidden || !state.candles.length) return;
        try {
            const response = await fetch(endpoint(state.symbol, state.interval, 2), { cache: "no-store" });
            if (!response.ok) return;
            const rows = parseRows(await response.json());
            rows.forEach(row => {
                const index = state.candles.findIndex(candle => candle[0] === row[0]);
                if (index >= 0) state.candles[index] = row;
                else state.candles.push(row);
            });
            state.candles = state.candles.slice(-500);
            render();
        } catch (_) {}
    }

    function setStatus(text, type) {
        if (!status) return;
        status.textContent = text;
        status.dataset.type = type || "";
    }

    function scanTimeframes() {
        if (!timeframePanel) return;
        timeframePanel.querySelectorAll("[data-direction]").forEach(card => {
            card.dataset.direction = "neutral";
            card.querySelector(".tf-value").textContent = "SCAN";
        });
        intervals.forEach(async item => {
            try {
                const response = await fetch(endpoint(state.symbol, item.value, 120), { cache: "no-store" });
                if (!response.ok) return;
                const rows = parseRows(await response.json());
                const trend = analyze(rows);
                state.timeframeCache.set(item.value, trend);
                const card = timeframePanel.querySelector(`[data-timeframe="${item.value}"]`);
                if (!card) return;
                card.dataset.direction = trend.direction;
                card.querySelector(".tf-value").textContent =
                    trend.direction === "bull" ? "BULL" :
                    trend.direction === "bear" ? "BEAR" : "NEUTRAL";
            } catch (_) {}
        });
    }

    function render() {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(bounds.width * ratio);
        canvas.height = Math.round(bounds.height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.fillStyle = "#080b10";
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        if (!state.candles.length) return;

        const left = 14;
        const right = 72;
        const top = 18;
        const bottom = 32;
        const width = Math.max(1, bounds.width - left - right);
        const height = Math.max(1, bounds.height - top - bottom);
        const end = state.candles.length - state.offset;
        const start = Math.max(0, end - state.visible);
        const visible = state.candles.slice(start, end);
        if (!visible.length) return;
        const barWidth = width / visible.length;

        const prices = visible.flatMap(candle => [candle[2], candle[3]]);
        let minPrice = Math.min(...prices);
        let maxPrice = Math.max(...prices);
        if (minPrice === maxPrice) {
            minPrice -= 1;
            maxPrice += 1;
        }
        const midpoint = (minPrice + maxPrice) / 2 + state.shift;
        const halfRange = (maxPrice - minPrice) * 0.55 * state.scale;
        minPrice = midpoint - halfRange;
        maxPrice = midpoint + halfRange;
        const priceToY = price => top + (maxPrice - price) / (maxPrice - minPrice) * height;

        ctx.font = "10px Inter, Arial, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        for (let i = 0; i <= 6; i++) {
            const price = maxPrice - (maxPrice - minPrice) * i / 6;
            const y = top + height * i / 6;
            ctx.strokeStyle = "#17202b";
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(left + width, y);
            ctx.stroke();
            ctx.fillStyle = "#8795a7";
            ctx.fillText(formatPrice(price), left + width + right - 5, y);
        }

        const closes = state.candles.map(candle => candle[4]);
        const ema20 = ema(closes, 20);
        const ema50 = ema(closes, 50);
        [
            { values: ema20, color: "#f0b90b" },
            { values: ema50, color: "#38bdf8" }
        ].forEach(series => {
            ctx.strokeStyle = series.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let drawing = false;
            series.slice(start, end).forEach((value, index) => {
                if (!Number.isFinite(value)) {
                    drawing = false;
                    return;
                }
                const x = left + (index + 0.5) * barWidth;
                const y = priceToY(value);
                if (drawing) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
                drawing = true;
            });
            ctx.stroke();
        });

        visible.forEach((candle, index) => {
            const [, open, high, low, close] = candle;
            const x = left + (index + 0.5) * barWidth;
            const bullish = close >= open;
            const color = bullish ? "#26c98b" : "#f05d68";
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, priceToY(high));
            ctx.lineTo(x, priceToY(low));
            ctx.stroke();
            const bodyWidth = Math.max(1, barWidth * 0.68);
            ctx.fillRect(
                x - bodyWidth / 2,
                Math.min(priceToY(open), priceToY(close)),
                bodyWidth,
                Math.max(1, Math.abs(priceToY(open) - priceToY(close)))
            );
        });

        const trend = analyze(state.candles);
        document.getElementById("trend-direction").textContent =
            trend.direction === "bull" ? "BULLISH" :
            trend.direction === "bear" ? "BEARISH" : "NEUTRAL";
        document.getElementById("trend-direction").dataset.direction = trend.direction;
        document.getElementById("trend-rsi").textContent = trend.rsi ? trend.rsi.toFixed(1) : "--";
        document.getElementById("live-price").textContent = formatPrice(trend.price);

        const latest = visible[visible.length - 1];
        if (latest) {
            const y = priceToY(latest[4]);
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "#c5a059";
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(left + width, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#c5a059";
            ctx.fillRect(left + width + 2, y - 9, right - 4, 18);
            ctx.fillStyle = "#080b10";
            ctx.textAlign = "left";
            ctx.fillText(formatPrice(latest[4]), left + width + 5, y);
        }

        if (state.hover) {
            const hover = state.hover;
            if (hover.x >= left && hover.x <= left + width && hover.y >= top && hover.y <= top + height) {
                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = "rgba(213,222,234,.45)";
                ctx.beginPath();
                ctx.moveTo(hover.x, top);
                ctx.lineTo(hover.x, top + height);
                ctx.moveTo(left, hover.y);
                ctx.lineTo(left + width, hover.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    canvas.addEventListener("mousemove", event => {
        const rect = canvas.getBoundingClientRect();
        state.hover = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        render();
    });
    canvas.addEventListener("mouseleave", () => {
        state.hover = null;
        render();
    });
    canvas.addEventListener("wheel", event => {
        event.preventDefault();
        state.visible = Math.max(20, Math.min(500,
            state.visible + (event.deltaY > 0 ? 10 : -10)));
        render();
    }, { passive: false });

    reload?.addEventListener("click", () => loadCandles(false));
    symbolInput?.addEventListener("change", () => loadCandles(true));
    intervalInput?.addEventListener("change", () => loadCandles(true));
    window.addEventListener("resize", render);
    if ("ResizeObserver" in window) new ResizeObserver(render).observe(canvas);

    if (marketBadge) marketBadge.textContent = market.toUpperCase();
    loadCandles(true);
    window.setInterval(pollLive, 3000);
})();
