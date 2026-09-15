document.addEventListener('click', event => {
  const link = event.target.closest('a[data-activity-type]');
  if (!link) return;
  fetch('/api/activity', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game: link.dataset.activityGame, version: link.dataset.activityVersion, type: link.dataset.activityType }) }).catch(() => {});
}, true);
