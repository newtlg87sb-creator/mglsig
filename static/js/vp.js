(function () {
    "use strict";

    let enabled = false;
    let selection = null;
    let dragSelection = null;
    let candles = [];
    let statusElement = null;
    let interval = "1m";
    let formatTime = String;
    let dragAnchor = null;

    function calculate(selected, sourceCandles = candles) {
        if (!selected || !sourceCandles.length) return null;
        const selectedCandles = sourceCandles.filter(candle =>
            candle[0] >= selected.startTime && candle[0] <= selected.endTime
        );
        if (!selectedCandles.length) return null;

        const binCount = 32;
        let minPrice = Math.min(...selectedCandles.map(candle => candle[3]));
        let maxPrice = Math.max(...selectedCandles.map(candle => candle[2]));
        if (minPrice === maxPrice) {
            const padding = Math.max(Math.abs(minPrice) * 0.000001, 0.00000001);
            minPrice -= padding;
            maxPrice += padding;
        }

        const binSize = (maxPrice - minPrice) / binCount;
        const bins = new Array(binCount).fill(0);
        selectedCandles.forEach(candle => {
            const volume = Math.max(0, candle[5]);
            if (!Number.isFinite(volume) || volume === 0) return;
            const low = candle[3];
            const high = candle[2];
            if (high <= low) {
                const index = Math.min(binCount - 1, Math.max(0, Math.floor((low - minPrice) / binSize)));
                bins[index] += volume;
                return;
            }
            const firstBin = Math.max(0, Math.floor((low - minPrice) / binSize));
            const lastBin = Math.min(binCount - 1, Math.floor((high - minPrice) / binSize));
            for (let index = firstBin; index <= lastBin; index++) {
                const binLow = minPrice + index * binSize;
                const binHigh = binLow + binSize;
                const overlap = Math.max(0, Math.min(high, binHigh) - Math.max(low, binLow));
                bins[index] += volume * overlap / (high - low);
            }
        });
        const maxVolume = Math.max(...bins);
        return { bins, candleCount: selectedCandles.length, minPrice, maxPrice, pocIndex: bins.indexOf(maxVolume) };
    }

    function updateStatus() {
        if (!statusElement) return;
        if (!enabled) {
            statusElement.textContent = "";
            return;
        }
        if (!selection) {
            statusElement.textContent = "VP · Эхлэлээс төгсгөл хүртэл чирнэ үү";
            return;
        }
        const profile = calculate(selection);
        statusElement.textContent = profile
            ? `VP · ${profile.candleCount} лаа · ${formatTime(selection.startTime)} → ${formatTime(selection.endTime)} · ойролцоо`
            : "VP · Сонгосон хүрээнд лаа алга";
    }

    function drawSelection(ctx, selected, plotLeft, plotTop, plotWidth, mainHeight, barWidth) {
        if (!selected) return;
        const selectedIndices = [];
        candles.forEach((candle, index) => {
            if (candle[0] >= selected.startTime && candle[0] <= selected.endTime) selectedIndices.push(index);
        });
        if (!selectedIndices.length) return;
        const visibleLeft = Math.max(plotLeft, plotLeft + selectedIndices[0] * barWidth);
        const visibleRight = Math.min(plotLeft + plotWidth, plotLeft + (selectedIndices[selectedIndices.length - 1] + 1) * barWidth);
        if (visibleRight <= visibleLeft) return;
        ctx.save();
        ctx.fillStyle = "rgba(197, 160, 89, .08)";
        ctx.fillRect(visibleLeft, plotTop, visibleRight - visibleLeft, mainHeight);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(197, 160, 89, .65)";
        [visibleLeft, visibleRight].forEach(x => {
            ctx.beginPath();
            ctx.moveTo(x, plotTop);
            ctx.lineTo(x, plotTop + mainHeight);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawProfile(ctx, profile, priceToY, plotLeft, plotTop, plotWidth, mainHeight) {
        const maxVolume = Math.max(...profile.bins);
        if (!maxVolume) return;
        const binSize = (profile.maxPrice - profile.minPrice) / profile.bins.length;
        const maxBarWidth = Math.min(150, plotWidth * 0.32);
        const right = plotLeft + plotWidth;
        ctx.save();
        ctx.beginPath();
        ctx.rect(plotLeft, plotTop, plotWidth, mainHeight);
        ctx.clip();
        profile.bins.forEach((volume, index) => {
            if (!volume) return;
            const binLow = profile.minPrice + index * binSize;
            const binHigh = binLow + binSize;
            const top = Math.max(plotTop, priceToY(binHigh));
            const bottom = Math.min(plotTop + mainHeight, priceToY(binLow));
            if (bottom <= top) return;
            const width = maxBarWidth * volume / maxVolume;
            ctx.fillStyle = index === profile.pocIndex
                ? "rgba(197, 160, 89, .78)"
                : "rgba(90, 160, 195, .38)";
            ctx.fillRect(right - width, top, width, Math.max(1, bottom - top - 0.5));
        });
        const pocPrice = profile.minPrice + (profile.pocIndex + 0.5) * binSize;
        const pocY = priceToY(pocPrice);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(255, 213, 128, .9)";
        ctx.beginPath();
        ctx.moveTo(Math.max(plotLeft, right - maxBarWidth), pocY);
        ctx.lineTo(right, pocY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function configure(options) {
        statusElement = options.statusElement;
        formatTime = options.formatTime;
        interval = options.getInterval();
        const input = document.getElementById("showVolumeProfile");
        if (input) {
            input.addEventListener("change", () => {
                enabled = input.checked;
                if (!enabled) selection = null;
                dragSelection = null;
                dragAnchor = null;
                updateStatus();
                options.onChange();
            });
        }
    }

    window.ChartIndicators = window.ChartIndicators || {};
    window.ChartIndicators.vp = {
        configure,
        updateCandles(value) { candles = value || []; },
        updateInterval(value) { interval = value; },
        isEnabled() { return enabled; },
        getSelection() { return selection; },
        getDragSelection() { return dragSelection; },
        calculate,
        updateStatus,
        drawSelection,
        drawProfile,
        begin(layout, candleTime) {
            dragAnchor = candleTime;
            dragSelection = { startTime: candleTime, endTime: candleTime };
            selection = dragSelection;
            updateStatus();
        },
        move(layout, candleTime) {
            if (!dragSelection || dragAnchor === null) return;
            dragSelection = {
                startTime: Math.min(dragAnchor, candleTime),
                endTime: Math.max(dragAnchor, candleTime)
            };
            selection = dragSelection;
            updateStatus();
        },
        end() { dragSelection = null; dragAnchor = null; },
        clear() { selection = null; dragSelection = null; dragAnchor = null; updateStatus(); }
    };
})();
