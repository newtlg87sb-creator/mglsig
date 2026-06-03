(function() {
    const currentScript = document.currentScript;
    if (!currentScript) return;

    // 🚨 Удирдлагын HTML хэсэг
    const controlHTML = `
    <div class="controls-container flex flex-wrap items-center gap-2 md:gap-4 p-3 md:p-4 bg-brand-dark-blue border border-brand-border rounded-xl shadow-lg">
        <div class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="market" class="text-gray-500 font-bold uppercase text-[10px]">Market:</label>
            <select id="market" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs shadow-inner">
                <option value="futures" selected>Futures</option>
                <option value="spot">Spot</option>
            </select>
        </div>

        <div class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="interval" class="text-gray-500 font-bold uppercase text-[10px]">Time:</label>
            <select id="interval" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs shadow-inner">
                <option value="1s">1s</option>
                <option value="1m" selected>1m</option>
                <option value="3m">3m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="30m">30m</option>
                <option value="1h">1h</option>
                <option value="2h">2h</option>
                <option value="4h">4h</option>
                <option value="6h">6h</option>
                <option value="8h">8h</option>
                <option value="12h">12h</option>
                <option value="1d">1d</option>
                <option value="3d">3d</option>
                <option value="1w">1w</option>
                <option value="1M">1M</option>
            </select>
        </div>

        <div id="pair-container" class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="coin" class="text-gray-500 font-bold uppercase text-[10px]">Pair:</label>
            <input type="text" id="coin" value="BTCUSDT" list="coin-list" placeholder="Search..." class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 w-24 md:w-32 uppercase font-bold text-[10px] md:text-xs shadow-inner transition-colors" />
            <datalist id="coin-list"></datalist>
        </div>

        <div id="rsi-control" class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="rsi-period" class="text-gray-500 font-bold uppercase text-[10px]">RSI Len:</label>
            <input type="number" id="rsi-period" value="14" min="1" max="100" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 w-12 md:w-16 text-[10px] md:text-xs shadow-inner transition-colors" />
        </div>

        <div id="ema-control" class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="ema-period" class="text-gray-500 font-bold uppercase text-[10px]">EMA Len:</label>
            <input type="number" id="ema-period" value="20" min="1" max="500" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 w-12 md:w-16 text-[10px] md:text-xs shadow-inner transition-colors" />
        </div>

        <div id="ma-control" class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="ma-period" class="text-gray-500 font-bold uppercase text-[10px]">MA Len:</label>
            <input type="number" id="ma-period" value="20" min="1" max="500" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 w-12 md:w-16 text-[10px] md:text-xs shadow-inner transition-colors" />
        </div>

        <div id="leverage-control" class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="leverage" class="text-gray-500 font-bold uppercase text-[10px]">Lev:</label>
            <div class="relative flex items-center">
                <input type="number" id="leverage" value="20" min="1" max="125" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 w-12 md:w-16 text-[10px] md:text-xs shadow-inner transition-colors pr-4" />
                <span class="absolute right-1.5 text-[9px] font-black text-brand-gold pointer-events-none uppercase">x</span>
            </div>
        </div>

        <div id="balance-control" class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="initial-balance" class="text-gray-500 font-bold uppercase text-[10px]">Balance:</label>
            <input type="number" id="initial-balance" value="1000" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 w-16 md:w-24 text-[10px] md:text-xs shadow-inner transition-colors" />
        </div>

        <div id="side-control" class="control-item flex items-center space-x-1.5 md:space-x-2">
            <label for="side" class="text-gray-500 font-bold uppercase text-[10px]">Side:</label>
            <select id="side" class="bg-brand-dark border border-brand-border text-white rounded px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs shadow-inner">
                <option value="long">Long</option>
                <option value="short">Short</option>
                <option value="both">Long + Short</option>
            </select>
        </div>
    </div>
    `;

    currentScript.insertAdjacentHTML('beforebegin', controlHTML);

    // LIVE Статус индикатор нэмэх
    const controls = document.querySelector('.controls-container');
    controls.insertAdjacentHTML('beforeend', `<div id="ws-status" class="ml-auto flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-lg border border-brand-border"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" id="ws-dot"></span><span class="text-[9px] font-black uppercase text-gray-500" id="ws-text">Disconnected</span></div>`);

    async function fetchAndPopulateSymbols() {
        const marketEl = document.getElementById("market");
        const coinList = document.getElementById('coin-list');
        if (coinList) coinList.innerHTML = '';
        const market = marketEl ? marketEl.value : 'spot';
        const url = market === 'futures' ? 'https://fapi.binance.com/fapi/v1/exchangeInfo' : 'https://api.binance.com/api/v3/exchangeInfo';
        try {
            const response = await fetch(url);
            const data = await response.json();
            const symbols = data.symbols || [];
            let usdtSymbols = market === 'futures' 
                ? symbols.filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.contractType === 'PERPETUAL').map(s => s.symbol)
                : symbols.filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING' && !s.symbol.endsWith('UP') && !s.symbol.endsWith('DOWN') && !s.symbol.endsWith('BEAR') && !s.symbol.endsWith('BULL')).map(s => s.symbol);
            usdtSymbols.sort().forEach(symbol => {
                const option = document.createElement('option');
                option.value = symbol;
                coinList.appendChild(option);
            });
        } catch (error) { console.error("Failed to fetch symbol list:", error); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const marketEl = document.getElementById("market");
        const intervalEl = document.getElementById("interval");

        window.syncControlsAndFetch = function() {
            if (!marketEl || !intervalEl) return;
            const isFutures = marketEl.value === 'futures';
            const option1s = intervalEl.querySelector('option[value="1s"]');
            if (isFutures) {
                if (option1s) option1s.style.display = 'none';
                if (intervalEl.value === '1s') intervalEl.value = '1m';
            } else {
                if (option1s) option1s.style.display = 'block';
            }
            fetchAndPopulateSymbols();
        }
        syncControlsAndFetch();

        // Скрипт дуудагдсан tag-аас 'data-hide' атрибутыг шалгаж хэрэггүй хэсгүүдийг нуух
        const hideConfig = currentScript.getAttribute('data-hide');
        if (hideConfig) {
            hideConfig.split(',').forEach(id => {
                const el = document.getElementById(id.trim() + '-control') || document.getElementById(id.trim());
                if (el) el.style.display = 'none';
            });
        }

        if (marketEl) marketEl.addEventListener('change', syncControlsAndFetch);
    });
})();