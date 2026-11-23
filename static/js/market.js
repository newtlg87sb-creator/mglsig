(function () {
    "use strict";

    const input = document.getElementById("market");
    if (!input) return;

    window.ChartControls = window.ChartControls || {};
    window.ChartControls.market = {
        input,
        get value() {
            return input.value;
        }
    };

    input.addEventListener("change", () => {
        window.dispatchEvent(new CustomEvent("chart:market-change", {
            detail: { market: input.value }
        }));
    });
})();
