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
    const [community, catalogue] = await Promise.all([api('/api/community/admin'), api('/api/games')]);
    const comments = community.comments || [], games = catalogue.games || catalogue || [], byId = new Map(games.map(game => [game.id, game]));
    root.innerHTML = comments.length ? comments.map(comment => { const game = byId.get(comment.game) || {}; return `<article class="admin-comment"><header class="comment-author"><span class="comment-avatar">${avatar(comment.author)}</span><span><b>${escapeHtml(comment.author)}</b><small>${escapeHtml(comment.game)}</small></span><div class="admin-game-card">${game.image ? `<img src="${escapeHtml(game.image)}" alt="">` : '<span class="comment-avatar">🎮</span>'}<span>${escapeHtml(game.name || comment.game)}</span></div></header><p class="comment-message">${escapeHtml(comment.text)}</p><div>${comment.replies.map(reply => `<blockquote><b>${escapeHtml(reply.author)}</b> ${escapeHtml(reply.text)}</blockquote>`).join('') || '<small>هنوز پاسخی داده نشده است.</small>'}</div><form data-reply="${comment.id}"><input required minlength="2" maxlength="1200" placeholder="پاسخ مدیر"><button>پاسخ</button><button type="button" data-remove="${comment.id}">حذف</button></form></article>`; }).join('') : '<p>هنوز پیامی ثبت نشده است.</p>';
    root.querySelectorAll('[data-remove]').forEach(button => button.onclick = async () => { await api('/api/community/' + button.dataset.remove, { method: 'DELETE' }); render(); });
    root.querySelectorAll('[data-reply]').forEach(form => form.onsubmit = async event => { event.preventDefault(); await api('/api/community/' + form.dataset.reply + '/reply', { method: 'POST', body: JSON.stringify({ text: form.querySelector('input').value }) }); render(); });
  }
  document.addEventListener('click', event => { if (event.target?.dataset?.view === 'communityAdmin') render().catch(() => {}); });
})();
