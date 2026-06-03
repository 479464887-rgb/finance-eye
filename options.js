// Finance Eye - Options
const DEFAULTS={jinshiKey:'',watchList:['上证指数','深证成指','创业板指','黄金','原油'],alertThreshold:2,refreshInterval:5,theme:'dark'};

document.addEventListener('DOMContentLoaded',async()=>{
  const{settings}=await chrome.storage.sync.get('settings');
  const s=settings||DEFAULTS;
  document.getElementById('jinshi-key').value=s.jinshiKey||'';
  document.getElementById('watch-list').value=(s.watchList||DEFAULTS.watchList).join(',');
  document.getElementById('alert-threshold').value=s.alertThreshold||2;
  document.getElementById('refresh-interval').value=s.refreshInterval||5;
  document.getElementById('save-settings').addEventListener('click',saveSettings);
});

async function saveSettings(){
  const btn=document.getElementById('save-settings');
  btn.disabled=true;btn.textContent='保存中...';
  const settings={
    jinshiKey:document.getElementById('jinshi-key').value.trim(),
    watchList:document.getElementById('watch-list').value.split(',').map(s=>s.trim()).filter(Boolean),
    alertThreshold:parseFloat(document.getElementById('alert-threshold').value)||2,
    refreshInterval:parseInt(document.getElementById('refresh-interval').value)||5
  };
  await chrome.storage.sync.set({settings});
  btn.disabled=false;btn.textContent='保存设置';
  const el=document.getElementById('save-status');
  el.textContent='已保存!';el.style.display='inline';
  setTimeout(()=>el.style.display='none',2000);
}
