const { ContainerModule } = require('@theia/core/shared/inversify');
const { FrontendApplicationContribution } = require('@theia/core/lib/browser/frontend-application-contribution');
const monaco = require('@theia/monaco-editor-core');

function ensureLanguage(language, tokenizer) {
  if (!monaco.languages.getLanguages().some(item => item.id === language.id)) monaco.languages.register(language);
  monaco.languages.setMonarchTokensProvider(language.id, tokenizer);
}

function registerWebLanguages() {
  ensureLanguage({ id: 'html', extensions: ['.html', '.htm'], aliases: ['HTML', 'html'] }, {
    tokenizer: { root: [[/<!DOCTYPE/i, 'metatag'], [/<!--[\s\S]*?-->/, 'comment'], [/<\/?[\w-]+/, 'tag'], [/[\w-]+(?=\s*=)/, 'attribute.name'], [/"[^"\n]*"|'[^'\n]*'/, 'attribute.value'], [/>/, 'tag'], [/[{}]/, 'delimiter.bracket']] }
  });
  ensureLanguage({ id: 'css', extensions: ['.css'], aliases: ['CSS', 'css'] }, {
    tokenizer: { root: [[/\/\*[\s\S]*?\*\//, 'comment'], [/@[\w-]+/, 'keyword'], [/[\w-]+(?=\s*:)/, 'attribute.name'], [/:/, 'delimiter'], [/#(?:[0-9a-fA-F]{3,8})\b/, 'number.hex'], [/-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|deg)?/, 'number'], [/"[^"\n]*"|'[^'\n]*'/, 'string'], [/[{}]/, 'delimiter.bracket']] }
  });
  ensureLanguage({ id: 'javascript', extensions: ['.js', '.mjs', '.cjs'], aliases: ['JavaScript', 'javascript', 'js'] }, {
    keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'async', 'await', 'import', 'from', 'export', 'default', 'try', 'catch', 'throw', 'switch', 'case', 'break', 'continue', 'true', 'false', 'null', 'undefined'],
    tokenizer: { root: [[/\/\/.*$/, 'comment'], [/\/\*[\s\S]*?\*\//, 'comment'], [/`(?:\\.|[^`])*`/, 'string.template'], [/"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'/, 'string'], [/\b\d+(?:\.\d+)?\b/, 'number'], [/[a-zA-Z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }], [/[{}()[\]]/, '@brackets'], [/[;,.]/, 'delimiter'], [/[+\-*\/=<>!]+/, 'operator']] }
  });
  ensureLanguage({ id: 'json', extensions: ['.json'], aliases: ['JSON', 'json'] }, {
    tokenizer: { root: [[/"(?:\\.|[^"\n])*"(?=\s*:)/, 'key'], [/"(?:\\.|[^"\n])*"/, 'string'], [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'], [/\b(?:true|false|null)\b/, 'keyword'], [/[{}[\]]/, '@brackets'], [/[,:]/, 'delimiter']] }
  });
  ensureLanguage({ id: 'python', extensions: ['.py', '.pyw'], aliases: ['Python', 'python', 'py'] }, {
    keywords: ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'],
    builtins: ['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'open', 'super', 'self'],
    tokenizer: { root: [[/#.*$/, 'comment'], [/'''(?:.|\n)*?'''|\"\"\"(?:.|\n)*?\"\"\"/, 'string'], [/[rubfRUBF]?(?:'(?:\\.|[^'\n])*'|\"(?:\\.|[^\"\n])*\")/, 'string'], [/\b\d+(?:\.\d+)?\b/, 'number'], [/@[\w.]+/, 'annotation'], [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@builtins': 'type.identifier', '@default': 'identifier' } }], [/[{}()[\]]/, '@brackets'], [/[,:;.]/, 'delimiter'], [/[+\-*\/=<>!%]+/, 'operator']] }
  });
}

const languageModule = new ContainerModule(bind => {
  bind(FrontendApplicationContribution).toDynamicValue(() => ({ onStart: registerWebLanguages })).inSingletonScope();
});

module.exports.default = languageModule;
