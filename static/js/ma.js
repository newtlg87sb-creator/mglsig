(function () {
    "use strict";
    function calculate(closes, period) {
        const result = new Array(closes.length).fill(null);
        let sum = 0;
        for (let i = 0; i < closes.length; i++) {
            sum += closes[i];
            if (i >= period) sum -= closes[i - period];
            if (i >= period - 1) result[i] = sum / period;
        }
        return result;
    }
    function draw(ctx, values, color, options) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        let drawing = false;
        values.slice(options.start, options.start + options.candles.length).forEach((value, i) => {
            if (!Number.isFinite(value)) {
                drawing = false;
                return;
            }
            const x = options.plotLeft + (i + 0.5) * options.barWidth;
            const y = options.priceToY(value);
            if (drawing) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
            drawing = true;
        });
        ctx.stroke();
    }
    window.ChartIndicators = window.ChartIndicators || {};
    window.ChartIndicators.ma = { calculate, draw };
})();
