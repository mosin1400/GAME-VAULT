const FAVORITES_KEY = 'game-vault-favorites';
const RECENT_KEY = 'game-vault-recent';
let games = [];
let activeFilter = 'همه';
let activeView = 'dashboard';
let selectedGame = null;
let gamesRequestId = 0;

const $ = (selector) => document.querySelector(selector);
const fa = (value) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit]);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const normalizePasswordDigits = (value) => String(value || '').replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0));
const favorites = () => JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
const recents = () => JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
const stars = (rating) => '★'.repeat(Math.round(Number(rating))) + '☆'.repeat(5 - Math.round(Number(rating)));

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'خطا در ارتباط با سرور');
  return data;
}

async function loadGames() {
  const requestId = ++gamesRequestId;
  try { games = (await api('/api/games')).games; }
  catch { games = await fetch('data/games.json').then((response) => response.json()); }
  if (requestId !== gamesRequestId) return;
  renderDashboard();
  renderCards();
}
async function loadProfile(){try{const d=await api('/api/me');const link=$('#profileLink');if(d.user){link.textContent=d.user.avatar||d.user.name[0];link.title=d.user.name}else{link.textContent='👦';link.title='مهمان'}}catch{}}

function navigateTo(view) {
  activeView = view;
  ['dashboard', 'games', 'detail'].forEach((name) => $('#' + name + 'View').classList.toggle('hidden', name !== view));
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  const labels = { dashboard: 'داشبورد', games: $('#gamesTitle').textContent, detail: 'صفحه بازی' };
  $('#crumbCurrent').textContent = labels[view] || 'کتابخانه';
  if (view === 'games') renderCards();
  window.location.hash = view;
}

function updateLibraryBar() {
  const average = games.length ? games.reduce((sum, game) => sum + Number(game.rating || 0), 0) / games.length : 0;
  const published = games.filter((game) => (game.status || 'published') === 'published').length;
  $('#sideCount').textContent = fa(games.length);
  $('#miniTotal').textContent = fa(games.length);
  $('#miniPublished').textContent = fa(published);
  $('#miniRating').textContent = fa(average.toFixed(1));
}

function renderDashboard() {
  updateLibraryBar();
  const average = games.length ? games.reduce((sum, game) => sum + Number(game.rating || 0), 0) / games.length : 0;
  const published = games.filter((game) => (game.status || 'published') === 'published').length;
  const activity = recents().length + games.reduce((sum, game) => sum + Number(game.downloads || 0), 0);
  $('#metricGames').textContent = fa(games.length);
  $('#metricGamesLabel').textContent = fa(games.length) + ' بازی';
  $('#metricActivity').textContent = fa(activity);
  $('#metricRating').textContent = fa(average.toFixed(1));
  $('#metricRatingLabel').textContent = fa(average.toFixed(1));
  $('#metricPublished').textContent = fa(published);
  $('#activityChart').innerHTML = Array.from({ length: 7 }, () => '<i style="height:6%"></i>').join('');
  api('/api/activity/weekly').then((weekly) => { const max = Math.max(1, ...weekly.days.map(day => day.play + day.download)); $('#activityChart').innerHTML = weekly.days.map(day => '<i title="'+escapeHtml(day.label)+' · اجرا '+fa(day.play)+' · دانلود '+fa(day.download)+'" style="height:'+Math.max(6,((day.play+day.download)/max)*100)+'%"></i>').join(''); $('#metricActivity').textContent = fa(weekly.days.reduce((sum,day)=>sum+day.play+day.download,0)); }).catch(() => {});
  const categories = Object.entries(games.reduce((all, game) => { all[game.category || 'سایر'] = (all[game.category || 'سایر'] || 0) + 1; return all; }, {}));
  $('#categoryBars').innerHTML = categories.map(([name, count]) => '<div class="category-row"><span>' + escapeHtml(name) + '</span><div class="category-track"><i style="width:' + (count / Math.max(1, games.length) * 100) + '%"></i></div><b>' + fa(count) + '</b></div>').join('') || '<small>داده‌ای موجود نیست</small>';
  const top = games.slice().sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 3);
  $('#popularList').innerHTML = top.map((game, index) => '<button class="popular-item game-open" data-id="' + escapeHtml(game.id) + '"><span class="popular-thumb" style="background-image:url(\'' + escapeHtml(game.image) + '\')"></span><span><b>' + escapeHtml(game.name) + '</b><small>رتبه ' + fa(index + 1) + '</small></span><span class="popular-score">★ ' + fa(game.rating) + '</span></button>').join('');
  const updateRows = games.slice(0, 4).map((game, index) => '<div class="update-item"><span class="update-icon">' + (index ? '↟' : '◉') + '</span><span><b>' + escapeHtml(game.name) + '</b><small>' + ((game.status || 'published') === 'published' ? 'آماده‌ی اجرا' : 'در حال ساخت') + ' · نسخه ' + escapeHtml(game.version || '۱.۰') + '</small></span></div>');
  $('#updatesList').innerHTML = updateRows.join('') || '<small>هنوز فعالیتی ثبت نشده</small>';
  bindGameOpens();
}

function currentGames() {
  const query = $('#searchInput').value.trim().toLowerCase();
  let list = games.filter((game) => (activeFilter === 'همه' || game.category === activeFilter) && (game.name + ' ' + game.description + ' ' + game.ai).toLowerCase().includes(query));
  if (activeView === 'recent') {
    const ids = recents();
    list = ids.map((id) => games.find((game) => game.id === id)).filter(Boolean);
  }
  if (activeView === 'favorites') list = list.filter((game) => favorites().includes(game.id));
  return list;
}

function renderCards() {
  const list = currentGames();
  const titles = { games: 'همه بازی‌ها', recent: 'اخیراً اضافه‌شده', favorites: 'منتخب من' };
  $('#gamesTitle').textContent = titles[activeView] || 'همه بازی‌ها';
  $('#emptyTitle').textContent = activeView === 'favorites' ? 'هنوز بازی منتخبی نداری' : 'بازی‌ای پیدا نشد';
  $('#emptyCopy').textContent = activeView === 'favorites' ? 'روی ☆ هر کارت بزن تا به این فهرست اضافه شود.' : 'عبارت جست‌وجو یا فیلتر را تغییر بده.';
  $('#emptyState').classList.toggle('hidden', list.length !== 0);
  $('#gameGrid').innerHTML = list.map((game) => '<article class="game-card"><button class="favorite-corner ' + (favorites().includes(game.id) ? 'saved' : '') + '" data-favorite="' + escapeHtml(game.id) + '" aria-label="افزودن به منتخب">' + (favorites().includes(game.id) ? '★' : '☆') + '</button><button class="game-open cover" data-id="' + escapeHtml(game.id) + '" style="background-image:url(\'' + escapeHtml(game.image) + '\')"><span class="category-badge">' + escapeHtml(game.category) + '</span></button><div class="card-body"><div class="game-title"><h3>' + escapeHtml(game.name) + '</h3><div class="rating">' + fa(Number(game.rating).toFixed(1)) + '<span>/ ۵</span></div></div><p class="game-description">' + escapeHtml(game.description) + '</p><div class="card-meta"><div class="ai-label">ساخته‌شده با AI<b>' + escapeHtml(game.ai) + '</b></div><div class="stars">' + stars(game.rating) + '</div></div><div class="card-actions"><button class="play-btn game-open" data-id="' + escapeHtml(game.id) + '">جزئیات</button><a class="download-btn" href="' + escapeHtml(game.playUrl) + '" target="_blank">▶ بازی کردن</a></div></div></article>').join('');
  bindGameOpens();
  document.querySelectorAll('[data-favorite]').forEach((button) => button.onclick = () => toggleFavorite(button.dataset.favorite));
}

function bindGameOpens() { document.querySelectorAll('.game-open').forEach((button) => button.onclick = () => openGame(button.dataset.id)); }
function rememberGame(id) { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recents().filter((item) => item !== id)].slice(0, 12))); }
function toggleFavorite(id) { const next = favorites(); const index = next.indexOf(id); if (index >= 0) next.splice(index, 1); else next.unshift(id); localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); renderCards(); renderDashboard(); if (selectedGame && selectedGame.id === id) renderGameDetail(); }
function openGame(id) { selectedGame = games.find((game) => game.id === id); if (!selectedGame) return; rememberGame(id); renderGameDetail(); navigateTo('detail'); api('/api/game-detail?game='+encodeURIComponent(id)).then(detail=>{if(selectedGame?.id!==id)return;selectedGame={...selectedGame,...detail.meta,version:detail.version,readme:detail.markdown,activity:detail.activity};renderGameDetail()}).catch(()=>{}); }

function renderGameDetail() {
  const game = selectedGame;
  const isFavorite = favorites().includes(game.id);
  const readme = escapeHtml(game.readme || game.description).replace(/^#\s+.*$/gm, '').replace(/\n/g, '<br>');
  const activity = game.activity || { playCount: 0, downloadCount: 0, lastPlayedAt: null };
  const lastPlayed = activity.lastPlayedAt ? new Date(activity.lastPlayedAt).toLocaleString('fa-IR') : 'هنوز اجرا نشده';
  $('#gameDetail').innerHTML = '<section class="detail-hero"><div class="detail-cover" style="background-image:url(\'' + escapeHtml(game.image) + '\')"></div><div class="detail-copy"><p class="eyebrow">' + escapeHtml(game.category) + ' <span></span> نسخه ' + escapeHtml(game.version || '۱.۰') + '</p><h1>' + escapeHtml(game.name) + '</h1><p>' + escapeHtml(game.description) + '</p><div class="detail-meta"><span>امتیاز <b>★ ' + fa(game.rating) + '</b></span><span>ساخته‌شده با <b>' + escapeHtml(game.ai) + '</b></span><span>وضعیت <b>' + ((game.status || 'published') === 'published' ? 'منتشرشده' : 'در حال ساخت') + '</b></span></div><div class="detail-actions"><a class="play-btn" href="' + escapeHtml(game.playUrl) + '" target="_blank">▶ بازی کردن</a><a class="download-btn" href="' + escapeHtml(game.downloadUrl || game.playUrl) + '" download>🡳 دانلود</a><button class="favorite-button ' + (isFavorite ? 'saved' : '') + '" data-favorite="' + escapeHtml(game.id) + '">' + (isFavorite ? '★ در منتخب' : '☆ افزودن به منتخب') + '</button></div></div></section><div class="detail-lower"><section class="detail-panel"><h2>معرفی بازی</h2><p>' + readme + '</p></section><section class="detail-panel"><h2>آمار بازی</h2><div class="detail-stat"><span>تعداد اجرا</span><b>' + fa(activity.playCount) + '</b></div><div class="detail-stat"><span>دانلودها</span><b>' + fa(activity.downloadCount) + '</b></div><div class="detail-stat"><span>آخرین اجرا</span><b>' + escapeHtml(lastPlayed) + '</b></div></section></div>';
  const detailFavorite = $('#gameDetail [data-favorite]');
  detailFavorite.onclick = () => toggleFavorite(game.id);
  document.dispatchEvent(new CustomEvent('game-detail-rendered', { detail: game }));
}

async function login() {
  const value = normalizePasswordDigits($('#passwordInput').value);
  await api('/api/login', { method: 'POST', body: JSON.stringify({ password: value }) });
  $('#passwordModal').classList.add('hidden');
  location.href = '/manage.html';
}

$('#searchInput').addEventListener('input', renderCards);
document.querySelectorAll('.filter').forEach((button) => button.onclick = () => { document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active')); button.classList.add('active'); activeFilter = button.dataset.filter; renderCards(); });
document.querySelectorAll('[data-view]').forEach((button) => button.onclick = (event) => { event.preventDefault(); const view = button.dataset.view; if (view === 'recent' || view === 'favorites') { navigateTo('games'); activeView = view; renderCards(); $('#crumbCurrent').textContent = view === 'recent' ? 'اخیراً اضافه‌شده' : 'منتخب من'; } else navigateTo(view); });
$('#openEditor').onclick = async () => { try { const session = await api('/api/session'); location.href = session.user?.role === 'admin' ? '/manage.html' : '/profile.html?next=' + encodeURIComponent('/manage.html'); } catch { location.href = '/profile.html?next=' + encodeURIComponent('/manage.html'); } };
$('#passwordForm').onsubmit = (event) => { event.preventDefault(); login().catch((error) => showToast(error.message)); };
$('#closeEditor').onclick = () => $('#editorDrawer').classList.add('hidden');
document.querySelectorAll('[data-close]').forEach((button) => button.onclick = () => $('#passwordModal').classList.add('hidden'));
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }
loadProfile();
loadGames();
const gameVaultChannel = new BroadcastChannel('game-vault');
gameVaultChannel.onmessage = () => { loadGames(); loadProfile(); };
setInterval(loadGames, 5000);
setInterval(loadProfile, 5000);
