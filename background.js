// ExtPay - Payment integration
importScripts('ExtPay.js');
const extpay = ExtPay('finance-eye');
extpay.startBackground();

// Finance Eye - Background Service Worker
// 实时行情抓取 + 价格预警

const JINSHI_API = 'https://open-data.jinshijijin.com/data-api/v1';

const DEFAULTS = {
  jinshiKey: '',
  watchList: ['上证指数', '深证成指', '创业板指', '黄金', '原油'],
  alertThreshold: 2, // 涨跌 2% 预警
  refreshInterval: 5, // 分钟
  theme: 'dark'
};

// ===== Init =====
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) await chrome.storage.sync.set({ settings: DEFAULTS });
  await chrome.storage.local.set({ lastPrices: {}, alerts: [] });
  startPolling();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'fetchQuotes') fetchAndNotify();
});

async function startPolling() {
  const { settings } = await chrome.storage.sync.get('settings');
  const interval = (settings || DEFAULTS).refreshInterval || 5;
  await chrome.alarms.clear('fetchQuotes');
  chrome.alarms.create('fetchQuotes', { periodInMinutes: interval });
}

// ===== 行情抓取 =====
async function fetchQuotes(symbols) {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = settings || DEFAULTS;
  const list = symbols || s.watchList;

  try {
    const resp = await fetch(`${JINSHI_API}/market?token=${s.jinshiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    return processQuotes(data, list, s);
  } catch (e) {
    return { error: e.message, quotes: [], alerts: [] };
  }
}

function processQuotes(data, watchList, settings) {
  const quotes = [];
  const alerts = [];

  // Parse 金十数据 response structure
  const items = data?.data?.list || data?.data || data?.list || [];
  for (const item of items) {
    if (!watchList.some(w => item.name?.includes(w) || item.symbol?.includes(w))) continue;
    
    const quote = {
      name: item.name || item.symbol,
      price: parseFloat(item.price || item.latest),
      change: parseFloat(item.change || item.changePercent || 0),
      changePercent: parseFloat(item.changePercent || item.changeRate || 0),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      volume: item.volume,
      time: item.time || new Date().toISOString()
    };

    quotes.push(quote);

    // 价格预警检测
    if (Math.abs(quote.changePercent) >= (settings.alertThreshold || 2)) {
      const direction = quote.changePercent > 0 ? '📈' : '📉';
      const alert = {
        id: Date.now() + Math.random(),
        title: `${direction} ${quote.name} ${direction === '📈' ? '大涨' : '大跌'}`,
        message: `${quote.name}: ${quote.price} (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`,
        time: new Date().toISOString()
      };
      alerts.push(alert);

      chrome.notifications.create(`alert-${alert.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: alert.title,
        message: alert.message,
        priority: 2
      });
    }
  }

  return { quotes, alerts };
}

async function fetchAndNotify() {
  const result = await fetchQuotes();
  if (result.quotes?.length) {
    const { lastPrices = {} } = await chrome.storage.local.get('lastPrices');
    const updates = {};
    for (const q of result.quotes) {
      if (lastPrices[q.name] !== q.price) {
        updates[q.name] = q.price;
      }
    }
    await chrome.storage.local.set({
      lastPrices: { ...lastPrices, ...updates },
      currentQuotes: result.quotes
    });
  }
  if (result.alerts?.length) {
    const { alerts = [] } = await chrome.storage.local.get('alerts');
    await chrome.storage.local.set({ alerts: [...result.alerts, ...alerts].slice(0, 100) });
  }
}

// ===== Message Routing =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'FETCH_QUOTES':
      fetchQuotes(request.symbols).then(sendResponse).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'GET_QUOTES':
      chrome.storage.local.get(['currentQuotes', 'alerts']).then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'GET_SETTINGS':
      chrome.storage.sync.get('settings').then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'SAVE_SETTINGS':
      chrome.storage.sync.set({ settings: request.settings }).then(() => {
        startPolling();
        sendResponse({ success: true });
      });
      return true;
    case 'CLEAR_ALERTS':
      chrome.storage.local.set({ alerts: [] }).then(() => sendResponse({ success: true }));
      return true;
  }
});
