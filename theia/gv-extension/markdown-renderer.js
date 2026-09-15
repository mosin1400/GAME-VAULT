function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(value) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return text;
}

function tableCells(line) { return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()); }
function isTableDivider(line) { return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line); }

function renderMarkdown(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^```/.test(line)) {
      const language = line.slice(3).trim().replace(/[^\w-]/g, '') || 'text';
      const code = [];
      while (++index < lines.length && !/^```/.test(lines[index])) code.push(lines[index]);
      output.push(`<pre><code class="language-${language}">${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.includes('|') && isTableDivider(lines[index + 1] || '')) {
      const header = tableCells(line), rows = [];
      index += 1;
      while (lines[index + 1] && lines[index + 1].includes('|')) rows.push(tableCells(lines[++index]));
      output.push(`<table><thead><tr>${header.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${header.map((_, column) => `<td>${inline(row[column] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { const level = heading[1].length; output.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    if (/^([-*_])\1\1+\s*$/.test(line)) { output.push('<hr>'); continue; }
    if (/^>\s?/.test(line)) { output.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (/^[-*+]\s+/.test(line)) {
      const items = [line.replace(/^[-*+]\s+/, '')];
      while (/^[-*+]\s+/.test(lines[index + 1] || '')) items.push(lines[++index].replace(/^[-*+]\s+/, ''));
      output.push(`<ul>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [line.replace(/^\d+\.\s+/, '')];
      while (/^\d+\.\s+/.test(lines[index + 1] || '')) items.push(lines[++index].replace(/^\d+\.\s+/, ''));
      output.push(`<ol>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ol>`);
      continue;
    }
    output.push(`<p>${inline(line)}</p>`);
  }
  return output.join('');
}

module.exports = { renderMarkdown };
