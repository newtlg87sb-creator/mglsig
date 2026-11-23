(function () {
    "use strict";

    const input = document.getElementById("interval");
    if (!input) return;

    window.ChartControls = window.ChartControls || {};
    window.ChartControls.interval = {
        input,
        get value() {
            return input.value;
        }
    };

    input.addEventListener("change", () => {
        window.dispatchEvent(new CustomEvent("chart:interval-change", {
            detail: { interval: input.value }
        }));
    });
})();
