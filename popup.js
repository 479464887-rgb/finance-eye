// Finance Eye - Popup
document.addEventListener('DOMContentLoaded', async () => {
  // 加载行情
  const { currentQuotes = [], alerts = [] } = await chrome.storage.local.get(['currentQuotes', 'alerts']);

  // 渲染行情
  const qc = document.getElementById('quotes-container');
  if (currentQuotes.length) {
    qc.innerHTML = currentQuotes.map(q => {
      const cls = q.changePercent >= 0 ? 'up' : 'down';
      const sign = q.changePercent >= 0 ? '+' : '';
      return `<div class="quote">
        <span class="quote-name">${q.name}</span>
        <div style="text-align:right">
          <div class="quote-price">${q.price}</div>
          <div class="${cls}">${sign}${q.changePercent.toFixed(2)}%</div>
        </div>
      </div>`;
    }).join('');
  } else {
    qc.innerHTML = '<div style="padding:12px;color:#8b949e;text-align:center">点击刷新或配置 API Key</div>';
  }

  // 渲染预警
  const ac = document.getElementById('alerts-container');
  if (alerts.length) {
    ac.innerHTML = alerts.slice(-5).reverse().map(a =>
      `<div class="alert-item"><strong>${a.title}</strong><br>${a.message}</div>`
    ).join('');
  }

  // 按钮事件
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    qc.innerHTML = '<div style="padding:12px;color:#8b949e;text-align:center">刷新中...</div>';
    await chrome.runtime.sendMessage({ type: 'FETCH_QUOTES' });
    window.location.reload();
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('clear-alerts').addEventListener('click', async (e) => {
    e.preventDefault();
    await chrome.runtime.sendMessage({ type: 'CLEAR_ALERTS' });
    ac.innerHTML = '暂无预警';
  });
});
