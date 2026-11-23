(function () {
    "use strict";

    function calculate(closes, period) {
        if (!closes.length) return [];
        const win = Math.max(1, Number(period) || 14);
        if (closes.length <= win) return new Array(closes.length).fill(NaN);

        const result = new Array(closes.length).fill(NaN);
        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 1; i <= win; i++) {
            const change = closes[i] - closes[i - 1];
            avgGain += change > 0 ? change : 0;
            avgLoss += change < 0 ? -change : 0;
        }
        avgGain /= win;
        avgLoss /= win;

        result[win] = avgLoss === 0
            ? 100
            : 100 - (100 / (1 + avgGain / avgLoss));

        for (let i = win + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            avgGain = (avgGain * (win - 1) + (change > 0 ? change : 0)) / win;
            avgLoss = (avgLoss * (win - 1) + (change < 0 ? -change : 0)) / win;
            result[i] = avgLoss === 0
                ? 100
                : 100 - (100 / (1 + avgGain / avgLoss));
        }
        return result;
    }

    function draw(ctx, values, period, { start, candles, plotLeft, plotWidth, top, height, barWidth, hoverIndex }) {
        const innerTop = top + 16;
        const innerHeight = Math.max(1, height - 20);
        const valueToY = value => innerTop + (100 - value) / 100 * innerHeight;

        ctx.strokeStyle = "#26303d";
        ctx.beginPath();
        ctx.moveTo(plotLeft, top);
        ctx.lineTo(plotLeft + plotWidth, top);
        ctx.stroke();

        ctx.fillStyle = "#7e8da0";
        ctx.font = "10px Inter, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`RSI (${period})`, plotLeft + 5, top + 3);

        ctx.setLineDash([3, 3]);
        [70, 50, 30].forEach(value => {
            const y = valueToY(value);
            ctx.strokeStyle = value === 50 ? "#26303d" : "rgba(214, 225, 238, .28)";
            ctx.beginPath();
            ctx.moveTo(plotLeft, y);
            ctx.lineTo(plotLeft + plotWidth, y);
            ctx.stroke();
        });
        ctx.setLineDash([]);

        ctx.fillStyle = "#8795a7";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        [100, 70, 50, 30, 0].forEach(value => {
            ctx.fillText(String(value), plotLeft + plotWidth - 4, valueToY(value));
        });

        const visibleValues = values.slice(start, start + candles.length);
        ctx.strokeStyle = "#b679e5";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let drawing = false;
        visibleValues.forEach((value, i) => {
            if (!Number.isFinite(value)) {
                drawing = false;
                return;
            }
            const x = plotLeft + (i + 0.5) * barWidth;
            const y = valueToY(Math.max(0, Math.min(100, value)));
            if (drawing) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
            drawing = true;
        });
        ctx.stroke();

        if (hoverIndex !== null) {
            const i = hoverIndex - start;
            if (i >= 0 && i < visibleValues.length && Number.isFinite(visibleValues[i])) {
                ctx.fillStyle = "#b679e5";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`RSI ${visibleValues[i].toFixed(2)}`, plotLeft + 130, top + 3);
            }
        }
    }

    window.ChartIndicators = window.ChartIndicators || {};
    window.ChartIndicators.rsi = { calculate, draw };
})();
