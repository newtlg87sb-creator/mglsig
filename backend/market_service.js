const axios = require('axios');
const supabase = require('./supabaseClient');

const EXCHANGES = {
    binance: 'https://api.binance.com/api/v3/ticker/24hr',
    mexc: 'https://api.mexc.com/api/v3/ticker/24hr',
    bybit: 'https://api.bybit.com/v5/market/tickers?category=spot',
    kucoin: 'https://api.kucoin.com/api/v1/market/allTickers'
};

let state = {
    marketData: { binance: [], mexc: [], bybit: [], kucoin: [], lastUpdate: null },
    symbols: [],
    isSyncing: false
};

async function updateMarketDataCache() {
    if (state.isSyncing) return;
    state.isSyncing = true;
    try {
        const [bRes, mRes, byRes, kRes] = await Promise.all([
            axios.get(EXCHANGES.binance, { timeout: 12000 }).catch(() => ({ data: [] })),
            axios.get(EXCHANGES.mexc, { timeout: 12000 }).catch(() => ({ data: [] })),
            axios.get(EXCHANGES.bybit, { timeout: 12000 }).catch(() => ({ data: { result: { list: [] } } })),
            axios.get(EXCHANGES.kucoin, { timeout: 12000 }).catch(() => ({ data: { data: { ticker: [] } } }))
        ]);

        state.marketData = {
            binance: bRes.data || [],
            mexc: mRes.data || [],
            bybit: byRes.data?.result?.list || [],
            kucoin: kRes.data?.data?.ticker || [],
            lastUpdate: new Date()
        };

        if (supabase && state.marketData.binance.length > 0) {
            // KuCoin Intelligence хүснэгтэд зориулж датаг мөр бүрээр форматлах
            const records = state.marketData.kucoin.map(k => {
                const symbol = k.symbol.replace('-', '');
                const b = state.marketData.binance.find(t => t.symbol === symbol);
                
                const bid = parseFloat(k.buy) || 0;
                const ask = parseFloat(k.sell) || 0;

                return {
                    symbol: k.symbol, // Жишээ нь: BTC-USDT
                    bid: bid,
                    ask: ask,
                    spread: bid > 0 ? ((ask - bid) / bid) * 100 : 0,
                    min_usdt: 1.0,
                    volume: parseFloat(k.volValue) || 0,
                    real_change: b ? parseFloat(b.priceChangePercent) : 0,
                    change_24h: (parseFloat(k.changeRate) || 0) * 100,
                    updated_at: new Date()
                };
            }).filter(r => r.volume > 1000); // Зөвхөн идэвхтэй арилжааг авах

            // Датаг Upsert хийх (Байвал шинэчилнэ, байхгүй бол нэмнэ)
            const { error } = await supabase
                .from('market_data')
                .upsert(records, { onConflict: 'symbol' });

            if (error) console.error("Supabase Sync Error:", error.message);
        }
    } catch (error) {
        console.error(`Market Service Fetch error: ${error.message}`);
    } finally {
        state.isSyncing = false;
    }
}

async function updateSymbolsCache() {
    try {
        const resB = await axios.get('https://api.binance.com/api/v3/exchangeInfo', { timeout: 15000 });
        state.symbols = resB.data.symbols
            .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
            .map(s => s.symbol);
        console.log(`Market Service: ${state.symbols.length} symbols synced.`);
    } catch (e) {
        console.error(`Symbols Sync Error: ${e.message}`);
    }
}

// Автомат шинэчлэлтүүдийг эхлүүлэх
function start() {
    setInterval(updateMarketDataCache, 20000);
    setInterval(updateSymbolsCache, 3600000);
    updateMarketDataCache();
    updateSymbolsCache();
    console.log("Market Service initialized.");
}

module.exports = {
    start,
    getMarketData: () => state.marketData,
    getSymbols: () => state.symbols
};