(() => {
  const apiBase = 'http://127.0.0.1:8080';
  const toggle = document.querySelector('#gv-agent-toggle');
  const panel = document.querySelector('#gv-agent-panel');
  const close = document.querySelector('#gv-agent-close');
  const form = document.querySelector('#gv-agent-composer');
  const input = document.querySelector('#gv-agent-input');
  const messages = document.querySelector('#gv-agent-messages');
  const context = document.querySelector('#gv-agent-context');
  const model = document.querySelector('#gv-agent-model');
  const actions = document.querySelector('#gv-agent-composer > div');
  const query = new URLSearchParams(location.search);
  const game = query.get('gvGame') || 'project';
  const version = query.get('gvVersion') || location.hash.split('/').at(-1) || 'default';
  const key = `gv-theia-agent:${game}:${version}`;
  let history = [];
  let rewriteProposal = null;
  try { history = JSON.parse(localStorage.getItem(key) || '[]'); } catch { history = []; }
  context.textContent = `${game} · ${version}`;
  const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const render = () => { messages.innerHTML = history.length ? history.map(item => `<article class="gv-agent-message ${item.role}">${item.role === 'user' ? '<small>شما</small>' : '<small>✦ Agent</small>'}<div>${escape(item.content).replace(/\n/g, '<br>')}</div></article>`).join('') : '<div class="gv-agent-empty"><b>Agent آماده است</b><span>کد، خطا یا ایدهٔ پروژه را بنویس.</span></div>'; messages.scrollTop = messages.scrollHeight; };
  const save = () => localStorage.setItem(key, JSON.stringify(history.slice(-80)));
  const setOpen = open => { panel.classList.toggle('open', open); panel.setAttribute('aria-hidden', String(!open)); if (open) input.focus(); };
  const rewrite = document.createElement('button'); rewrite.type = 'button'; rewrite.id = 'gv-agent-rewrite'; rewrite.title = 'بررسی کل پروژه و ساخت پیشنهاد امن'; rewrite.textContent = '✦ رفع با AI';
  const applyRewrite = document.createElement('button'); applyRewrite.type = 'button'; applyRewrite.id = 'gv-agent-apply'; applyRewrite.hidden = true; applyRewrite.textContent = 'اعمال پیشنهاد';
  actions.prepend(rewrite); actions.prepend(applyRewrite);
  rewrite.addEventListener('click', async () => {
    rewrite.disabled = true; rewrite.textContent = 'در حال بررسی…';
    try {
      const response = await fetch(`${apiBase}/api/ai/rewrite`, {method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({game,version,model:model.value})});
      const data = await response.json().catch(() => ({})); if (!response.ok) throw Error(data.error || 'بررسی AI ناموفق بود');
      rewriteProposal = data.proposal || null;
      history.push({role:'assistant',content:rewriteProposal ? `${rewriteProposal.summary}\n${rewriteProposal.files.length} فایل برای تغییر پیشنهاد شده است. قبل از اعمال، Snapshot ساخته می‌شود.` : (data.message || 'تغییری ضروری پیدا نشد.')});
      applyRewrite.hidden = !rewriteProposal;
    } catch (error) { history.push({role:'assistant',content:`خطا در بازنویسی امن: ${error.message}`}); }
    finally { rewrite.disabled = false; rewrite.textContent = '✦ رفع با AI'; render(); save(); }
  });
  applyRewrite.addEventListener('click', async () => {
    if (!rewriteProposal || !confirm(`پیشنهاد AI برای ${rewriteProposal.files.length} فایل پس از Snapshot اعمال شود؟`)) return;
    applyRewrite.disabled = true;
    try {
      const response = await fetch(`${apiBase}/api/ai/rewrite/apply`, {method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({id:rewriteProposal.id,game,version})});
      const data = await response.json().catch(() => ({})); if (!response.ok) throw Error(data.error || 'اعمال پیشنهاد ناموفق بود');
      history.push({role:'assistant',content:`پیشنهاد AI پس از Snapshot برای ${data.files.length} فایل اعمال شد. پنجره را تازه‌سازی کن تا فایل‌های جدید باز شوند.`}); rewriteProposal = null; applyRewrite.hidden = true;
    } catch (error) { history.push({role:'assistant',content:`خطا در اعمال پیشنهاد: ${error.message}`}); }
    finally { applyRewrite.disabled = false; render(); save(); }
  });
  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  close.addEventListener('click', () => setOpen(false));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim(); if (!text) return;
    input.value = ''; history.push({role:'user',content:text}); render(); save();
    const thinking = document.createElement('article'); thinking.className = 'gv-agent-thinking'; thinking.textContent = 'Agent در حال بررسی پروژه است…'; messages.append(thinking); messages.scrollTop = messages.scrollHeight;
    try {
      const response = await fetch(`${apiBase}/api/chat`, {method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({game,version,model:model.value,skill:'theia-agent',message:text})});
      const data = await response.json().catch(() => ({})); if (!response.ok) throw Error(data.error || data.message || 'پاسخ Agent دریافت نشد');
      history.push({role:'assistant',content:data.message || 'پاسخی دریافت نشد'});
    } catch (error) { history.push({role:'assistant',content:`خطا: ${error.message}`}); }
    thinking.remove(); render(); save();
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  render();
})();
