window.arbInterval = window.arbInterval || null;
window.detailInterval = window.detailInterval || null;
window.exchangeSpotInterval = window.exchangeSpotInterval || null;
let lastExchangeSpotData = []; 
let isExchangeScanning = false;
let currentExchange = ''; // 'binance', 'mexc', 'bybit', 'kucoin'
let exchangeSearchQuery = '';

function showTool(toolId) {
    const contentArea = document.getElementById('content-area');
    const toolTitle = document.getElementById('tool-title');
    
    // Сонгогдсон линкийг идэвхжүүлэх
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-link'));
    const activeLink = document.getElementById(`link-${toolId}`);
    if (activeLink) activeLink.classList.add('active-link');

    // Хуучин интервалыг цэвэрлэх
    if (window.arbInterval) clearInterval(window.arbInterval);
    if (window.detailInterval) clearInterval(window.detailInterval);
    if (window.exchangeSpotInterval) clearInterval(window.exchangeSpotInterval);

    if (toolId === 'arbitrage') {
        toolTitle.innerHTML = 'Arbitrage <span class="text-brand-gold">Price Comparison</span>';
        contentArea.innerHTML = `
            <!-- Search Section -->
            <div class="mb-4 glass-card p-4 rounded-xl border border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="relative w-full max-w-md">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                    <input type="text" id="arb-search" oninput="updateArbSearch(this.value)" placeholder="Search Asset (e.g. BTC)..." 
                        class="w-full bg-brand-dark border border-brand-border text-white text-xs rounded-lg pl-9 pr-4 py-2 focus:border-brand-gold outline-none transition-all uppercase font-bold tracking-wider">
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-[9px] text-gray-500 font-black uppercase tracking-wider">Min Vol:</label>
                    <select onchange="updateMinVolFilter(this.value)" class="bg-brand-dark border border-brand-border text-white text-[10px] rounded-lg px-2 py-1.5 focus:border-brand-gold outline-none font-bold">
                        <option value="0">No Limit</option>
                        <option value="5000">$5K+</option>
                        <option value="20000">$20K+</option>
                        <option value="100000">$100K+</option>
                    </select>
                </div>
                <div class="text-[10px] text-brand-gold font-black uppercase tracking-[0.2em] hidden md:block italic">Buy Low / Sell High Signal</div>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden shadow-2xl">
                <div class="overflow-x-auto">
                    <table class="w-full text-left min-w-[800px] md:min-w-0">
                        <thead class="bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-brand-border">
                            <tr>
                                <th class="p-4">Asset (USDT)</th>
                                <th class="p-4">Binance</th>
                                <th class="p-4">MEXC</th>
                                <th class="p-4">Bybit</th>
                                <th class="p-4">KuCoin</th>
                                <th class="p-4">Spread</th>
                                <th class="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody id="arbitrage-table-body" class="text-xs">
                            <tr>
                                <td colspan="7" class="p-4 text-center text-gray-500 italic">
                                    <i class="fas fa-spinner fa-spin mr-2"></i> Comparing exchange prices...
                                </td>
                            </tr>
                            <!-- Data loaded via JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        fetchArbitrageData();
        if (window.arbInterval) clearInterval(window.arbInterval);
        window.arbInterval = setInterval(fetchArbitrageData, 15000);
    } else if (toolId.endsWith('_spot')) {
        const exchangeId = toolId.replace('_spot', '');
        currentExchange = exchangeId;
        
        const exchangeNames = {
            binance: 'Binance',
            mexc: 'MEXC Global',
            bybit: 'Bybit',
            kucoin: 'KuCoin'
        };
        
        const displayTitle = exchangeNames[exchangeId] || exchangeId.toUpperCase();
        
        toolTitle.innerHTML = `${displayTitle} <span class="text-brand-gold">Partner Exchange</span>`;
        contentArea.innerHTML = `
            <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-250px)] animate-in fade-in duration-500">
                <div class="w-full lg:w-1/3 flex flex-col gap-3">
                    <div class="flex items-center justify-between px-2">
                        <h3 class="text-[10px] font-black text-brand-gold uppercase tracking-widest">EXCHANGE LOGS</h3>
                        <span id="exchange-status-badge" class="text-[9px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold uppercase">Stopped</span>
                    </div>
                    <div id="exchange-logs" class="flex-1 bg-black border border-brand-border rounded-xl p-4 font-mono text-[10px] text-green-500 overflow-y-auto shadow-inner">
                        <div class="opacity-50 italic">[System] Ready to scan ${displayTitle} Market...</div>
                    </div>
                </div>

                <div class="w-full lg:w-2/3 flex flex-col gap-4">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <button id="btn-exchange-toggle" onclick="toggleExchangeScan()" class="flex-1 bg-[#009292] hover:opacity-90 text-white font-black py-4 rounded-xl transition-all uppercase text-xs tracking-widest shadow-lg">
                            CONNECT TO ${exchangeId.toUpperCase()}
                        </button>
                        <div class="relative flex-1">
                            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                            <input type="text" id="exchange-search" oninput="updateExchangeSearch(this.value)" placeholder="SEARCH SYMBOL..." 
                                class="w-full h-full bg-brand-dark border border-brand-border text-white text-xs rounded-xl pl-11 pr-4 py-3 focus:border-brand-gold outline-none transition-all uppercase font-bold">
                        </div>
                    </div>

                    <div class="glass-card rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col min-h-0">
                        <div class="overflow-x-auto overflow-y-auto">
                            <div class="min-w-[600px] md:min-w-0">
                                <table class="w-full text-left border-collapse">
                                    <thead class="sticky top-0 bg-black/80 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-brand-border z-10">
                                        <tr>
                                            <th class="p-4 border-r border-brand-border/30">Symbol</th>
                                            <th class="p-4">Last Price</th>
                                            <th class="p-4">Bid (Sell)</th>
                                            <th class="p-4">Ask (Buy)</th>
                                            <th class="p-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="exchange-spot-table-body" class="text-xs">
                                        <tr>
                                            <td colspan="5" class="p-12 text-center text-gray-600 font-bold uppercase tracking-widest italic">
                                                Press START to fetch market data
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        resetExchangeState();
    }
}

function resetExchangeState() {
    isExchangeScanning = false;
    lastExchangeSpotData = [];
    if (window.exchangeSpotInterval) clearInterval(window.exchangeSpotInterval);
}

function addExchangeLog(msg) {
    const logContainer = document.getElementById('exchange-logs');
    if (!logContainer) return;
    
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const logEntry = document.createElement('div');
    logEntry.className = "mb-1";
    logEntry.innerHTML = `<span class="opacity-50">[${time}]</span> ${msg}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateExchangeSearch(val) {
    exchangeSearchQuery = val.trim().toUpperCase();
    renderExchangeSpotTable();
}

function toggleExchangeScan() {
    const btn = document.getElementById('btn-exchange-toggle');
    const badge = document.getElementById('exchange-status-badge');
    if (!btn || !badge) return;
    
    if (!isExchangeScanning) {
        isExchangeScanning = true;
        btn.innerText = `STOP ${currentExchange.toUpperCase()} LIST`;
        btn.style.backgroundColor = "#dc3545";
        badge.innerText = "Scanning";
        badge.className = "text-[9px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-bold uppercase animate-pulse";
        
        const exchangeNames = {
            binance: 'Binance',
            mexc: 'MEXC',
            bybit: 'Bybit',
            kucoin: 'KuCoin'
        };
        addExchangeLog(`${exchangeNames[currentExchange]}-аас мэдээлэл татаж байна...`);
        fetchExchangeSpotData();
        if (window.exchangeSpotInterval) clearInterval(window.exchangeSpotInterval);
        window.exchangeSpotInterval = setInterval(fetchExchangeSpotData, 5000);
    } else {
        isExchangeScanning = false;
        btn.innerText = `START ${currentExchange.toUpperCase()} LIST`;
        btn.style.backgroundColor = "#009292";
        badge.innerText = "Stopped";
        badge.className = "text-[9px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold uppercase";
        
        addExchangeLog("Scanning halted by user.");
        if (window.exchangeSpotInterval) clearInterval(window.exchangeSpotInterval);
    }
}

async function fetchExchangeSpotData() {
    if (!isExchangeScanning) return;
    
    try {
        const response = await fetch('/api/arbitrage');
        
        if (!response.ok) {
             addExchangeLog(`⚠️ Сервер түр саатлаа (${response.status}). Дахин оролдож байна...`);
             return;
        }

        const result = await response.json();
        
        if (result && Array.isArray(result.data)) {
            // Биржийн key-г тодорхойлох (b: binance, m: mexc, by: bybit, k: kucoin)
            const keyMap = { binance: 'b', mexc: 'm', bybit: 'by', kucoin: 'k' };
            const key = keyMap[currentExchange];
            
            const newData = result.data.filter(item => item[key]).map(item => ({
                symbol: item.symbol,
                last: item[key].p,
                bid: item[key].bp,
                ask: item[key].ap
            }));
            
            if (lastExchangeSpotData.length === 0) {
                addExchangeLog(`Нийт ${newData.length} USDT хос олдлоо.`);
            }
            lastExchangeSpotData = newData;
            renderExchangeSpotTable();
        } else {
            throw new Error(result.msg || "Unknown API error");
        }
    } catch (error) {
        addExchangeLog(`⚠️ Алдаа: ${error.message}`);
    }
}

function renderExchangeSpotTable() {
    const tableBody = document.getElementById('exchange-spot-table-body');
    if (!tableBody) return;

    let filteredData = [...lastExchangeSpotData];
    if (exchangeSearchQuery) {
        filteredData = filteredData.filter(item => item.symbol.includes(exchangeSearchQuery));
    }

    if (filteredData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-600 font-bold uppercase tracking-widest italic">No matching results</td></tr>`;
        return;
    }

    tableBody.innerHTML = filteredData.map(item => {
        // Бирж тус бүрийн арилжааны URL үүсгэх
        let tradeUrl = '';
        if (currentExchange === 'binance') tradeUrl = `https://www.binance.com/en/trade/${item.symbol.replace('USDT','_USDT')}`;
        else if (currentExchange === 'mexc') tradeUrl = `https://www.mexc.com/exchange/${item.symbol.replace('USDT','_USDT')}`;
        else if (currentExchange === 'bybit') tradeUrl = `https://www.bybit.com/en/trade/spot/${item.symbol.replace('USDT','')}/USDT`;
        else if (currentExchange === 'kucoin') tradeUrl = `https://www.kucoin.com/trade/${item.symbol.replace('USDT','-USDT')}`;

        // Үнэ форматлах функцийг arbitrage-scanner.js-ээс ашиглаж байгаа гэж үзэв
        const priceFormatter = typeof formatArbPrice === 'function' ? formatArbPrice : (p) => p;

        return `
            <tr class="border-b border-brand-border hover:bg-white/5 transition-colors">
                <td class="p-4 font-black text-white italic text-xs border-r border-brand-border/30 bg-black/20">${item.symbol}</td>
                <td class="p-4 font-mono text-[11px] text-gray-400">$${priceFormatter(item.last)}</td>
                <td class="p-4 font-mono text-[11px] text-red-500 font-bold">$${priceFormatter(item.bid)}</td>
                <td class="p-4 font-mono text-[11px] text-green-500 font-bold">$${priceFormatter(item.ask)}</td>
                <td class="p-4 text-right">
                    <a href="${tradeUrl}" target="_blank" class="text-[10px] font-black text-brand-gold hover:text-white transition uppercase tracking-tighter">
                        TRADE <i class="fas fa-external-link-alt ml-1"></i>
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}