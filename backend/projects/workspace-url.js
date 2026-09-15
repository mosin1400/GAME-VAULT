function workspaceFragment(root) {
  const normalized = String(root).replaceAll('\\', '/').replace(/^([A-Za-z]:)/, '/$1');
  return encodeURI(normalized).replaceAll('#', '%23').replaceAll('?', '%3F');
}
module.exports = { workspaceFragment };
