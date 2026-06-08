// ExtPay initialization
try {
  const extpay = ExtPay('finance-eye');
  extpay.startBackground();
} catch(e) {
  console.error('finance-eye: ExtPay init failed', e);
}

// Finance Eye — Market data via jsd API
chrome.runtime.onInstalled.addListener(() => console.log('Finance Eye ready'));
