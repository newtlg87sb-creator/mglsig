export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const EXCHANGES = {
        binance: 'https://api.binance.com/api/v3/ticker/24hr',
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

        // Ensure we have arrays to prevent .filter/.map crashes if an API returns an error object
        const bData = Array.isArray(bRes) ? bRes : [];
        const mData = Array.isArray(mRes) ? mRes : [];
        const byData = byRes?.result?.list && Array.isArray(byRes.result.list) ? byRes.result.list : [];
        const kData = kRes?.data?.ticker && Array.isArray(kRes.data.ticker) ? kRes.data.ticker : [];

        const marketData = {
            binance: bData,
            mexc: mData,
            bybit: byData,
            kucoin: kData,
            lastUpdate: new Date()
        };

        // Хэрэв Binance-аас дата ирээгүй бол алдаа өгөхгүйгээр хоосон буцаах
        if (marketData.binance.length === 0) {
            return res.status(200).json({ data: [], message: "No data from Binance" });
        }

        // Use Maps for O(1) lookups to prevent execution timeouts on Vercel
        const mPool = new Map(marketData.mexc.map(t => [t.symbol, t]));
        const byPool = new Map(marketData.bybit.map(t => [t.symbol, t]));
        const kPool = new Map(marketData.kucoin.map(t => [t.symbol.replace('-', ''), t]));

        const formatted = marketData.binance
            .filter(b => b.symbol && b.symbol.endsWith('USDT'))
            .map(b => {
                const symbol = b.symbol;
                const m = mPool.get(symbol);
                const by = byPool.get(symbol);
                const k = kPool.get(symbol);

            const prices = [];
            if (b?.lastPrice) prices.push(parseFloat(b.lastPrice));
            if (m?.lastPrice) prices.push(parseFloat(m.lastPrice));
            if (by?.lastPrice) prices.push(parseFloat(by.lastPrice));
            if (k?.last) prices.push(parseFloat(k.last));

            // Filter out any NaN results
            const validPrices = prices.filter(p => !isNaN(p) && p > 0);

            let diff = 0;
            if (validPrices.length > 1) {
                const min = Math.min(...validPrices);
                diff = ((Math.max(...validPrices) - min) / min) * 100;
            }

            const createData = (t, type) => {
                if (!t) return null;
                if (type === 'k') return { p: parseFloat(t.last) || 0, bp: parseFloat(t.buy) || 0, ap: parseFloat(t.sell) || 0, v: parseFloat(t.vol) || 0, q: parseFloat(t.volValue) || 0 };
                if (type === 'by') return { p: parseFloat(t.lastPrice) || 0, bp: parseFloat(t.bid1Price) || 0, ap: parseFloat(t.ask1Price) || 0, v: parseFloat(t.volume24h) || 0, q: parseFloat(t.turnover24h) || 0 };
                return { p: parseFloat(t.lastPrice) || 0, bp: parseFloat(t.bidPrice) || 0, ap: parseFloat(t.askPrice) || 0, v: parseFloat(t.volume) || 0, q: parseFloat(t.quoteVolume) || 0 };
            };

            return {
                symbol,
                b: createData(b, 'b'),
                m: createData(m, 'm'),
                by: createData(by, 'by'),
                k: createData(k, 'k'),
                diff: diff.toFixed(2)
            };
        }).filter(item => parseFloat(item.diff) > 0);

        formatted.sort((a, b) => parseFloat(b.diff) - parseFloat(a.diff));

        return res.status(200).json({ data: formatted });
    } catch (error) {
        console.error("Arbitrage API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}