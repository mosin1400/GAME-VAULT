(() => {
  const api = async (path, options = {}) => {
    const response = await fetch(path, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || 'خطا');
    return data;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  const avatar = name => escapeHtml(String(name || '?').trim().slice(0, 1).toUpperCase() || '?');
  async function render() {
    const root = document.querySelector('#communityAdminList');
    if (!root) return;
    const { comments } = await api('/api/community/admin');
    root.innerHTML = comments.length ? comments.map(comment => `<article class="admin-comment"><header class="comment-author"><span class="comment-avatar">${avatar(comment.author)}</span><span><b>${escapeHtml(comment.author)}</b><small>${escapeHtml(comment.game)}</small></span></header><p class="comment-message">${escapeHtml(comment.text)}</p><div>${comment.replies.map(reply => `<blockquote><b>${escapeHtml(reply.author)}</b> ${escapeHtml(reply.text)}</blockquote>`).join('')}</div><form data-reply="${comment.id}"><input required minlength="2" placeholder="پاسخ مدیر"><button>پاسخ</button><button type="button" data-remove="${comment.id}">حذف</button></form></article>`).join('') : '<p>هنوز پیامی ثبت نشده است.</p>';
    root.querySelectorAll('[data-remove]').forEach(button => button.onclick = async () => { await api('/api/community/' + button.dataset.remove, { method: 'DELETE' }); render(); });
    root.querySelectorAll('[data-reply]').forEach(form => form.onsubmit = async event => { event.preventDefault(); await api('/api/community/' + form.dataset.reply + '/reply', { method: 'POST', body: JSON.stringify({ text: form.querySelector('input').value }) }); render(); });
  }
  document.addEventListener('click', event => { if (event.target?.dataset?.view === 'communityAdmin') render().catch(() => {}); });
})();
