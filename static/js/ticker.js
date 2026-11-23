(function () {
    "use strict";

    const input = document.getElementById("symbol");
    const suggestions = document.getElementById("symbol-suggestions");
    const status = document.getElementById("symbols-status");
    if (!input) return;

    const cache = new Map();
    let requestId = 0;
    let controller = null;

    function normalize() {
        return input.value.trim().toUpperCase();
    }

    function render(symbols) {
        const options = document.createDocumentFragment();
        symbols.forEach(symbol => {
            const option = document.createElement("option");
            option.value = symbol;
            options.append(option);
        });
        suggestions.replaceChildren(options);
        if (status) status.textContent = `${symbols.length.toLocaleString()} хослол`;
    }

    async function load(market) {
        const selectedMarket = market || window.ChartControls?.market?.value || "spot";
        const currentRequest = ++requestId;
        controller?.abort();
        controller = null;

        const cached = cache.get(selectedMarket);
        if (cached) {
            render(cached);
            return;
        }

        controller = new AbortController();
        if (status) status.textContent = "Хослолын жагсаалт...";

        const url = selectedMarket === "futures"
            ? "https://fapi.binance.com/fapi/v1/exchangeInfo"
            : "https://api.binance.com/api/v3/exchangeInfo";

        try {
            const response = await fetch(url, { cache: "force-cache", signal: controller.signal });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.msg || `Биржийн хүсэлт амжилтгүй (HTTP ${response.status}).`);
            }
            if (!Array.isArray(data.symbols)) throw new Error("Биржийн хослолын жагсаалт буруу байна.");

            const symbols = data.symbols
                .filter(item => item.status === "TRADING" && item.quoteAsset === "USDT" &&
                    (selectedMarket !== "futures" || item.contractType === "PERPETUAL"))
                .map(item => item.symbol)
                .sort();
            if (!symbols.length) throw new Error("Арилжааны хослолын жагсаалт хоосон байна.");
            if (currentRequest !== requestId) return;

            cache.set(selectedMarket, symbols);
            render(symbols);
        } catch (error) {
            if (error.name === "AbortError" || currentRequest !== requestId) return;
            if (status) status.textContent = "Хослолын санал авах боломжгүй";
            console.error("[CHART SYMBOLS ERROR]", error);
        } finally {
            if (currentRequest === requestId) controller = null;
        }
    }

    window.ChartControls = window.ChartControls || {};
    window.ChartControls.ticker = {
        input,
        suggestions,
        status,
        get value() {
            return normalize();
        },
        set value(value) {
            input.value = String(value).trim().toUpperCase();
        },
        load
    };

    input.addEventListener("change", () => {
        input.value = normalize();
        window.dispatchEvent(new CustomEvent("chart:ticker-change", {
            detail: { ticker: input.value }
        }));
    });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            input.value = normalize();
            window.dispatchEvent(new CustomEvent("chart:ticker-change", {
                detail: { ticker: input.value }
            }));
        }
    });

    window.addEventListener("chart:market-change", event => {
        load(event.detail.market);
    });
})();
