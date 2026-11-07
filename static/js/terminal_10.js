const exchangeListTerminal = {
    binance: '#28a745', kucoin: '#009292', mexc: '#00b2ff', bybit: '#f39c12', 
    okx: '#34E0FF', gateio: '#f84949', bitget: '#00D1FF', htx: '#00A6FF', 
    bitmart: '#00cc99', phemex: '#2980b9'
};
let activeTerminalExchange = null;
let allTerminalExchangeData = [];
let currentSortTerminal = { col: 'change', desc: true };
let terminalTimerInterval = null;
let lastLoggedCountTerminal = 0;
let exchangeMetadataTerminal = {}; 

function addTerminalLog(msg) {
    const container = document.getElementById('terminal-log-container');
    if (!container) return;
    if (container.children.length > 50) container.removeChild(container.firstChild);
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const div = document.createElement('div');
    div.className = "mb-1 border-l border-green-500/20 pl-2 text-[9px]";
    div.innerHTML = `<span class="text-gray-600 mr-2">[${time}]</span> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function getTerminalApiError(raw) {
    if (raw?.error) return raw.details || raw.error;
    if (raw?.retCode != null && Number(raw.retCode) !== 0) return raw.retMsg || `API code ${raw.retCode}`;
    if (raw?.code != null && !['0', '00000', '200000', '1000'].includes(String(raw.code))) {
        return raw.msg || `API code ${raw.code}`;
    }
    if (raw?.status && !['ok', 'success'].includes(String(raw.status).toLowerCase())) {
        return raw.message || `API status ${raw.status}`;
    }
    return null;
}

function initTerminalButtons() {
    const container = document.getElementById('exchange-buttons');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(exchangeListTerminal).forEach(([id, color]) => {
        const btn = document.createElement('button');
        btn.id = `btn-term-${id}`;
        btn.className = 'px-3 py-1.5 rounded font-black text-[9px] uppercase transition-all border';
        btn.style.backgroundColor = color + '15';
        btn.style.color = color;
        btn.style.borderColor = color + '30';
        btn.textContent = `${id} START`;
        btn.onclick = () => toggleTerminalExchange(id);
        container.appendChild(btn);
    });
}

function scanTerminalRisk(obj, foundTags = new Set()) {
    const stMarker = /(^|[^A-Z0-9])ST([^A-Z0-9]|$)|SPECIAL[\s_-]+TREATMENT/i;
    if (typeof obj === 'string') {
        if (stMarker.test(obj)) foundTags.add('ST');
    } else if (Array.isArray(obj)) {
        obj.forEach(item => scanTerminalRisk(item, foundTags));
    } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(v => scanTerminalRisk(v, foundTags));
    }
    return Array.from(foundTags).join('/');
}

function getFullNameTerminal(symbol, info) {
    const base = symbol.split(/[/-]/)[0];
    let name = base;
    const nameKeys = ['fullName', 'baseCurrencyFullName', 'displayName', 'assetName', 'baseAsset', 'coinName', 'name'];
    for (let k of nameKeys) {
        if (info[k] && typeof info[k] === 'string' && info[k].toUpperCase() !== base.toUpperCase()) {
            name = info[k];
            break;
        }
    }
    name = name.replace('/USDT', '').trim();
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

async function fetchTerminalExchangeInfo(ex) {
    const type = document.getElementById('terminal-market-type')?.value || 'spot';
    const marketKey = `${ex}:${type}`;
    try {
        const res = await fetch(`/api/universal?exchange=${ex}&type=${type}&info=true`);
        const raw = await res.json();
        const apiError = getTerminalApiError(raw);
        if (!res.ok || apiError) {
            throw new Error(apiError || `HTTP ${res.status}`);
        }
        exchangeMetadataTerminal[marketKey] = {};
        let list = [];
        if (Array.isArray(raw)) list = raw;
        else if (raw.symbols && Array.isArray(raw.symbols)) list = raw.symbols;
        else if (raw.data?.products && Array.isArray(raw.data.products)) list = raw.data.products;
        else if (raw.data?.symbols && Array.isArray(raw.data.symbols)) list = raw.data.symbols;
        else if (raw.data && Array.isArray(raw.data)) list = raw.data;
        else if (raw.result?.list && Array.isArray(raw.result.list)) list = raw.result.list;
        else if (raw.result && Array.isArray(raw.result)) list = raw.result;
        
        list.forEach(m => {
            const sym = (m.symbol || m.instId || m.currency_pair || m.id || '').toUpperCase();
            let minQty = 0, minCost = 0;
            if (ex === 'binance' || ex === 'mexc') {
                const f = m.filters?.find(f => f.filterType === 'LOT_SIZE');
                minQty = parseFloat(f?.minQty || 0);
                minCost = parseFloat(m.filters?.find(f => f.filterType === 'NOTIONAL')?.minNotional || 0);
            } else if (ex === 'kucoin') {
                minQty = parseFloat(m.baseMinSize || 0); minCost = parseFloat(m.minFunds || 0);
            } else if (ex === 'bybit') {
                minQty = parseFloat(m.lotSizeFilter?.minOrderQty || 0);
            } else if (ex === 'bitmart') {
                minQty = parseFloat(m.min_buy_amount || 0); minCost = parseFloat(m.min_notional || 0);
            } else if (ex === 'gateio') {
                minCost = parseFloat(m.min_quote_amount || 0);
            }
            exchangeMetadataTerminal[marketKey][sym] = { minQty, minCost };
        });
        addTerminalLog(`✅ ${ex.toUpperCase()} limits loaded.`);
    } catch (e) {
        addTerminalLog(`⚠️ ${ex.toUpperCase()} metadata error: ${e.message}`);
        throw e;
    }
}

async function toggleTerminalExchange(id) {
    const timerEl = document.getElementById('terminal-timer');
    if (activeTerminalExchange === id) {
        activeTerminalExchange = null;
        clearInterval(terminalTimerInterval);
        addTerminalLog(`${id.toUpperCase()} connection terminated.`);
        if (timerEl) timerEl.textContent = "OFF";
        const b = document.getElementById(`btn-term-${id}`);
        if (b) {
            b.textContent = `${id} START`;
            b.style.backgroundColor = exchangeListTerminal[id] + '15';
            b.style.color = exchangeListTerminal[id];
            b.style.borderColor = exchangeListTerminal[id] + '30';
        }
        allTerminalExchangeData = [];
        lastLoggedCountTerminal = 0;
        renderTerminalUI();
        return;
    }
    Object.keys(exchangeListTerminal).forEach(ex => {
        const b = document.getElementById(`btn-term-${ex}`);
        if (b) { 
            b.textContent = `${ex} START`; 
            b.style.backgroundColor = exchangeListTerminal[ex] + '15'; 
            b.style.color = exchangeListTerminal[ex];
            b.style.borderColor = exchangeListTerminal[ex] + '30';
        }
    });
    activeTerminalExchange = id;
    const activeBtn = document.getElementById(`btn-term-${id}`);
    if (activeBtn) {
        activeBtn.textContent = `${id} STOP`;
        activeBtn.style.backgroundColor = '#ef444420';
        activeBtn.style.borderColor = '#ef444450';
        activeBtn.style.color = '#ef4444';
    }
    addTerminalLog(`Connecting to ${id.toUpperCase()}...`);
    const marketType = document.getElementById('terminal-market-type')?.value || 'spot';
    const marketKey = `${id}:${marketType}`;
    if (!exchangeMetadataTerminal[marketKey]) {
        try {
            await fetchTerminalExchangeInfo(id);
        } catch (e) {
            addTerminalLog(`⚠️ ${id.toUpperCase()} limits unavailable; continuing with market data.`);
        }
    }
    fetchTerminalTickerData();
    if (terminalTimerInterval) clearInterval(terminalTimerInterval);
    let countdown = 50;
    terminalTimerInterval = setInterval(() => {
        countdown--;
        if (timerEl) timerEl.textContent = (countdown / 10).toFixed(1) + "s";
        if (countdown <= 0) { countdown = 50; fetchTerminalTickerData(); }
    }, 100);
}

async function fetchTerminalTickerData() {
    if (!activeTerminalExchange) return;
    const type = document.getElementById('terminal-market-type')?.value || 'spot';
    try {
        const res = await fetch(`/api/universal?exchange=${activeTerminalExchange}&type=${type}`);
        const raw = await res.json();
        const apiError = getTerminalApiError(raw);
        if (!res.ok || apiError) {
            throw new Error(apiError || `HTTP ${res.status}`);
        }
        processTerminalTickerData(activeTerminalExchange, raw);
    } catch (e) { addTerminalLog(`⚠️ Error fetching ${activeTerminalExchange.toUpperCase()}: ${e.message}`); }
}

function processTerminalTickerData(ex, rawData) {
    let processed = [];
    let list = Array.isArray(rawData) ? rawData : (rawData.data?.ticker || rawData.result?.list || rawData.result || rawData.data || rawData.ticks || rawData.tick?.data || []);
    if (!Array.isArray(list)) {
        addTerminalLog(`⚠️ ${ex.toUpperCase()} returned an unsupported data format.`);
        return;
    }
    const isArrayOfArrays = Array.isArray(list) && list.length > 0 && Array.isArray(list[0]);
    
    list.forEach(t => {
        let symbol, lastRaw, bidRaw, askRaw, changeRaw;
        if (isArrayOfArrays) {
            symbol = t[0]; lastRaw = t[1]; bidRaw = t[2]; askRaw = t[3];
            changeRaw = t[4] ? ((Number(t[1]) - Number(t[4])) / Number(t[4])) * 100 : 0;
        } else {
            const ticker = t.tick && typeof t.tick === 'object'
                ? { ...t.tick, symbol: t.contract_code || t.symbol || t.tick.symbol }
                : t;
            symbol = (ticker.symbol || ticker.instId || ticker.s || ticker.currency_pair || ticker.inst_id || ticker.pair || ticker.contract || ticker.contract_code || '').toUpperCase();
            lastRaw = ticker.lastPrice || ticker.last || ticker.lastPr || ticker.close || ticker.last_price || ticker.sell || ticker.lastEp || ticker.lastTradePrice || ticker.price;
            bidRaw = ticker.bidPrice || ticker.buy || ticker.bid1Price || ticker.bidPx || ticker.highest_bid || ticker.bidPr || ticker.best_bid || ticker.bid1 || ticker.bidEp || ticker.bestBidPrice || ticker.bid?.[0];
            askRaw = ticker.askPrice || ticker.sell || ticker.ask1Price || ticker.askPx || ticker.lowest_ask || ticker.askPr || ticker.best_ask || ticker.ask1 || ticker.askEp || ticker.bestAskPrice || ticker.ask?.[0];
            changeRaw = ticker.priceChangePercent || ticker.changeRate || ticker.price24hPcnt || ticker.change_percentage || ticker.change24h || ticker.fluctuation || ticker.ratio24h || ticker.priceChgPct || ticker.riseFallRate;
            const openPrice = ticker.open ?? ticker.open24h;
            if (!changeRaw && Number(openPrice) > 0 && Number(lastRaw) > 0) {
                changeRaw = ((Number(lastRaw) - Number(openPrice)) / Number(openPrice)) * 100;
            }
        }
        
        if (!symbol || !symbol.includes('USDT')) return;

        let lastNum = parseFloat(lastRaw) || 0;
        let bidNum = parseFloat(bidRaw) || lastNum;
        let askNum = parseFloat(askRaw) || lastNum;
        let change = parseFloat(changeRaw || 0);

        const type = document.getElementById('terminal-market-type')?.value || 'spot';
        if (ex === 'kucoin' || ex === 'bybit' || ex === 'okx' || ex === 'bitget' && type === 'swap' || ex === 'mexc' && type === 'swap') change *= 100;
        if (t.lastEp || t.bidEp || (ex === 'phemex' && lastNum > 10000000)) { lastNum /= 1e8; bidNum /= 1e8; askNum /= 1e8; }
        if (lastNum === 0) return;

        const spread = bidNum > 0 ? ((askNum - bidNum) / bidNum * 100) : 0;
        let minUsdt = 0;
        const meta = exchangeMetadataTerminal[`${ex}:${type}`]?.[symbol];
        if (meta) { if (meta.minCost > 0) minUsdt = meta.minCost; else if (meta.minQty > 0) minUsdt = meta.minQty * askNum; }

        processed.push({
            name: getFullNameTerminal(symbol, t),
            symbol: symbol.replace(/[-_:/]/g, '').replace('USDT', '/USDT'),
            price: lastNum, bid: bidNum, ask: askNum,
            spread: spread, change: change,
            min_usdt: minUsdt, tags: scanTerminalRisk(t)
        });
    });

    allTerminalExchangeData = processed;
    if (processed.length !== lastLoggedCountTerminal) {
        addTerminalLog(`${ex.toUpperCase()} Feed: ${processed.length} pairs active.`);
        lastLoggedCountTerminal = processed.length;
    }
    renderTerminalUI();
}

function renderTerminalUI() {
    const tbody = document.getElementById('terminal-master-table');
    const search = document.getElementById('terminal-global-search')?.value.trim().toUpperCase();
    if (!tbody) return;
    tbody.innerHTML = '';

    let data = [...allTerminalExchangeData];
    if (search) data = data.filter(d => d.symbol.includes(search) || (d.name && d.name.toUpperCase().includes(search)));

    data.sort((a, b) => {
        let valA = a[currentSortTerminal.col], valB = b[currentSortTerminal.col];
        if (typeof valA === 'string') return currentSortTerminal.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        return currentSortTerminal.desc ? valB - valA : valA - valB;
    });

    data.forEach(d => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color:#aaa" class="p-3">${d.name}</td>
            <td class="font-bold p-3">${d.symbol}</td>
            <td class="text-right p-3">$${d.price.toFixed(6).replace(/\.?0+$/, "")}</td>
            <td class="text-right p-3 text-yellow-500">${d.spread.toFixed(2)}%</td>
            <td class="text-right p-3 font-bold ${d.change >= 0 ? 'text-green-500' : 'text-red-500'}">${d.change >= 0 ? '+' : ''}${d.change.toFixed(2)}%</td>
            <td class="p-3">${d.tags ? `<span class="bg-red-500/20 text-red-500 text-[8px] font-black px-1.5 py-0.5 rounded">${d.tags}</span>` : ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateSortTerminal(col) {
    if (currentSortTerminal.col === col) currentSortTerminal.desc = !currentSortTerminal.desc;
    else { currentSortTerminal.col = col; currentSortTerminal.desc = true; }
    renderTerminalUI();
}

function resetAndFetchTerminal() { if (activeTerminalExchange) { const id = activeTerminalExchange; activeTerminalExchange = null; toggleTerminalExchange(id); } }

// Хуудас ачаалагдахад товчлуурнуудыг найдвартай үүсгэх
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTerminalButtons);
} else {
    initTerminalButtons();
}