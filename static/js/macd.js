(function () {
    "use strict";
    function ema(values, period) {
        if (!values.length) return [];
        const multiplier = 2 / (period + 1);
        const result = [values[0]];
        for (let i = 1; i < values.length; i++) result.push(values[i] * multiplier + result[i - 1] * (1 - multiplier));
        return result;
    }
    function calculate(closes, periods) {
        const fast = ema(closes, periods.fast);
        const slow = ema(closes, periods.slow);
        const macd = fast.map((value, i) => value - slow[i]);
        const signal = ema(macd, periods.signal);
        return { macd, signal, histogram: macd.map((value, i) => value - signal[i]) };
    }
    function draw(ctx, data, periods, { start, candles, plotLeft, plotWidth, top, height, barWidth, hoverIndex }) {
        const macd = data.macd.slice(start, start + candles.length);
        const signal = data.signal.slice(start, start + candles.length);
        const histogram = data.histogram.slice(start, start + candles.length);
        const values = [...macd, ...signal, ...histogram, 0];
        let min = Math.min(...values);
        let max = Math.max(...values);
        if (max === min) { min += 1; max -= 1; }
        const innerTop = top + 16;
        const innerHeight = Math.max(1, height - 20);
        const valueToY = value => innerTop + (max - value) / (max - min) * innerHeight;
        const zeroY = valueToY(0);
        ctx.strokeStyle = "#26303d";
        ctx.beginPath(); ctx.moveTo(plotLeft, top); ctx.lineTo(plotLeft + plotWidth, top); ctx.stroke();
        ctx.fillStyle = "#7e8da0"; ctx.font = "10px Inter, Arial, sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(`MACD (${periods.fast}, ${periods.slow}, ${periods.signal})`, plotLeft + 5, top + 3);
        ctx.beginPath(); ctx.moveTo(plotLeft, zeroY); ctx.lineTo(plotLeft + plotWidth, zeroY); ctx.stroke();
        histogram.forEach((value, i) => {
            const x = plotLeft + (i + 0.5) * barWidth;
            ctx.fillStyle = value >= 0 ? "rgba(38, 201, 139, .72)" : "rgba(240, 93, 104, .72)";
            ctx.fillRect(x - Math.max(1, barWidth * 0.32), Math.min(zeroY, valueToY(value)),
                Math.max(1, barWidth * 0.64), Math.max(1, Math.abs(valueToY(value) - zeroY)));
        });
        [[macd, "#40b8f5"], [signal, "#f5a64a"]].forEach(([series, color]) => {
            ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
            series.forEach((value, i) => {
                const x = plotLeft + (i + 0.5) * barWidth;
                const y = valueToY(value);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        if (hoverIndex !== null) {
            const i = hoverIndex - start;
            if (i >= 0 && i < macd.length) {
                ctx.fillStyle = "#40b8f5";
                ctx.fillText(`MACD ${macd[i].toFixed(6)}   Signal ${signal[i].toFixed(6)}`, plotLeft + 130, top + 3);
            }
        }
    }
    window.ChartIndicators = window.ChartIndicators || {};
    window.ChartIndicators.macd = { calculate, draw };
})();
