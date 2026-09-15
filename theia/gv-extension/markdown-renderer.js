const MarkdownIt = require('markdown-it');
const parser = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true });
const defaultLink = parser.renderer.rules.link_open;
parser.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('target', '_blank');
  tokens[index].attrSet('rel', 'noopener noreferrer');
  return defaultLink ? defaultLink(tokens, index, options, env, renderer) : renderer.renderToken(tokens, index, options);
};
function renderMarkdown(source) {
  return parser.render(String(source || '')).replace(/<li>\[([ xX])\]\s/g, (_, checked) => `<li class="task-item"><input type="checkbox" disabled${checked.toLowerCase() === 'x' ? ' checked' : ''}> `);
}
module.exports = { renderMarkdown };
