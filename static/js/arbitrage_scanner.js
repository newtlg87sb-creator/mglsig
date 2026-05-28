/**
 * Arbitrage Scanner Engine - Frontend Version
 * Энэ функц нь биржүүдээс шууд дата татаж арилжааны зөрүүг тооцоолно.
 */
async function getArbitrageData() {
    const EXCHANGES = {
        binance: 'https://api1.binance.com/api/v3/ticker/24hr',
        mexc: 'https://api.mexc.com/api/v3/ticker/24hr',
        bybit: 'https://api.bybit.com/v5/market/tickers?category=spot',
        kucoin: 'https://api.kucoin.com/api/v1/market/allTickers'
    };

    const safeFetch = async (url, defaultVal) => {
        try {
            const r = await fetch(url);
            if (!r.ok) return defaultVal;
            return await r.json();
        } catch (e) {
            console.error(`Fetch failed for ${url}:`, e.message);
            return defaultVal;
        }
    };

    try {
        const [bRes, mRes, byRes, kRes] = await Promise.all([
            safeFetch(EXCHANGES.binance, []),
            safeFetch(EXCHANGES.mexc, []),
            safeFetch(EXCHANGES.bybit, { result: { list: [] } }),
            safeFetch(EXCHANGES.kucoin, { data: { ticker: [] } })
        ]);

        const bData = Array.isArray(bRes) ? bRes : [];
        const mData = Array.isArray(mRes) ? mRes : [];
        const byData = byRes?.result?.list || [];
        const kData = kRes?.data?.ticker || [];

        // Filter Active Coins (> 500 USDT Volume)
        const filterActive = (list, volKey) => list.filter(t => parseFloat(t[volKey]) > 500);

        const marketData = {
            binance: filterActive(bData, 'quoteVolume'),
            mexc: filterActive(mData, 'quoteVolume'),
            bybit: filterActive(byData, 'turnover24h'),
            kucoin: filterActive(kData, 'volValue')
        };

        const allSymbols = new Set([
            ...marketData.binance.filter(t => t.symbol?.endsWith('USDT')).map(t => t.symbol),
            ...marketData.mexc.filter(t => t.symbol?.endsWith('USDT')).map(t => t.symbol),
            ...marketData.bybit.filter(t => t.symbol?.endsWith('USDT')).map(t => t.symbol),
            ...marketData.kucoin.filter(t => t.symbol?.endsWith('-USDT')).map(t => t.symbol.replace('-', ''))
        ]);

        const mPool = new Map(marketData.mexc.map(t => [t.symbol, t]));
        const byPool = new Map(marketData.bybit.map(t => [t.symbol, t]));
        const kPool = new Map(marketData.kucoin.map(t => [t.symbol.replace('-', ''), t]));
        const bPool = new Map(marketData.binance.map(t => [t.symbol, t]));

        const formatted = Array.from(allSymbols).map(symbol => {
            const b = bPool.get(symbol); const m = mPool.get(symbol);
            const by = byPool.get(symbol); const k = kPool.get(symbol);

            const prices = [];
            if (b?.lastPrice) prices.push(parseFloat(b.lastPrice));
            if (m?.lastPrice) prices.push(parseFloat(m.lastPrice));
            if (by?.lastPrice) prices.push(parseFloat(by.lastPrice));
            if (k?.last) prices.push(parseFloat(k.last));

            const validPrices = prices.filter(p => !isNaN(p) && p > 0);
            let diff = 0;
            if (validPrices.length > 1) {
                const min = Math.min(...validPrices);
                diff = ((Math.max(...validPrices) - min) / min) * 100;
            }

            const createData = (t, type) => {
                if (!t) return null;
                if (type === 'k') return { p: parseFloat(t.last), bp: parseFloat(t.buy), ap: parseFloat(t.sell), v: parseFloat(t.vol), q: parseFloat(t.volValue) };
                if (type === 'by') return { p: parseFloat(t.lastPrice), bp: parseFloat(t.bid1Price), ap: parseFloat(t.ask1Price), v: parseFloat(t.volume24h), q: parseFloat(t.turnover24h) };
                return { p: parseFloat(t.lastPrice), bp: parseFloat(t.bidPrice), ap: parseFloat(t.askPrice), v: parseFloat(t.volume), q: parseFloat(t.quoteVolume) };
            };

            return { symbol, b: createData(b, 'b'), m: createData(m, 'm'), by: createData(by, 'by'), k: createData(k, 'k'), diff: diff.toFixed(2) };
        }).filter(item => item.b || item.m || item.by || item.k);

        return formatted.sort((a, b) => parseFloat(b.diff) - parseFloat(a.diff));
    } catch (e) { console.error("Scanner Error:", e); return []; }
}