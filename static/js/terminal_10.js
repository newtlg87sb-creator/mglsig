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
    const riskKeywords = ['ST', 'MONITORING', 'SEED', 'DELIST', 'WARNING', 'RISK', 'SPECIAL'];
    if (typeof obj === 'string') {
        const valUp = obj.toUpperCase();
        riskKeywords.forEach(kw => { if (valUp.includes(kw)) foundTags.add(kw); });
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
    try {
        const res = await fetch(`/api/universal?exchange=${ex}&type=${type}&info=true`);
        const raw = await res.json();
        exchangeMetadataTerminal[ex] = {};
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
            exchangeMetadataTerminal[ex][sym] = { minQty, minCost };
        });
        addTerminalLog(`✅ ${ex.toUpperCase()} limits loaded.`);
    } catch (e) { addTerminalLog(`⚠️ ${ex.toUpperCase()} metadata error: ${e.message}`); }
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
    if (!exchangeMetadataTerminal[id]) await fetchTerminalExchangeInfo(id);
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
        processTerminalTickerData(activeTerminalExchange, raw);
    } catch (e) { addTerminalLog(`⚠️ Error fetching ${activeTerminalExchange.toUpperCase()}: ${e.message}`); }
}

function processTerminalTickerData(ex, rawData) {
    let processed = [];
    let list = Array.isArray(rawData) ? rawData : (rawData.data?.ticker || rawData.result?.list || rawData.result || rawData.data || rawData.tick?.data || []);
    const isArrayOfArrays = list.length > 0 && Array.isArray(list[0]);
    
    list.forEach(t => {
        let symbol, lastRaw, bidRaw, askRaw, changeRaw;
        if (isArrayOfArrays) {
            symbol = t[0]; lastRaw = t[1]; bidRaw = t[2]; askRaw = t[3]; changeRaw = t[8];
        } else {
            symbol = (t.symbol || t.instId || t.s || t.currency_pair || t.inst_id || t.pair || '').toUpperCase();
            lastRaw = t.lastPrice || t.last || t.lastPr || t.close || t.last_price || t.sell || t.lastEp;
            bidRaw = t.bidPrice || t.buy || t.bid1Price || t.bidPx || t.highest_bid || t.bidPr || t.best_bid || t.bid1 || t.bidEp;
            askRaw = t.askPrice || t.sell || t.ask1Price || t.askPx || t.lowest_ask || t.askPr || t.best_ask || t.ask1 || t.askEp;
            changeRaw = t.priceChangePercent || t.changeRate || t.price24hPcnt || t.change_percentage || t.change24h || t.fluctuation || t.ratio24h;
        }
        
        if (!symbol || !symbol.includes('USDT')) return;

        let lastNum = parseFloat(lastRaw) || 0;
        let bidNum = parseFloat(bidRaw) || lastNum;
        let askNum = parseFloat(askRaw) || lastNum;
        let change = parseFloat(changeRaw || 0);

        if (ex === 'kucoin' || ex === 'bybit' || ex === 'okx') change *= 100;
        if (t.lastEp || t.bidEp || (ex === 'phemex' && lastNum > 10000000)) { lastNum /= 1e8; bidNum /= 1e8; askNum /= 1e8; }
        if (lastNum === 0) return;

        const spread = bidNum > 0 ? ((askNum - bidNum) / bidNum * 100) : 0;
        let minUsdt = 0;
        const meta = exchangeMetadataTerminal[ex]?.[symbol];
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
            <td class="p-3"><span class="bg-red-500/20 text-red-500 text-[8px] font-black px-1.5 py-0.5 rounded">${d.tags}</span></td>
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