'use strict';

const path = require('node:path');
const acorn = require('acorn');
const { LIMITS } = require('./constants');
const { describePermissions, baselinePermissions, highestRisk } = require('./permissions');

/**
 * Статический аудит плагина.
 *
 * Это не заменяет ручную проверку каталога, но отсекает очевидное:
 * Node-доступ, eval, прямую сеть, работу с cookie, нативные бинарники,
 * обфускацию и попытки выйти за пределы разрешений. Проверка выполняется
 * до установки и сохраняется в отчёте, который видит пользователь.
 */

const ALLOWED_EXTENSIONS = new Set([
  '.js',
  '.json',
  '.css',
  '.md',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.ico',
]);

const ALLOWED_BASENAMES = new Set(['LICENSE', 'COPYING', 'NOTICE']);

const BLOCKED_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.wasm',
  '.node',
  '.so',
  '.dll',
  '.dylib',
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.py',
  '.rb',
  '.php',
  '.jar',
  '.class',
  '.app',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.apk',
]);

const HOST_RULES = [
  {
    id: 'node-require',
    severity: 'block',
    re: /\brequire\s*\(/,
    message: 'Node-модули недоступны плагинам: require() запрещён',
  },
  {
    id: 'node-process',
    severity: 'block',
    re: /\bprocess\s*(?:\.|\[)/,
    message: 'Доступ к process запрещён',
  },
  {
    id: 'node-globals',
    severity: 'block',
    re: /\b(?:__dirname|__filename|module\s*\.\s*exports|exports\s*\.)/,
    message: 'CommonJS-глобалы недоступны плагинам',
  },
  {
    id: 'node-buffer',
    severity: 'block',
    re: /\bBuffer\s*(?:\.|from\s*\()/,
    message: 'Buffer недоступен плагинам',
  },
  {
    id: 'eval',
    severity: 'block',
    re: /\beval\s*\(/,
    message: 'eval() запрещён: код должен быть видимым и проверяемым',
  },
  {
    id: 'function-constructor',
    severity: 'block',
    re: /\b(?:new\s+Function|Function\s*\(\s*['"`])/,
    message: 'Конструктор Function запрещён',
  },
  {
    id: 'dynamic-import',
    severity: 'block',
    re: /\bimport\s*\(/,
    message: 'Динамический import() запрещён',
  },
  {
    id: 'import-scripts',
    severity: 'block',
    re: /\bimportScripts\s*\(/,
    message: 'importScripts() запрещён',
  },
  {
    id: 'direct-fetch',
    severity: 'block',
    re: /(?<![\w.])fetch\s*\(/,
    message: 'Прямой fetch() запрещён: используйте octo.net.fetch и разрешение network',
  },
  {
    id: 'xhr',
    severity: 'block',
    re: /\bXMLHttpRequest\b/,
    message: 'XMLHttpRequest запрещён: используйте octo.net.fetch',
  },
  {
    id: 'websocket',
    severity: 'block',
    re: /\bWebSocket\b/,
    message: 'WebSocket запрещён',
  },
  {
    id: 'eventsource',
    severity: 'block',
    re: /\bEventSource\b/,
    message: 'EventSource запрещён',
  },
  {
    id: 'beacon',
    severity: 'block',
    re: /\bnavigator\s*\.\s*sendBeacon\b/,
    message: 'navigator.sendBeacon запрещён',
  },
  {
    id: 'remote-code',
    severity: 'block',
    re: /\b(?:createElement\s*\(\s*['"]script['"]|document\s*\.\s*write(?:ln)?\s*\()/,
    message: 'Подгрузка и вставка скриптов запрещена',
  },
  {
    id: 'window-open',
    severity: 'block',
    re: /\b(?:window\s*\.\s*open|open\s*\(\s*['"]https?:)/,
    message: 'Открывать окна нельзя: используйте octo.openExternal',
  },
  {
    id: 'navigation',
    severity: 'block',
    re: /\b(?:location\s*=|location\s*\.\s*(?:assign|replace|href|host|hostname|protocol|port|search|pathname|hash)\b|top\s*\.\s*location\b|parent\s*\.\s*location\b)/,
    message: 'Навигация из плагина запрещена',
  },
  {
    id: 'cookies',
    severity: 'block',
    re: /\bdocument\s*\.\s*cookie\b/,
    message: 'Доступ к cookie запрещён',
  },
  {
    id: 'web-storage-read',
    severity: 'warn',
    re: /\b(?:localStorage|sessionStorage|indexedDB|caches)\b/,
    message: 'Для данных плагина используйте octo.storage, а не хранилище браузера',
  },
  {
    id: 'clipboard-read',
    severity: 'block',
    re: /\bnavigator\s*\.\s*clipboard\s*\.\s*read(?:Text)?\b/,
    message: 'Чтение буфера обмена запрещено',
  },
  {
    id: 'crypto-mining',
    severity: 'block',
    re: /\b(?:coinhive|cryptonight|minero|webminepool|coinimp|webmine)\b/i,
    message: 'Майнинг и скрытые вычисления запрещены',
  },
  {
    id: 'wasm',
    severity: 'block',
    re: /\bWebAssembly\b/,
    message: 'WebAssembly в плагинах запрещён',
  },
  {
    id: 'workers',
    severity: 'block',
    re: /\bnew\s+(?:Shared)?Worker\s*\(/,
    message: 'Фоновые Worker-потоки запрещены',
  },
  {
    id: 'iframe',
    severity: 'block',
    re: /\bcreateElement\s*\(\s*['"]iframe['"]/,
    message: 'Встраивание iframe запрещено',
  },
  {
    id: 'proto-pollution',
    severity: 'warn',
    re: /\b(?:__proto__|constructor\s*\.\s*prototype)\b/,
    message: 'Похоже на изменение прототипов — проверьте вручную',
  },
  {
    id: 'atob',
    severity: 'warn',
    re: /\batob\s*\(/,
    message: 'atob() часто прячет полезную нагрузку — проверьте вручную',
  },
  {
    id: 'post-message',
    severity: 'warn',
    re: /\bpostMessage\s*\(/,
    message: 'postMessage в плагине обычно не нужен',
  },
  {
    id: 'infinite-loop',
    severity: 'warn',
    re: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/,
    message: 'Похоже на бесконечный цикл — проверьте вручную',
  },
  {
    id: 'devtools-detour',
    severity: 'warn',
    re: /\b(?:ipcRenderer|webFrame|desktopCapturer|shell\s*\.\s*openExternal)\b/,
    message: 'Внутренние API Electron недоступны плагинам',
  },
  {
    id: 'long-line',
    severity: 'warn',
    re: /^.{4001,}$/m,
    message: 'Очень длинная строка: возможно, код минифицирован или обфусцирован',
  },
  {
    id: 'long-base64',
    severity: 'warn',
    re: /[A-Za-z0-9+/]{2000,}={0,2}/,
    message: 'Большой блок base64: проверьте, что именно он декодирует',
  },
  {
    id: 'hex-escapes',
    severity: 'warn',
    re: /(?:\\x[0-9a-fA-F]{2}){20,}/,
    message: 'Много hex- escape-последовательностей: возможна обфускация',
  },
  {
    id: 'unicode-escapes',
    severity: 'warn',
    re: /(?:\\u[0-9a-fA-F]{4}){20,}/,
    message: 'Много unicode- escape-последовательностей: возможна обфускация',
  },
];

const PAGE_RULES = [
  ...HOST_RULES.filter((rule) =>
    [
      'eval',
      'function-constructor',
      'dynamic-import',
      'import-scripts',
      'direct-fetch',
      'xhr',
      'websocket',
      'eventsource',
      'beacon',
      'remote-code',
      'window-open',
      'navigation',
      'cookies',
      'web-storage-read',
      'clipboard-read',
      'crypto-mining',
      'wasm',
      'workers',
      'iframe',
      'proto-pollution',
      'long-base64',
      'hex-escapes',
      'infinite-loop',
    ].includes(rule.id),
  ).map((rule) =>
    rule.id === 'web-storage-read'
      ? {
          ...rule,
          severity: 'block',
          message: 'Доступ к хранилищу сайта запрещён: используйте octo.storage',
        }
      : rule.id === 'infinite-loop'
        ? {
            ...rule,
            severity: 'block',
            message: 'Бесконечный цикл заблокирует страницу',
          }
        : rule,
  ),
  {
    id: 'page-external-resource',
    severity: 'block',
    re: /\b(?:createElement\s*\(\s*['"](?:img|link|audio|video|source)['"]|\.src\s*=\s*['"]https?:)/,
    message: 'Внешние ресурсы со страницы запрещены: используйте octo.net.fetch',
  },
  {
    id: 'page-html-injection',
    severity: 'block',
    re: /(?:\.(?:inner|outer)HTML\s*\+?=|insertAdjacentHTML\s*\()/,
    message: 'Вставка HTML на страницу запрещена: используйте DOM-методы',
  },
];

const CSS_RULES = [
  {
    id: 'css-import',
    severity: 'block',
    re: /@import\b/i,
    message: '@import в CSS запрещён',
  },
  {
    id: 'css-remote-url',
    severity: 'block',
    re: /url\s*\(\s*['"]?(?:https?:)?\/\//i,
    message: 'Внешние url() в CSS запрещены: используйте data: URI',
  },
  {
    id: 'css-expression',
    severity: 'block',
    re: /\bexpression\s*\(/i,
    message: 'CSS expression() запрещён',
  },
  {
    id: 'css-behavior',
    severity: 'block',
    re: /\bbehavior\s*:/i,
    message: 'CSS behavior: запрещён',
  },
  {
    id: 'css-javascript',
    severity: 'block',
    re: /javascript\s*:/i,
    message: 'javascript: в CSS запрещён',
  },
];

const SVG_RULES = [
  {
    id: 'svg-script',
    severity: 'block',
    re: /<script\b|on(?:load|error|click|mouseover)\s*=/i,
    message: 'Скрипты внутри SVG запрещены',
  },
  {
    id: 'svg-external',
    severity: 'warn',
    re: /\b(?:href|xlink:href)\s*=\s*['"]https?:/i,
    message: 'SVG ссылается на внешний ресурс',
  },
];

function lineOf(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index && cursor < text.length; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function snippetOf(text, index, length) {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + Math.max(1, length) + 30);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 160);
}

function scanText(text, fileName, rules, findings) {
  for (const rule of rules) {
    const flags = rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`;
    let re;
    try {
      re = new RegExp(rule.re.source, flags);
    } catch {
      continue;
    }
    let match;
    let count = 0;
    while ((match = re.exec(text)) !== null && count < 5) {
      findings.push({
        severity: rule.severity,
        rule: rule.id,
        message: rule.message,
        file: fileName,
        line: lineOf(text, match.index),
        snippet: snippetOf(text, match.index, match[0].length),
      });
      count += 1;
      if (match[0].length === 0) re.lastIndex += 1;
    }
    if (findings.length >= 100) return;
  }
}

function pathOf(node) {
  const parts = [];
  let current = node;
  while (current && current.type === 'MemberExpression') {
    if (current.computed) {
      if (current.property.type !== 'Literal' || typeof current.property.value !== 'string') {
        return null;
      }
      parts.unshift(current.property.value);
    } else if (current.property.type === 'Identifier') {
      parts.unshift(current.property.name);
    } else {
      return null;
    }
    current = current.object;
  }
  if (!current || current.type !== 'Identifier') return null;
  parts.unshift(current.name);
  return parts;
}

function walkAst(node, visit, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 200) return;
  if (Array.isArray(node)) {
    for (const item of node) walkAst(item, visit, depth + 1);
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (['type', 'start', 'end', 'loc', 'range', 'raw', 'value', 'regex'].includes(key)) {
      continue;
    }
    walkAst(value, visit, depth + 1);
  }
}

function startOf(path, prefix) {
  return prefix.every((part, index) => path[index] === part);
}

/**
 * AST-проверка вместо одних регулярных выражений.
 *
 * Ловит опасные вызовы и обращения, которые легко спрятать в строках или
 * комментариях: require(), process, eval, document.cookie, location.*,
 * innerHTML, Worker, WebSocket и т.п. Если код не парсится, установка
 * блокируется: непроверенный JavaScript мы не запускаем.
 */
function scanAst(code, fileName, manifest, findings) {
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowHashBang: true,
      locations: true,
    });
  } catch (err) {
    findings.push({
      severity: 'block',
      rule: 'parse-error',
      message: `JavaScript не разбирается: ${err.message}`,
      file: fileName,
      line: err.loc?.line || 0,
      snippet: '',
    });
    return;
  }

  const add = (severity, rule, message, node) => {
    findings.push({
      severity,
      rule,
      message,
      file: fileName,
      line: node?.loc?.start?.line || 0,
      snippet: node ? snippetOf(code, node.start, node.end - node.start) : '',
    });
  };

  walkAst(ast, (node) => {
    if (node.type === 'ImportExpression') {
      add('block', 'dynamic-import', 'Динамический import() запрещён', node);
      return;
    }

    if (node.type === 'NewExpression' || node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee.type === 'Identifier') {
        const name = callee.name;
        if (name === 'eval') add('block', 'eval', 'eval() запрещён', node);
        else if (name === 'Function') {
          add('block', 'function-constructor', 'Конструктор Function запрещён', node);
        } else if (name === 'require') {
          add('block', 'node-require', 'require() запрещён', node);
        } else if (name === 'fetch') {
          add('block', 'direct-fetch', 'Прямой fetch() запрещён', node);
        } else if (name === 'XMLHttpRequest') {
          add('block', 'xhr', 'XMLHttpRequest запрещён', node);
        } else if (name === 'WebSocket') {
          add('block', 'websocket', 'WebSocket запрещён', node);
        } else if (name === 'EventSource') {
          add('block', 'eventsource', 'EventSource запрещён', node);
        } else if (name === 'Worker' || name === 'SharedWorker') {
          add('block', 'workers', 'Worker-потоки запрещены', node);
        } else if (name === 'importScripts') {
          add('block', 'import-scripts', 'importScripts() запрещён', node);
        }
        if (
          node.type === 'CallExpression' &&
          (name === 'setTimeout' || name === 'setInterval') &&
          node.arguments[0]?.type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          add('block', 'string-eval', 'setTimeout/setInterval со строкой запрещён', node);
        }
      }

      const pathParts = pathOf(callee);
      if (pathParts) {
        const last = pathParts[pathParts.length - 1];
        if (last === 'eval' && ['window', 'globalThis', 'self'].includes(pathParts[0])) {
          add('block', 'eval', 'eval() запрещён', node);
        }
        if (last === 'fetch' && ['window', 'globalThis', 'self'].includes(pathParts[0])) {
          add('block', 'direct-fetch', 'Прямой fetch() запрещён', node);
        }
        if (
          startOf(pathParts, ['document', 'write']) ||
          startOf(pathParts, ['document', 'writeln'])
        ) {
          add('block', 'remote-code', 'document.write запрещён', node);
        }
        if (startOf(pathParts, ['navigator', 'sendBeacon'])) {
          add('block', 'beacon', 'navigator.sendBeacon запрещён', node);
        }
        if (
          startOf(pathParts, ['navigator', 'clipboard', 'read']) ||
          startOf(pathParts, ['navigator', 'clipboard', 'readText'])
        ) {
          add('block', 'clipboard-read', 'Чтение буфера обмена запрещено', node);
        }
        if (pathParts[0] === 'process') {
          add('block', 'node-process', 'Доступ к process запрещён', node);
        }
        if (
          pathParts[0] === 'localStorage' ||
          pathParts[0] === 'sessionStorage' ||
          pathParts[0] === 'indexedDB'
        ) {
          add(
            'warn',
            'web-storage-read',
            'Используйте octo.storage вместо хранилища браузера',
            node,
          );
        }
        if (pathParts[0] === 'WebAssembly') {
          add('block', 'wasm', 'WebAssembly запрещён', node);
        }
        if (pathParts[0] === 'octo') {
          if (startOf(pathParts, ['octo', 'page', 'run'])) {
            permissionFinding(
              manifest,
              findings,
              'page:script',
              'Код вызывает octo.page.run(), но в манифесте нет разрешения page:script',
            );
          } else if (startOf(pathParts, ['octo', 'page', 'injectCSS'])) {
            permissionFinding(
              manifest,
              findings,
              'page:css',
              'Код вызывает octo.page.injectCSS(), но в манифесте нет разрешения page:css',
            );
          } else if (startOf(pathParts, ['octo', 'net', 'fetch'])) {
            permissionFinding(
              manifest,
              findings,
              'network',
              'Код вызывает octo.net.fetch(), но в манифесте нет разрешения network',
            );
          } else if (startOf(pathParts, ['octo', 'navigate'])) {
            permissionFinding(
              manifest,
              findings,
              'navigation',
              'Код вызывает octo.navigate(), но в манифесте нет разрешения navigation',
            );
          } else if (startOf(pathParts, ['octo', 'shortcuts', 'add'])) {
            permissionFinding(
              manifest,
              findings,
              'shortcuts',
              'Код вызывает octo.shortcuts.add(), но в манифесте нет разрешения shortcuts',
            );
          } else if (startOf(pathParts, ['octo', 'openExternal'])) {
            permissionFinding(
              manifest,
              findings,
              'links',
              'Код вызывает octo.openExternal(), но в манифесте нет разрешения links',
            );
          }
        }
      }
    }

    if (node.type === 'MemberExpression') {
      const pathParts = pathOf(node);
      if (!pathParts) return;
      if (startOf(pathParts, ['document', 'cookie'])) {
        add('block', 'cookies', 'Доступ к cookie запрещён', node);
      }
      if (pathParts[0] === 'process') {
        add('block', 'node-process', 'Доступ к process запрещён', node);
      }
    }

    if (node.type === 'AssignmentExpression') {
      const pathParts = pathOf(node.left) || [];
      const property = pathParts[pathParts.length - 1];
      const isLocation =
        pathParts[0] === 'location' ||
        (['window', 'globalThis', 'document'].includes(pathParts[0]) &&
          pathParts[1] === 'location');
      if (isLocation) {
        add('block', 'navigation', 'Навигация из плагина запрещена', node);
      }
      if (property === 'innerHTML' || property === 'outerHTML') {
        add('block', 'html-injection', 'Вставка HTML запрещена: используйте DOM-методы', node);
      }
    }
  });
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.rule}|${finding.file}|${finding.line}|${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extensionOf(fileName) {
  return path.posix.extname(fileName).toLowerCase();
}

function isTextFile(fileName) {
  return ['.js', '.json', '.css', '.md', '.txt', '.svg'].includes(extensionOf(fileName));
}

function hasBinaryNul(buffer) {
  const limit = Math.min(buffer.length, 4096);
  for (let index = 0; index < limit; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function permissionFinding(manifest, findings, permission, message) {
  if ((manifest.permissions || []).includes(permission)) return;
  findings.push({
    severity: 'block',
    rule: `missing-permission:${permission}`,
    message,
    file: manifest.main || 'index.js',
    line: 0,
    snippet: '',
  });
}

function collectApiFindings(manifest, files, findings) {
  let apiText = '';
  for (const [name, buffer] of files) {
    if (extensionOf(name) !== '.js') continue;
    apiText += `\n${buffer.toString('utf8')}`;
  }

  if (/\bocto\s*\.\s*page\s*\.\s*run\s*\(/.test(apiText)) {
    permissionFinding(
      manifest,
      findings,
      'page:script',
      'Код вызывает octo.page.run(), но в манифесте нет разрешения page:script',
    );
  }
  if (/\bocto\s*\.\s*page\s*\.\s*injectCSS\s*\(/.test(apiText)) {
    permissionFinding(
      manifest,
      findings,
      'page:css',
      'Код вызывает octo.page.injectCSS(), но в манифесте нет разрешения page:css',
    );
  }
  if (/\bocto\s*\.\s*net\s*\.\s*fetch\s*\(/.test(apiText)) {
    permissionFinding(
      manifest,
      findings,
      'network',
      'Код вызывает octo.net.fetch(), но в манифесте нет разрешения network',
    );
  }
  if (/\bocto\s*\.\s*openExternal\s*\(/.test(apiText)) {
    permissionFinding(
      manifest,
      findings,
      'links',
      'Код вызывает octo.openExternal(), но в манифесте нет разрешения links',
    );
  }
  if (/\bocto\s*\.\s*navigate\s*\(/.test(apiText)) {
    permissionFinding(
      manifest,
      findings,
      'navigation',
      'Код вызывает octo.navigate(), но в манифесте нет разрешения navigation',
    );
  }
  if (/\bocto\s*\.\s*shortcuts\s*\.\s*add\s*\(/.test(apiText)) {
    permissionFinding(
      manifest,
      findings,
      'shortcuts',
      'Код вызывает octo.shortcuts.add(), но в манифесте нет разрешения shortcuts',
    );
  }
}

/**
 * Проверяет набор файлов до установки.
 * @param {Map<string, Buffer>} files
 * @param {object} manifest нормализованный манифест
 */
function scanFiles(files, manifest) {
  const findings = [];
  let totalBytes = 0;

  if (files.size > LIMITS.files) {
    findings.push({
      severity: 'block',
      rule: 'too-many-files',
      message: `В пакете больше ${LIMITS.files} файлов`,
      file: '',
      line: 0,
      snippet: '',
    });
  }

  for (const [name, buffer] of files) {
    totalBytes += buffer.length;
    const lower = name.toLowerCase();

    if (lower === 'plugin.json') {
      if (buffer.length > LIMITS.manifestBytes) {
        findings.push({
          severity: 'block',
          rule: 'manifest-size',
          message: 'plugin.json слишком большой',
          file: name,
          line: 0,
          snippet: '',
        });
      }
      continue;
    }

    if (BLOCKED_EXTENSIONS.has(extensionOf(name))) {
      findings.push({
        severity: 'block',
        rule: 'blocked-file-type',
        message: `Файлы ${extensionOf(name)} в плагинах запрещены`,
        file: name,
        line: 0,
        snippet: '',
      });
      continue;
    }

    const ext = extensionOf(name);
    const basename = path.posix.basename(name).toUpperCase();
    const allowedLicense = ext === '' && ALLOWED_BASENAMES.has(basename);
    if (!ALLOWED_EXTENSIONS.has(ext) && !allowedLicense) {
      findings.push({
        severity: 'block',
        rule: 'unknown-file-type',
        message: `Неизвестный тип файла «${ext || 'без расширения'}»`,
        file: name,
        line: 0,
        snippet: '',
      });
      continue;
    }

    if (buffer.length > LIMITS.fileBytes) {
      findings.push({
        severity: 'block',
        rule: 'file-size',
        message: `Файл больше ${Math.round(LIMITS.fileBytes / 1024 / 1024)} МБ`,
        file: name,
        line: 0,
        snippet: '',
      });
      continue;
    }

    if (isTextFile(name) && hasBinaryNul(buffer)) {
      findings.push({
        severity: 'block',
        rule: 'binary-in-text',
        message: 'В текстовом файле найдены нулевые байты',
        file: name,
        line: 0,
        snippet: '',
      });
      continue;
    }

    if (extensionOf(name) === '.js') {
      const text = buffer.toString('utf8');
      const before = findings.length;
      scanText(text, name, HOST_RULES, findings);
      scanAst(text, name, manifest, findings);
      // Точка входа — обычный скрипт в хосте; остальные .js тоже исполняемые.
      if (findings.length === before && !text.trim()) {
        findings.push({
          severity: 'warn',
          rule: 'empty-script',
          message: 'Пустой JavaScript-файл',
          file: name,
          line: 0,
          snippet: '',
        });
      }
    } else if (extensionOf(name) === '.css') {
      scanText(buffer.toString('utf8'), name, CSS_RULES, findings);
    } else if (extensionOf(name) === '.svg') {
      scanText(buffer.toString('utf8'), name, SVG_RULES, findings);
    }

    if (findings.length >= 100) break;
  }

  if (totalBytes > LIMITS.totalBytes) {
    findings.push({
      severity: 'block',
      rule: 'package-too-big',
      message: 'Распакованный пакет слишком большой',
      file: '',
      line: 0,
      snippet: '',
    });
  }

  collectApiFindings(manifest, files, findings);

  const unique = dedupeFindings(findings);
  const blocked = unique.filter((item) => item.severity === 'block');
  const warnings = unique.filter((item) => item.severity === 'warn');
  const verdict = blocked.length ? 'blocked' : warnings.length ? 'review' : 'safe';

  return {
    verdict,
    score: blocked.length * 100 + warnings.length * 5,
    findings: unique.slice(0, 100),
    blocked: blocked.length,
    warnings: warnings.length,
    files: files.size,
    bytes: totalBytes,
    permissions: describePermissions(manifest.permissions),
    baseline: baselinePermissions(),
    risk: highestRisk(manifest.permissions),
    scannedAt: new Date().toISOString(),
  };
}

/** Проверка скрипта, который плагин собирается выполнить на странице. */
function scanPageScript(code) {
  const text = String(code || '');
  if (text.length > LIMITS.pageScriptBytes) {
    return {
      ok: false,
      findings: [
        {
          severity: 'block',
          rule: 'page-script-size',
          message: 'Скрипт для страницы слишком большой',
          file: 'page',
          line: 0,
          snippet: '',
        },
      ],
    };
  }

  const findings = [];
  scanText(text, 'page', PAGE_RULES, findings);
  return { ok: !findings.some((item) => item.severity === 'block'), findings };
}

/** CSS можно вставлять на страницу только без внешних загрузок и выражений. */
function validateCss(css) {
  const text = String(css || '');
  if (text.length > LIMITS.cssBytes) {
    return { ok: false, error: `CSS больше ${Math.round(LIMITS.cssBytes / 1024)} КБ` };
  }
  const findings = [];
  scanText(text, 'inline.css', CSS_RULES, findings);
  const blocked = findings.find((item) => item.severity === 'block');
  return blocked ? { ok: false, error: blocked.message, findings } : { ok: true, findings };
}

/** Итоговое решение по установке с учётом настроек и подписи. */
function installDecision({ report, signature, settings, update = false }) {
  if (report.verdict === 'blocked') {
    return {
      ok: false,
      reason: 'blocked',
      message: 'Проверка безопасности нашла запрещённые конструкции.',
    };
  }
  if (signature === 'invalid') {
    return {
      ok: false,
      reason: 'signature',
      message: 'Подпись не совпадает с содержимым пакета.',
    };
  }
  if (settings.requireSignatures && signature !== 'verified') {
    return {
      ok: false,
      reason: 'signature-required',
      message: 'Включён режим «только подписанные плагины».',
    };
  }
  if (!settings.allowUnsigned && signature === 'unsigned') {
    return {
      ok: false,
      reason: 'unsigned-disabled',
      message: 'Неподписанные плагины запрещены в настройках.',
    };
  }
  return { ok: true, update };
}

module.exports = {
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  HOST_RULES,
  PAGE_RULES,
  CSS_RULES,
  scanFiles,
  scanPageScript,
  validateCss,
  installDecision,
};
