const { ContainerModule } = require('@theia/core/shared/inversify');
const { FrontendApplicationContribution } = require('@theia/core/lib/browser/frontend-application-contribution');
const URI = require('@theia/core/lib/common/uri').default;
const { ProblemManager } = require('@theia/markers/lib/browser/problem/problem-manager');
const monaco = require('@theia/monaco-editor-core');

const OWNER = 'game-vault-syntax';
const VOID_HTML = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function positionAt(text, offset) {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split('\n');
  return { line: lines.length - 1, character: lines.at(-1).length };
}

function diagnostic(text, offset, length, message, severity = 1) {
  const start = positionAt(text, offset), end = positionAt(text, offset + Math.max(1, length));
  return { severity, source: 'Game Vault', message, range: { start, end } };
}

function validateJson(text) {
  try { JSON.parse(text); return []; }
  catch (error) {
    const position = /position\s+(\d+)/i.exec(String(error.message));
    const offset = position ? Number(position[1]) : 0;
    return [diagnostic(text, offset, 1, `JSON نامعتبر است: ${error.message}`)];
  }
}

function validateHtml(text) {
  const errors = [], stack = [], tags = /<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*?)?\s*\/?>/g;
  for (let match; (match = tags.exec(text));) {
    const raw = match[0], name = match[1].toLowerCase(), closing = raw.startsWith('</'), selfClosing = raw.endsWith('/>') || VOID_HTML.has(name);
    if (closing) {
      const open = stack.pop();
      if (!open || open.name !== name) errors.push(diagnostic(text, match.index, raw.length, `تگ بستهٔ </${name}> با تگ باز مطابقت ندارد.`));
    } else if (!selfClosing) stack.push({ name, offset: match.index, length: raw.length });
  }
  for (const open of stack) errors.push(diagnostic(text, open.offset, open.length, `تگ <${open.name}> بسته نشده است.`));
  return errors;
}

function validateCss(text) {
  const errors = [], stack = [];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '{') stack.push(index);
    if (text[index] === '}') {
      if (!stack.length) errors.push(diagnostic(text, index, 1, 'آکولاد بستهٔ اضافی در CSS.'));
      else stack.pop();
    }
  }
  for (const index of stack) errors.push(diagnostic(text, index, 1, 'این بلوک CSS آکولاد بسته ندارد.'));
  return errors;
}

function validateJavaScript(text) {
  const errors = [], pairs = { ')': '(', ']': '[', '}': '{' }, stack = [];
  let quote = '', escaped = false, lineComment = false, blockComment = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1];
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; index++; } continue; }
    if (!quote && char === '/' && next === '/') { lineComment = true; index++; continue; }
    if (!quote && char === '/' && next === '*') { blockComment = true; index++; continue; }
    if (quote) { if (!escaped && char === quote) quote = ''; escaped = !escaped && char === '\\'; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '(' || char === '[' || char === '{') stack.push({ char, index });
    if (pairs[char]) { const open = stack.pop(); if (!open || open.char !== pairs[char]) errors.push(diagnostic(text, index, 1, `پرانتز یا آکولاد «${char}» با جفت خود مطابقت ندارد.`)); }
  }
  if (quote) errors.push(diagnostic(text, text.length - 1, 1, 'رشتهٔ JavaScript بسته نشده است.'));
  if (blockComment) errors.push(diagnostic(text, text.length - 1, 1, 'کامنت چندخطی JavaScript بسته نشده است.'));
  for (const open of stack) errors.push(diagnostic(text, open.index, 1, `نشانهٔ «${open.char}» بسته نشده است.`));
  return errors;
}

function diagnosticsFor(model) {
  const text = model.getValue(), language = model.getLanguageId();
  if (language === 'json') return validateJson(text);
  if (language === 'html') return validateHtml(text);
  if (language === 'css') return validateCss(text);
  if (language === 'javascript') return validateJavaScript(text);
  return [];
}

function createProblemsContribution(problemManager) {
  const inspect = model => problemManager.setMarkers(new URI(model.uri.toString()), OWNER, diagnosticsFor(model));
  return {
    onStart: () => {
      const observe = model => { inspect(model); model.onDidChangeContent(() => inspect(model)); };
      monaco.editor.getModels().forEach(observe);
      monaco.editor.onDidCreateModel(observe);
    }
  };
}

const problemsModule = new ContainerModule(bind => {
  bind(FrontendApplicationContribution).toDynamicValue(context => createProblemsContribution(context.container.get(ProblemManager))).inSingletonScope();
});

module.exports.default = problemsModule;
