(() => {
    "use strict";

    const HISTORY_LIMIT = 1000;
    const LIVE_POLL_MS = 1000;
    const MIN_VISIBLE = 20;
    const MAX_VISIBLE = 500;
    const LEFT = 12;
    const RIGHT = 60;
    const TOP = 28;
    const BOTTOM = 30;

    const canvas = document.getElementById("chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const chartControls = window.ChartControls || {};
    const marketInput = chartControls.market?.input || document.getElementById("market") || { value: "spot" };
    const symbolInput = chartControls.ticker?.input || document.getElementById("symbol") || { value: "BTCUSDT", focus() {} };
    const intervalInput = chartControls.interval?.input || document.getElementById("interval") || { value: "1m" };
    const reloadButton = document.getElementById("reload");
    const applyIndicatorsButton = document.getElementById("applyIndicators");
    const chartSettingsPanel = document.getElementById("chart-settings");
    const indicatorSettingsPanel = document.getElementById("indicator-settings");
    const tradeSettingsPanel = document.getElementById("trade-settings");
    const toggleChartSettingsButton = document.getElementById("toggle-chart-settings");
    const toggleIndicatorSettingsButton = document.getElementById("toggle-indicator-settings");
    const toggleTradeSettingsButton = document.getElementById("toggle-trade-settings");
    const statusElement = document.getElementById("status");
    const countdownElement = document.getElementById("candle-countdown");
    const volumeProfileStatusElement = document.getElementById("volume-profile-status");
    const showMacdInput = document.getElementById("showMACD");
    const showRsiInput = document.getElementById("showRSI");
    const showEma1Input = document.getElementById("showEMA1");
    const showEma2Input = document.getElementById("showEMA2");
    const showMa1Input = document.getElementById("showMA1");
    const showMa2Input = document.getElementById("showMA2");
    const tradeActionButtons = Array.from(document.querySelectorAll(".trade-action"));
    const tradeSideInput = document.getElementById("trade-side");
    const balanceInput = document.getElementById("account-balance");
    const marginInput = document.getElementById("trade-margin");
    const leverageInput = document.getElementById("trade-leverage");
    const tradeSettingsStatus = document.getElementById("trade-settings-status");
    const indicatorInputs = {
        fast: document.getElementById("macdFast"),
        slow: document.getElementById("macdSlow"),
        signal: document.getElementById("macdSignal"),
        rsi: document.getElementById("rsiPeriod"),
        ema1: document.getElementById("emaPeriod1"),
        ema2: document.getElementById("emaPeriod2"),
        ma1: document.getElementById("maPeriod1"),
        ma2: document.getElementById("maPeriod2")
    };
    const ohlcElements = {
        symbol: document.getElementById("ohlc-symbol"),
        open: document.getElementById("ohlc-open"),
        high: document.getElementById("ohlc-high"),
        low: document.getElementById("ohlc-low"),
        close: document.getElementById("ohlc-close")
    };

    const state = {
        candles: [],
        market: marketInput.value,
        symbol: symbolInput.value,
        interval: intervalInput.value,
        visible: 100,
        offset: 0,
        priceScale: 1,
        priceShift: 0,
        periods: { fast: 12, slow: 26, signal: 9, rsi: 14, ema1: 20, ema2: 50, ma1: 20, ma2: 50 },
        indicators: { macd: [], signal: [], histogram: [], rsi: [], ema1: [], ema2: [], ma1: [], ma2: [] },
        hover: null,
        drag: null,
        layout: null,
        loading: false,
        requestId: 0,
        controller: null,
        latestData: null
    };
    let selectedTradeAction = null;
    let isFetchingApiData1 = false;

    async function fetchApiData1() {
        if (isFetchingApiData1 || document.hidden || !state.candles.length) return;
        isFetchingApiData1 = true;

        try {
            const params = new URLSearchParams({
                symbol: state.symbol,
                market: state.market,
                interval: state.interval,
                fast: String(state.periods.fast),
                slow: String(state.periods.slow),
                signal: String(state.periods.signal),
                rsiPeriod: String(state.periods.rsi)
            });

            const res = await fetch(`/api/data1?${params}`, { cache: "no-store" });
            if (!res.ok) return;

            state.latestData = await res.json();
            const payload = state.latestData;
            const d = payload?.data || {}; // /api/data1-ийн data объект
            const macd = d.macd || {};
            const rsi = d.rsi || {};
            const ohlc = d.ohlc || {};
            const ch = rsi.cross_history || {};

            // --- META ---
            const apiSymbol = d.symbol;
            const latestPrice = d.latest_price;
            const apiTimestamp = d.timestamp;

            // --- MACD VALUES ---
            const latestMacdLine = macd.latest_macd_line;
            const previousMacdLine = macd.previous_macd_line;
            const previous2MacdLine = macd.previous_2_macd_line;
            const previous3MacdLine = macd.previous_3_macd_line;
            const previous4MacdLine = macd.previous_4_macd_line;

            const latestMacdSignal = macd.latest_macd_signal;
            const previousMacdSignal = macd.previous_macd_signal;
            const previous2MacdSignal = macd.previous_2_macd_signal;
            const previous3MacdSignal = macd.previous_3_macd_signal;
            const previous4MacdSignal = macd.previous_4_macd_signal;

            const latestMacdHistogram = macd.latest_macd_histogram;
            const previousMacdHistogram = macd.previous_macd_histogram;
            const previous2MacdHistogram = macd.previous_2_macd_histogram;
            const previous3MacdHistogram = macd.previous_3_macd_histogram;
            const previous4MacdHistogram = macd.previous_4_macd_histogram;

            // --- MACD CROSS & STATE & TREND ---
            const macdUpcross = macd.macd_upcross;
            const macdDowncross = macd.macd_downcross;
            const macdLineUp = macd.macd_line_up;
            const macdLineDown = macd.macd_line_down;
            const macdUp = macd.macd_up;
            const macdDown = macd.macd_down;
            const macdTrend = macd.macd_trend;

            // --- MACD PEAKS & TROUGHS ---
            const macdPeakValue = macd.macd_peak_value;
            const macdPeakPrice = macd.macd_peak_price;
            const macdPeakMaxprice = macd.macd_peak_maxprice;
            const macdTroughValue = macd.macd_trough_value;
            const macdTroughPrice = macd.macd_trough_price;
            const macdTroughMinprice = macd.macd_trough_minprice;
            const lastPeakValue = macd.last_peak_value;
            const lastPeakPrice = macd.last_peak_price;
            const lastPeakTime = macd.last_peak_time;
            const lastTroughValue = macd.last_trough_value;
            const lastTroughPrice = macd.last_trough_price;
            const lastTroughTime = macd.last_trough_time;

            // --- MACD AVERAGE & LIMITS ---
            const macdMin = macd.macd_min;
            const macdMax = macd.macd_max;
            const macdAverage = macd.macd_average;
            const macdUplimit = macd.macd_uplimit;
            const macdDownlimit = macd.macd_downlimit;
            const uplimitCrossLine = macd.uplimit_cross_line;
            const downlimitCrossLine = macd.downlimit_cross_line;

            // --- MACD INITIAL CROSSES ---
            const macdInitialUpPrice = macd.macd_initial_up_price;
            const macdInitialUpTime = macd.macd_initial_up_time;
            const macdInitialDownPrice = macd.macd_initial_down_price;
            const macdInitialDownTime = macd.macd_initial_down_time;
            const signalInitialUpPrice = macd.signal_initial_up_price;
            const signalInitialUpTime = macd.signal_initial_up_time;
            const signalInitialDownPrice = macd.signal_initial_down_price;
            const signalInitialDownTime = macd.signal_initial_down_time;

            // --- CUMULATIVE WEIGHT ---
            const latestBarWeight = macd.latest_bar_weight;
            const cumulativeWeight = macd.cumulative_weight;
            const cumulativeWeightFloat = macd.cumulative_weight_float;
            const isPositive = macd.is_positive;
            const isNegative = macd.is_negative;

            // --- RSI VALUES & CROSS ---
            const rsi0 = rsi.rsi0;
            const rsi1 = rsi.rsi1;
            const rsi2 = rsi.rsi2;
            const rsi3 = rsi.rsi3;
            const rsi30Up = rsi["30_up"];
            const rsi70Up = rsi["70_up"];
            const rsi30Down = rsi["30_down"];
            const rsi70Down = rsi["70_down"];

            // --- RSI CROSS HISTORY ---
            const s30u = ch.s30u;
            const s30uTime = ch.s30u_time;
            const s30uPrev = ch.s30u_prev;
            const s30uPrevTime = ch.s30u_prev_time;
            const s30d = ch.s30d;
            const s30dTime = ch.s30d_time;
            const s30dPrev = ch.s30d_prev;
            const s30dPrevTime = ch.s30d_prev_time;
            const s70u = ch.s70u;
            const s70uTime = ch.s70u_time;
            const s70uPrev = ch.s70u_prev;
            const s70uPrevTime = ch.s70u_prev_time;
            const s70d = ch.s70d;
            const s70dTime = ch.s70d_time;
            const s70dPrev = ch.s70d_prev;
            const s70dPrevTime = ch.s70d_prev_time;

            // --- RSI STATUS, TREND & AVERAGE ---
            const lastStatus = rsi.last_status;
            const lastStatusTime = rsi.last_status_time;
            const rsiTrend = rsi.trend;
            const averageStatus = rsi.average_status;

            // --- OHLC TRACKER ---
            const candleOpen0 = ohlc.candle_open_0;
            const candleHigh0 = ohlc.candle_high_0;
            const candleLow0 = ohlc.candle_low_0;
            const candleClose0 = ohlc.candle_close_0;
            const candleOpen1 = ohlc.candle_open_1;
            const candleHigh1 = ohlc.candle_high_1;
            const candleLow1 = ohlc.candle_low_1;
            const candleClose1 = ohlc.candle_close_1;
            const candleOpen2 = ohlc.candle_open_2;
            const candleHigh2 = ohlc.candle_high_2;
            const candleLow2 = ohlc.candle_low_2;
            const candleClose2 = ohlc.candle_close_2;
            const candleOpen3 = ohlc.candle_open_3;
            const candleHigh3 = ohlc.candle_high_3;
            const candleLow3 = ohlc.candle_low_3;
            const candleClose3 = ohlc.candle_close_3;
            const minOpen = ohlc.min_open;
            const maxOpen = ohlc.max_open;
            const minClose = ohlc.min_close;
            const maxClose = ohlc.max_close;
            const maxHigh = ohlc.max_high;
            const minLow = ohlc.min_low;
            const openup = ohlc.openup;
            const opendown = ohlc.opendown;
            const openupLimit = ohlc.openup_limit;
            const opendownLimit = ohlc.opendown_limit;

            // === ЯГ ЭНДЭЭС ЭХЛЭЭД ӨӨРИЙН НӨХЦӨЛ / ЛОГИКОО БИЧНЭ ===
            // if (lastStatus === "30U" && s30u !== null && candleClose0 > s30u) {
            //     // энд өөрийн кодоо бичнэ
            // }
            // =========================================================

            console.log("api/data1:", payload);
        } catch (err) {
            console.error("fetchApiData1 error:", err);
        } finally {
            isFetchingApiData1 = false;
        }
    }

    const apiData1Timer = setInterval(fetchApiData1, LIVE_POLL_MS);
    fetchApiData1();
    window.addEventListener("beforeunload", () => clearInterval(apiData1Timer));

    function bindPanelToggle(button, panel) {
        if (!button || !panel) return;
        button.addEventListener("click", () => {
            const isExpanded = button.getAttribute("aria-expanded") === "true";
            panel.hidden = isExpanded;
            button.setAttribute("aria-expanded", String(!isExpanded));
        });
    }

    bindPanelToggle(toggleChartSettingsButton, chartSettingsPanel);
    bindPanelToggle(toggleIndicatorSettingsButton, indicatorSettingsPanel);
    bindPanelToggle(toggleTradeSettingsButton, tradeSettingsPanel);

    const indicators = window.ChartIndicators || {};
    if (indicators.vp?.configure) {
        indicators.vp.configure({
            statusElement: volumeProfileStatusElement,
            formatTime,
            getInterval: () => state.interval,
            onChange: draw
        });
    }

    function setStatus(message, stateName = "") {
        if (!statusElement) return;
        statusElement.textContent = message;
        statusElement.dataset.state = stateName;
    }

    function updateTradeSettings() {
        if (!balanceInput && !marginInput && !leverageInput && !tradeSideInput) return;
        const balance = balanceInput && balanceInput.value !== "" ? Number(balanceInput.value) : null;
        const margin = marginInput && marginInput.value !== "" ? Number(marginInput.value) : null;
        const leverage = leverageInput && leverageInput.value !== "" ? Number(leverageInput.value) : null;
        let error = "";

        if (balance !== null && (!Number.isFinite(balance) || balance < 0)) {
            error = "Balance 0 буюу түүнээс их байх ёстой.";
        } else if (margin !== null && (!Number.isFinite(margin) || margin < 0)) {
            error = "Margin 0 буюу түүнээс их байх ёстой.";
        } else if (balance !== null && margin !== null && margin > balance) {
            error = "Margin нь Balance-аас их байж болохгүй.";
        } else if (leverage !== null && (!Number.isInteger(leverage) || leverage < 1 || leverage > 125)) {
            error = "Leverage 1–125 бүхэл тоо байх ёстой.";
        }
    }

    function formatPrice(value) {
        const price = Number(value);
        if (!Number.isFinite(price)) return "—";
        const digits = price >= 1000 ? 2 : price >= 1 ? 4 : price >= 0.001 ? 6 : 8;
        return price.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: digits
        });
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const options = /[dwM]$/.test(state.interval)
            ? { timeZone: "Asia/Ulaanbaatar", month: "short", day: "2-digit" }
            : { timeZone: "Asia/Ulaanbaatar", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
        return new Intl.DateTimeFormat("en-GB", options).format(date);
    }


    function formatCrosshairTime(timestamp) {
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Ulaanbaatar",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(new Date(timestamp));
    }

    function nextCandleTime(now = Date.now()) {
        const match = /^(\d+)([smhdwM])$/.exec(state.interval);
        if (!match) return now;
        const count = Number(match[1]);
        const unit = match[2];

        if (unit === "M") {
            const nextMonth = new Date(now);
            nextMonth.setUTCDate(1);
            nextMonth.setUTCHours(0, 0, 0, 0);
            nextMonth.setUTCMonth(nextMonth.getUTCMonth() + count);
            return nextMonth.getTime();
        }
        if (unit === "w") {
            const day = 24 * 60 * 60 * 1000;
            const startOfDay = Math.floor(now / day) * day;
            const weekday = new Date(now).getUTCDay();
            const daysToMonday = (8 - weekday) % 7 || 7;
            return startOfDay + daysToMonday * day;
        }

        const duration = count * ({
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        })[unit];
        return (Math.floor(now / duration) + 1) * duration;
    }

    function updateCountdown() {
        if (!countdownElement) return;
        const secondsLeft = Math.max(0, Math.ceil((nextCandleTime() - Date.now()) / 1000));
        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const seconds = secondsLeft % 60;
        countdownElement.textContent = hours > 0
            ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
            : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function updateOhlc(candle) {
        if (!candle) return;
        const rising = candle[4] >= candle[1];
        if (ohlcElements.symbol) ohlcElements.symbol.textContent = state.symbol;
        if (ohlcElements.open) ohlcElements.open.textContent = formatPrice(candle[1]);
        if (ohlcElements.high) ohlcElements.high.textContent = formatPrice(candle[2]);
        if (ohlcElements.low) ohlcElements.low.textContent = formatPrice(candle[3]);
        if (ohlcElements.close) {
            ohlcElements.close.textContent = formatPrice(candle[4]);
            ohlcElements.close.dataset.value = rising ? "up" : "down";
        }
        canvas.setAttribute("aria-label", `${state.symbol} үнийн график`);
    }

    function parseCandles(rows) {
        if (!Array.isArray(rows)) throw new Error("Биржээс буруу өгөгдөл ирлээ.");
        return rows.map(row => {
            const candle = [0, 1, 2, 3, 4, 5].map(index => Number(row[index]));
            if (candle.length !== 6 || !candle.every(Number.isFinite)) {
                throw new Error("Лааны өгөгдөл дутуу эсвэл буруу байна.");
            }
            return candle;
        });
    }

    function endpoint(limit) {
        const base = state.market === "futures"
            ? "https://fapi.binance.com/fapi/v1/klines"
            : "https://api.binance.com/api/v3/klines";
        const params = new URLSearchParams({
            symbol: state.symbol,
            interval: state.interval,
            limit: String(limit)
        });
        return `${base}?${params}`;
    }

    function calculateIndicators() {
        const closes = state.candles.map(candle => candle[4]);
        if (!closes.length) {
            state.indicators = { macd: [], signal: [], histogram: [], rsi: [], ema1: [], ema2: [], ma1: [], ma2: [] };
            if (indicators.vp) {
                indicators.vp.updateCandles([]);
                indicators.vp.updateInterval(state.interval);
                indicators.vp.clear();
            }
            return;
        }
        const macd = indicators.macd?.calculate
            ? indicators.macd.calculate(closes, state.periods)
            : { macd: [], signal: [], histogram: [] };
        state.indicators = {
            macd: macd.macd || [],
            signal: macd.signal || [],
            histogram: macd.histogram || [],
            rsi: indicators.rsi?.calculate
                ? indicators.rsi.calculate(closes, state.periods.rsi)
                : [],
            ema1: indicators.ema?.calculate
                ? indicators.ema.calculate(closes, state.periods.ema1)
                : [],
            ema2: indicators.ema?.calculate
                ? indicators.ema.calculate(closes, state.periods.ema2)
                : [],
            ma1: indicators.ma?.calculate
                ? indicators.ma.calculate(closes, state.periods.ma1)
                : [],
            ma2: indicators.ma?.calculate
                ? indicators.ma.calculate(closes, state.periods.ma2)
                : []
        };
        if (indicators.vp) {
            indicators.vp.updateCandles(state.candles);
            indicators.vp.updateInterval(state.interval);
        }
    }

    async function loadHistory(resetView = true) {
        const symbol = symbolInput.value.trim().toUpperCase();
        if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
            setStatus("Арилжааны хослолын нэр буруу байна.", "error");
            symbolInput?.focus?.();
            return;
        }

        const chartChanged = symbol !== state.symbol ||
            marketInput.value !== state.market ||
            intervalInput.value !== state.interval;
        state.symbol = symbol;
        state.market = marketInput.value;
        state.interval = intervalInput.value;
        symbolInput.value = symbol;

        if (chartChanged) {
            state.candles = [];
            calculateIndicators();
            draw();
        }

        if (resetView) {
            state.visible = 100;
            state.offset = 0;
            state.priceScale = 1;
            state.priceShift = 0;
        }

        const requestId = ++state.requestId;
        state.controller?.abort();
        const controller = new AbortController();
        state.controller = controller;
        state.loading = true;
        if (reloadButton) reloadButton.disabled = true;
        setStatus(`${state.symbol} · ${state.market} · ${state.interval} ачаалж байна...`);

        try {
            const response = await fetch(endpoint(HISTORY_LIMIT), {
                cache: "no-store",
                signal: controller.signal
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.msg || `Биржийн хүсэлт амжилтгүй (HTTP ${response.status}).`);
            }

            const candles = parseCandles(payload);
            if (!candles.length) throw new Error("Энэ хослолд лааны өгөгдөл олдсонгүй.");
            if (requestId !== state.requestId) return;

            state.candles = candles.slice(-HISTORY_LIMIT);
            state.offset = Math.min(state.offset, Math.max(0, state.candles.length - state.visible));
            calculateIndicators();
            updateOhlc(state.candles[state.candles.length - 1]);
            setStatus(`${state.symbol} · ${state.market} · ${state.interval} · ${state.candles.length} лаа`, "live");
            draw();
        } catch (error) {
            if (error.name === "AbortError" || requestId !== state.requestId) return;
            setStatus(`График ачаалж чадсангүй: ${error.message}`, "error");
            draw();
        } finally {
            if (requestId === state.requestId) {
                state.loading = false;
                state.controller = null;
                if (reloadButton) reloadButton.disabled = false;
            }
        }
    }

    async function pollLatest() {
        if (state.loading || document.hidden || !state.candles.length) return;
        const requestId = state.requestId;
        const controller = new AbortController();
        state.controller = controller;
        state.loading = true;

        try {
            const response = await fetch(endpoint(2), {
                cache: "no-store",
                signal: controller.signal
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.msg || `HTTP ${response.status}`);
            }
            const updates = parseCandles(payload);
            if (requestId !== state.requestId || !updates.length) return;

            const lastTime = state.candles[state.candles.length - 1][0];
            const added = updates.filter(candle => candle[0] > lastTime).length;
            const merged = new Map(state.candles.map(candle => [candle[0], candle]));
            updates.forEach(candle => merged.set(candle[0], candle));
            state.candles = Array.from(merged.values()).sort((a, b) => a[0] - b[0]).slice(-HISTORY_LIMIT);
            calculateIndicators();
            if (state.offset > 0 && added) {
                state.offset = Math.min(state.offset + added, Math.max(0, state.candles.length - state.visible));
            }

            if (state.offset === 0) {
                updateOhlc(state.candles[state.candles.length - 1]);
                setStatus(`${state.symbol} · ${state.market} · ${state.interval} · шинэчлэгдсэн ${new Date().toLocaleTimeString("mn-MN")}`, "live");
            }
            draw();
        } catch (error) {
            if (error.name !== "AbortError" && requestId === state.requestId) {
                setStatus(`Шинэчлэхэд алдаа гарлаа: ${error.message}`, "error");
            }
        } finally {
            if (requestId === state.requestId) {
                state.loading = false;
                state.controller = null;
            }
        }
    }


    function draw() {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;

        const ratio = window.devicePixelRatio || 1;
        const width = Math.round(bounds.width * ratio);
        const height = Math.round(bounds.height * ratio);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.fillStyle = "#080b10";
        ctx.fillRect(0, 0, bounds.width, bounds.height);

        if (!state.candles.length) {
            ctx.fillStyle = "#758397";
            ctx.font = "13px Inter, Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Лааны өгөгдөл хүлээж байна", bounds.width / 2, bounds.height / 2);
            return;
        }

        const plotLeft = LEFT;
        const plotTop = TOP;
        const plotWidth = Math.max(1, bounds.width - LEFT - RIGHT);
        const availableHeight = Math.max(1, bounds.height - TOP - BOTTOM);
        const showMacd = showMacdInput?.checked === true && Boolean(indicators.macd?.draw);
        const showRsi = showRsiInput?.checked === true && Boolean(indicators.rsi?.draw);
        const panelGap = 9;
        let mainHeight = availableHeight;
        let macdTop = null;
        let macdHeight = 0;
        let rsiTop = null;
        let rsiHeight = 0;
        const indicatorCount = Number(showMacd) + Number(showRsi);

        if (indicatorCount === 2) {
            mainHeight = availableHeight * 0.62;
            const indicatorHeight = (availableHeight - mainHeight - panelGap * 2) / 2;
            macdTop = plotTop + mainHeight + panelGap;
            macdHeight = indicatorHeight;
            rsiTop = macdTop + macdHeight + panelGap;
            rsiHeight = indicatorHeight;
        } else if (indicatorCount === 1) {
            mainHeight = availableHeight * 0.72;
            const indicatorHeight = availableHeight - mainHeight - panelGap;
            if (showMacd) {
                macdTop = plotTop + mainHeight + panelGap;
                macdHeight = indicatorHeight;
            } else {
                rsiTop = plotTop + mainHeight + panelGap;
                rsiHeight = indicatorHeight;
            }
        }

        const plotBottom = plotTop + availableHeight;
        const end = state.candles.length - state.offset;
        const start = Math.max(0, end - state.visible);
        const candles = state.candles.slice(start, end);
        if (!candles.length) return;

        const barWidth = plotWidth / candles.length;
        const rangePrices = candles.flatMap(candle => [candle[2], candle[3]]);
        if (indicators.ema && showEma1Input?.checked) rangePrices.push(...state.indicators.ema1.slice(start, end).filter(Number.isFinite));
        if (indicators.ema && showEma2Input?.checked) rangePrices.push(...state.indicators.ema2.slice(start, end).filter(Number.isFinite));
        if (indicators.ma && showMa1Input?.checked) rangePrices.push(...state.indicators.ma1.slice(start, end).filter(Number.isFinite));
        if (indicators.ma && showMa2Input?.checked) rangePrices.push(...state.indicators.ma2.slice(start, end).filter(Number.isFinite));
        let minPrice = Math.min(...rangePrices);
        let maxPrice = Math.max(...rangePrices);
        if (maxPrice === minPrice) {
            const padding = Math.max(maxPrice * 0.001, 0.001);
            maxPrice += padding;
            minPrice -= padding;
        }
        const baseMidpoint = (maxPrice + minPrice) / 2;
        const baseRange = (maxPrice - minPrice) * 1.1;
        const midpoint = baseMidpoint + state.priceShift;
        const halfRange = baseRange * 0.5 * state.priceScale;
        maxPrice = midpoint + halfRange;
        minPrice = midpoint - halfRange;
        const priceToY = price => plotTop + ((maxPrice - price) / (maxPrice - minPrice)) * mainHeight;

        state.layout = {
            plotLeft, plotTop, plotWidth, mainHeight, plotBottom, barWidth, start, candles,
            minPrice, maxPrice, baseMidpoint, baseRange
        };

        const crossHistory = state.latestData?.data?.rsi?.cross_history;
        const zeroPercentPrice = Number(crossHistory?.s30u);
        const hundredPercentPrice = Number(crossHistory?.s70d);
        console.log("CH:", crossHistory?.s30u, crossHistory?.s70d);
        if (Number.isFinite(zeroPercentPrice) &&
            Number.isFinite(hundredPercentPrice) &&
            hundredPercentPrice > zeroPercentPrice) {
            // Бүдэг, нэвт харагддаг (translucent) өнгөнүүд — лаанууд тод харагдана
            const rangeColors = [
                "rgba(38, 201, 139, 0.10)",
                "rgba(22, 121, 77, 0.08)",
                "rgba(127, 29, 29, 0.08)",
                "rgba(239, 68, 68, 0.10)"
            ];
            ctx.save();
            ctx.beginPath();
            ctx.rect(plotLeft, plotTop, plotWidth, mainHeight);
            ctx.clip();

            for (let band = 0; band < 4; band++) {
                const upperPrice = hundredPercentPrice -
                    (hundredPercentPrice - zeroPercentPrice) * (band / 4);
                const lowerPrice = hundredPercentPrice -
                    (hundredPercentPrice - zeroPercentPrice) * ((band + 1) / 4);
                const upperY = priceToY(upperPrice);
                const lowerY = priceToY(lowerPrice);
                ctx.fillStyle = rangeColors[band];
                ctx.fillRect(
                    plotLeft,
                    Math.max(plotTop, Math.min(upperY, lowerY)),
                    plotWidth,
                    Math.max(1, Math.abs(lowerY - upperY))
                );
            }
            ctx.restore();
        }

        ctx.font = "10px Inter, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (let tick = 0; tick <= 6; tick++) {
            const price = maxPrice - (maxPrice - minPrice) * tick / 6;
            const y = plotTop + mainHeight * tick / 6;
            ctx.strokeStyle = "#17202b";
            ctx.beginPath();
            ctx.moveTo(plotLeft, y);
            ctx.lineTo(plotLeft + plotWidth, y);
            ctx.stroke();
            ctx.fillStyle = "#8795a7";
            ctx.fillText(formatPrice(price), plotLeft + plotWidth + 5, y);
        }

        const tickCount = Math.max(2, Math.floor(plotWidth / 125));
        const tickStep = Math.max(1, Math.ceil(candles.length / tickCount));
        const chartBottom = rsiTop !== null ? rsiTop + rsiHeight :
            macdTop !== null ? macdTop + macdHeight : plotTop + mainHeight;
        for (let index = 0; index < candles.length; index += tickStep) {
            const x = plotLeft + (index + 0.5) * barWidth;
            ctx.strokeStyle = "#111923";
            ctx.beginPath();
            ctx.moveTo(x, plotTop);
            ctx.lineTo(x, chartBottom);
            ctx.stroke();
            ctx.fillStyle = "#8795a7";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(formatTime(candles[index][0]), x, plotBottom + 5);
        }

        candles.forEach((candle, index) => {
            const [, open, high, low, close] = candle;
            const x = plotLeft + (index + 0.5) * barWidth;
            const openY = priceToY(open);
            const closeY = priceToY(close);
            const color = close >= open ? "#26c98b" : "#f05d68";
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, priceToY(high));
            ctx.lineTo(x, priceToY(low));
            ctx.stroke();
            const bodyWidth = Math.max(0.5, barWidth - Math.min(1.2, barWidth * 0.12));
            ctx.fillRect(x - bodyWidth / 2, Math.min(openY, closeY), bodyWidth, Math.max(1, Math.abs(closeY - openY)));
        });

        const averageOptions = { start, candles, plotLeft, plotWidth, barWidth, priceToY };
        if (indicators.ema && showEma1Input?.checked) indicators.ema.draw(ctx, state.indicators.ema1, "#f0b90b", averageOptions);
        if (indicators.ema && showEma2Input?.checked) indicators.ema.draw(ctx, state.indicators.ema2, "#38bdf8", averageOptions);
        if (indicators.ma && showMa1Input?.checked) indicators.ma.draw(ctx, state.indicators.ma1, "#f472b6", averageOptions);
        if (indicators.ma && showMa2Input?.checked) indicators.ma.draw(ctx, state.indicators.ma2, "#a3e635", averageOptions);

        const vpSelection = indicators.vp?.getSelection?.() || null;
        if (indicators.vp && vpSelection) {
            indicators.vp.drawSelection(ctx, vpSelection, plotLeft, plotTop, plotWidth, mainHeight, barWidth);
        }
        if (indicators.vp?.isEnabled?.() && vpSelection) {
            const profile = indicators.vp.calculate(vpSelection);
            if (profile) indicators.vp.drawProfile(ctx, profile, priceToY, plotLeft, plotTop, plotWidth, mainHeight);
        }

        const latest = candles[candles.length - 1][4];
        const latestY = priceToY(latest);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#c5a059";
        ctx.beginPath();
        ctx.moveTo(plotLeft, latestY);
        ctx.lineTo(plotLeft + plotWidth, latestY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#c5a059";
        ctx.textAlign = "left";
        ctx.font = "9px Inter, Arial, sans-serif";
        ctx.fillRect(plotLeft + plotWidth + 2, latestY - 9, RIGHT - 4, 18);
        ctx.fillStyle = "#080b10";
        ctx.textBaseline = "middle";
        ctx.fillText(formatPrice(latest), plotLeft + plotWidth + 5, latestY);

        const hover = state.hover;
        const insideChart = hover && hover.y >= plotTop && hover.y <= chartBottom;
        const insidePricePanel = insideChart && hover.y <= plotTop + mainHeight;
        const insidePlotX = hover && hover.x >= plotLeft && hover.x <= plotLeft + plotWidth;
        const hoverIndex = insideChart && insidePlotX
        ? start + Math.min(candles.length - 1, Math.max(0, Math.floor((hover.x - plotLeft) / barWidth)))
        : null;

        if (showMacd && indicators.macd?.draw) indicators.macd.draw(ctx, state.indicators, state.periods, {
            start, candles, plotLeft, plotWidth, top: macdTop, height: macdHeight, barWidth, hoverIndex
        });
        if (showRsi && indicators.rsi?.draw) indicators.rsi.draw(ctx, state.indicators.rsi, state.periods.rsi, {
            start, candles, plotLeft, plotWidth, top: rsiTop, height: rsiHeight, barWidth, hoverIndex
        });

        if (insideChart && (insidePlotX || hover.x > plotLeft + plotWidth)) {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "rgba(214, 225, 238, .5)";
        ctx.beginPath();
        if (insidePlotX) {
            const crossX = plotLeft + (hoverIndex - start + 0.5) * barWidth;
            ctx.moveTo(crossX, plotTop);
            ctx.lineTo(crossX, chartBottom);
        }
        ctx.moveTo(plotLeft, hover.y);
        ctx.lineTo(plotLeft + plotWidth, hover.y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (insidePricePanel) {
            const crossPrice = maxPrice - ((hover.y - plotTop) / mainHeight) * (maxPrice - minPrice);
            ctx.fillStyle = "#252014";
            ctx.fillRect(plotLeft + plotWidth + 2, hover.y - 10, RIGHT - 4, 20);
            ctx.strokeStyle = "#c5a059";
            ctx.strokeRect(plotLeft + plotWidth + 2, hover.y - 10, RIGHT - 4, 20);
            ctx.fillStyle = "#f1d58f";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = "9px Inter, Arial, sans-serif";
            ctx.fillText(formatPrice(crossPrice), plotLeft + plotWidth + 5, hover.y);
        } else if (hoverIndex !== null) {
            const activeMacd = state.indicators.macd[hoverIndex];
            const activeSignal = state.indicators.signal[hoverIndex];
            const activeRsi = state.indicators.rsi[hoverIndex];
            if (showMacd && Number.isFinite(activeMacd)) {
                ctx.fillStyle = "#40b8f5";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`MACD ${activeMacd.toFixed(6)} · Signal ${activeSignal.toFixed(6)}`,
                    plotLeft + 5, macdTop + 3);
            }
            if (showRsi && Number.isFinite(activeRsi)) {
                ctx.fillStyle = "#b679e5";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`RSI ${activeRsi.toFixed(2)}`, plotLeft + 5, rsiTop + 3);
            }
        }

        if (hoverIndex !== null) {
            const candle = state.candles[hoverIndex];
            updateOhlc(candle);
            const label = formatCrosshairTime(candle[0]);
            const labelWidth = Math.min(152, plotWidth);
            const crossX = plotLeft + (hoverIndex - start + 0.5) * barWidth;
            const labelX = Math.max(plotLeft, Math.min(crossX - labelWidth / 2, plotLeft + plotWidth - labelWidth));
            const labelY = Math.min(bounds.height - 22, plotBottom + 3);
            ctx.fillStyle = "#151d28";
            ctx.fillRect(labelX, labelY, labelWidth, 18);
            ctx.strokeStyle = "#384658";
            ctx.strokeRect(labelX, labelY, labelWidth, 18);
            ctx.fillStyle = "#d5deea";
            ctx.font = "10px Inter, Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, labelX + labelWidth / 2, labelY + 9);
        } else if (insidePricePanel) {
            updateOhlc(state.candles[state.candles.length - 1]);
        }
        } else {
        updateOhlc(state.candles[state.candles.length - 1]);
        }
    }

    function onPointerDown(event) {
        if (!state.layout) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const { plotLeft, plotTop, plotWidth, mainHeight, plotBottom, barWidth } = state.layout;
        const insideChart = y >= plotTop && y <= plotBottom;
        const onPriceScale = x > plotLeft + plotWidth && y >= plotTop && y <= plotTop + mainHeight;
        if (!insideChart || (!onPriceScale && (x < plotLeft || x > plotLeft + plotWidth))) return;

        if (indicators.vp?.isEnabled?.()) {
            if (indicators.vp.getSelection()) return;
            if (x < plotLeft || x > plotLeft + plotWidth || y > plotTop + mainHeight) return;
            const index = state.layout.start +
                Math.min(state.layout.candles.length - 1, Math.max(0,
                    Math.floor((x - plotLeft) / barWidth)));
            const candleTime = state.candles[index]?.[0];
            if (!candleTime) return;
            indicators.vp.begin(state.layout, candleTime);
            state.drag = { mode: "volumeProfile" };
            canvas.setPointerCapture(event.pointerId);
            canvas.style.cursor = "crosshair";
            draw();
            return;
        }

        state.drag = {
            mode: onPriceScale ? "price" : "pan",
            x,
            y,
            offset: state.offset,
            priceShift: state.priceShift,
            priceScale: state.priceScale,
            barWidth,
            plotHeight: mainHeight,
            baseMidpoint: state.layout.baseMidpoint,
            baseRange: state.layout.baseRange,
            anchorRatio: Math.max(0, Math.min(1, (y - plotTop) / mainHeight)),
            anchorPrice: state.layout.maxPrice -
                ((y - plotTop) / mainHeight) * (state.layout.maxPrice - state.layout.minPrice),
            visibleCandles: state.layout.candles
        };
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
    }

    function onPointerMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        state.hover = { x, y };

        if (state.drag) {
            if (state.drag.mode === "volumeProfile") {
                const { plotLeft, plotWidth, barWidth, start, candles } = state.layout;
                const localIndex = Math.min(candles.length - 1, Math.max(0,
                    Math.floor((x - plotLeft) / barWidth)));
                const candleTime = state.candles[start + localIndex]?.[0];
                if (candleTime && indicators.vp?.move) indicators.vp.move(state.layout, candleTime);
            } else if (state.drag.mode === "pan") {
                const move = Math.round((x - state.drag.x) / state.drag.barWidth);
                state.offset = Math.max(0, Math.min(
                    state.candles.length - state.visible,
                    state.drag.offset + move
                ));
            } else {
                const scale = Math.max(0.5, Math.min(6,
                    state.drag.priceScale * Math.exp((y - state.drag.y) * 0.005)
                ));
                state.priceScale = scale;
                const range = state.drag.baseRange * scale;
                const midpoint = state.drag.anchorPrice +
                    (state.drag.anchorRatio - 0.5) * range;
                state.priceShift = midpoint - state.drag.baseMidpoint;
            }
        }
        draw();
    }

    function endDrag(event) {
        state.drag = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        canvas.style.cursor = state.hover?.x > canvas.clientWidth - RIGHT ? "ns-resize" : "crosshair";
        indicators.vp?.end?.();
        draw();
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", () => {
        if (!state.drag) {
            state.hover = null;
            draw();
        }
    });
    canvas.addEventListener("wheel", event => {
        if (!state.candles.length) return;
        event.preventDefault();
        state.visible = Math.max(MIN_VISIBLE, Math.min(
            MAX_VISIBLE,
            state.visible + (event.deltaY > 0 ? 15 : -15)
        ));
        state.offset = Math.min(state.offset, Math.max(0, state.candles.length - state.visible));
        draw();
    }, { passive: false });
    canvas.addEventListener("dblclick", () => {
        state.visible = 100;
        state.offset = 0;
        state.priceScale = 1;
        state.priceShift = 0;
        draw();
    });

    showMacdInput?.addEventListener("change", draw);
    showRsiInput?.addEventListener("change", draw);
    showEma1Input?.addEventListener("change", draw);
    showEma2Input?.addEventListener("change", draw);
    showMa1Input?.addEventListener("change", draw);
    showMa2Input?.addEventListener("change", draw);
    tradeActionButtons.forEach(button => {
        button.addEventListener("click", () => {
            selectedTradeAction = button.dataset.action;
            tradeActionButtons.forEach(actionButton => {
                const selected = actionButton === button;
                actionButton.dataset.active = String(selected);
                actionButton.setAttribute("aria-pressed", String(selected));
            });
            updateTradeSettings();
        });
    });
    tradeSideInput?.addEventListener("change", updateTradeSettings);
    [balanceInput, marginInput, leverageInput]
        .filter(input => input)
        .forEach(input => {
            input.addEventListener("input", updateTradeSettings);
        });
    updateTradeSettings();

    applyIndicatorsButton?.addEventListener("click", () => {
        const periods = Object.fromEntries(
            Object.entries(indicatorInputs)
                .filter(([, input]) => input)
                .map(([name, input]) => [name, Number(input.value)])
        );
        if (!Object.values(periods).every(period => Number.isInteger(period) && period >= 1 && period <= 500) ||
            periods.fast >= periods.slow) {
            setStatus("Indicator-ийн үе 1–500 байх ба MACD Fast нь Slow-оос бага байх ёстой.", "error");
            return;
        }
        state.periods = periods;
        calculateIndicators();
        draw();
        setStatus(`${state.symbol} · ${state.market} · ${state.interval} · indicator шинэчлэгдлээ`, "live");
    });

    window.addEventListener("chart:market-change", () => {
        loadHistory();
    });
    window.addEventListener("chart:interval-change", () => loadHistory());
    window.addEventListener("chart:ticker-change", () => loadHistory());
    reloadButton?.addEventListener("click", () => loadHistory(false));

    if ("ResizeObserver" in window) {
        new ResizeObserver(draw).observe(canvas.parentElement);
    } else {
        window.addEventListener("resize", draw);
    }

    chartControls.ticker?.load?.(marketInput.value);
    loadHistory();
    window.setInterval(pollLatest, LIVE_POLL_MS);
    updateCountdown();
    window.setInterval(updateCountdown, 1000);
})();