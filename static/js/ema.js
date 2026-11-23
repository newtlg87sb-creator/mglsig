(function () {
    "use strict";
    function calculate(closes, period) {
        if (!closes.length) return [];
        const multiplier = 2 / (period + 1);
        const result = [closes[0]];
        for (let i = 1; i < closes.length; i++) result.push(closes[i] * multiplier + result[i - 1] * (1 - multiplier));
        return result;
    }
    function draw(ctx, values, color, { start, candles, plotLeft, plotWidth, barWidth, priceToY }) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
        let drawing = false;
        values.slice(start, start + candles.length).forEach((value, i) => {
            if (!Number.isFinite(value)) { drawing = false; return; }
            const x = plotLeft + (i + 0.5) * barWidth;
            const y = priceToY(value);
            if (drawing) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            drawing = true;
        });
        ctx.stroke();
    }
    window.ChartIndicators = window.ChartIndicators || {};
    window.ChartIndicators.ema = { calculate, draw };
})();
