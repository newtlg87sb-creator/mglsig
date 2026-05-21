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
            await supabase.from('market_data').insert([{ data: state.marketData, created_at: new Date() }]);
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