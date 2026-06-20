// Finance Eye — Background Service Worker
// Market data via 金十数据 API

const JINSHI_TOKEN = 'sk-uCij9Beo2q-mHjcEGw1li9Ec2xe9DnjhhlJWUZOwkTQ';
const JINSHI_BASE = 'https://api.jin10.com';
const REFRESH_INTERVAL = 10; // seconds for active watchers

let activeWatchers = 0;
let refreshTimer = null;

// ExtPay initialization
try {
  const extpay = ExtPay('finance-eye');
  extpay.startBackground();
} catch(e) {
  console.error('finance-eye: ExtPay init failed', e);
}

chrome.runtime.onInstalled.addListener(() => console.log('Finance Eye ready'));

// Message handler
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'getQuotes') {
    getQuotes(req.symbols || ['CNY=X', 'GC=F', 'CL=F', '^GSPC', 'USDCNY=X']).then(sendResponse);
    return true;
  }
  if (req.action === 'getWatchlist') {
    chrome.storage.local.get(['watchlist'], data => sendResponse(data.watchlist || ['AAPL', 'TSLA', 'BTC-USD', 'GC=F', '^GSPC']));
    return true;
  }
  if (req.action === 'saveWatchlist') {
    chrome.storage.local.set({ watchlist: req.symbols }, () => sendResponse({ ok: true }));
    return true;
  }
  if (req.action === 'startWatching') {
    activeWatchers++;
    if (!refreshTimer) startAutoRefresh();
    sendResponse({ watching: true });
  }
  if (req.action === 'stopWatching') {
    activeWatchers = Math.max(0, activeWatchers - 1);
    if (activeWatchers <= 0) stopAutoRefresh();
    sendResponse({ watching: false });
  }
});

// Fetch quotes from 金十数据
async function getQuotes(symbols) {
  if (!Array.isArray(symbols)) symbols = [symbols];
  
  try {
    // Try 金十 data real-time quotes endpoint
    const resp = await fetch(`${JINSHI_BASE}/flash/v2/real/time?codes=${symbols.join(',')}`, {
      headers: { 'Authorization': `Bearer ${JINSHI_TOKEN}`, 'Accept': 'application/json' }
    });
    
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.data) {
        return transformQuotes(data.data, symbols);
      }
    }
  } catch (e) {
    console.error('金十primary API failed, trying fallback:', e.message);
  }

  // Fallback: Yahoo Finance (free, no auth needed)
  return await getYahooQuotes(symbols);
}

// Transform 金十 data format to our quote format
function transformQuotes(data, symbols) {
  return symbols.map(sym => {
    const d = data[sym] || data[sym.toUpperCase()] || {};
    return {
      symbol: sym,
      name: d.name || sym,
      price: d.price || d.last || d.close || 0,
      change: d.change || d.chg || 0,
      changePercent: d.changePercent || d.chg_percent || d.percent || 0,
      high: d.high || 0,
      low: d.low || 0,
      volume: d.volume || d.vol || 0,
      updated: Date.now()
    };
  });
}

// Yahoo Finance fallback
async function getYahooQuotes(symbols) {
  try {
    const yahooSymbols = symbols.map(s => s.replace('CNY=X', 'CNYUSD=X').replace('-USD', ''));
    const resp = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols.join(',')}`);
    if (!resp.ok) return getMockQuotes(symbols);
    
    const data = await resp.json();
    const result = data.quoteResponse?.result || [];
    
    return result.map(r => ({
      symbol: r.symbol,
      name: r.shortName || r.symbol,
      price: r.regularMarketPrice || 0,
      change: r.regularMarketChange || 0,
      changePercent: r.regularMarketChangePercent || 0,
      high: r.regularMarketDayHigh || 0,
      low: r.regularMarketDayLow || 0,
      volume: r.regularMarketVolume || 0,
      currency: r.currency || 'USD',
      updated: Date.now()
    }));
  } catch (e) {
    return getMockQuotes(symbols);
  }
}

// Mock data as last resort
function getMockQuotes(symbols) {
  const mockPrices = {
    'AAPL': { name: 'Apple Inc.', price: 195.89, change: 1.23, changePercent: 0.63 },
    'TSLA': { name: 'Tesla Inc.', price: 248.50, change: -3.20, changePercent: -1.27 },
    'GC=F': { name: 'Gold Futures', price: 2342.10, change: 12.30, changePercent: 0.53 },
    'BTC-USD': { name: 'Bitcoin USD', price: 67890, change: 1234, changePercent: 1.85 },
    '^GSPC': { name: 'S&P 500', price: 5478.32, change: 15.67, changePercent: 0.29 },
    'CNY=X': { name: 'USD/CNY', price: 7.2456, change: -0.0032, changePercent: -0.04 },
    'CL=F': { name: 'Crude Oil', price: 78.45, change: -0.89, changePercent: -1.12 }
  };
  
  return symbols.map(s => {
    const m = mockPrices[s] || { name: s, price: 100, change: 0, changePercent: 0 };
    return { symbol: s, name: m.name, price: m.price, change: m.change, changePercent: m.changePercent, updated: Date.now(), mock: true };
  });
}

// Auto-refresh for active watchers
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    if (activeWatchers > 0) {
      chrome.storage.local.get(['watchlist'], data => {
        getQuotes(data.watchlist || ['AAPL', 'TSLA', 'GC=F']).then(quotes => {
          chrome.runtime.sendMessage({ action: 'quotesUpdate', quotes }).catch(() => {});
        });
      });
    } else {
      stopAutoRefresh();
    }
  }, REFRESH_INTERVAL * 1000);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}
