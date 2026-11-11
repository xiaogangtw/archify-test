import { captureUi } from './ui-evidence.mjs';
import { safeDiagnostic, uiFailure } from './ui-diagnostics.mjs';

const subjects = new WeakMap();
const roles = new WeakMap();
const sessions = new WeakMap();
const readySelectors = new WeakMap();
const observations = new WeakMap();
const factories = new Set(['locator', 'frameLocator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByTestId', 'getByTitle', 'getByAltText']);
const chains = new Set(['first', 'last', 'nth', 'filter', 'and', 'or', 'contentFrame']);
const actions = new Map(Object.entries({ goto: '開啟頁面', reload: '重新整理', goBack: '返回', goForward: '前進',
  setContent: '載入畫面', click: '點擊', dblclick: '雙擊', tap: '觸碰', fill: '填寫', clear: '清空',
  press: '按鍵', pressSequentially: '逐字輸入', type: '輸入', check: '勾選', uncheck: '取消勾選',
  setChecked: '設定勾選', selectOption: '選擇選項', setInputFiles: '選取檔案', hover: '移入', focus: '聚焦',
  blur: '離開焦點', dragTo: '拖曳', dragAndDrop: '拖曳', scrollIntoViewIfNeeded: '捲動至元素',
  dispatchEvent: '觸發事件', wheel: '捲動', down: '按下', up: '放開', move: '移動', insertText: '輸入文字',
  getAttribute: '讀取屬性', innerText: '讀取文字', textContent: '讀取內容', inputValue: '讀取欄位',
  isVisible: '檢查可見性', isEnabled: '檢查可操作性', isChecked: '檢查勾選', count: '檢查數量',
  waitFor: '等待元素', waitForURL: '等待頁面', waitForLoadState: '等待載入' }));
const checks = { toBeVisible: '元素可見', toBeHidden: '元素隱藏', toHaveText: '文字符合預期', toContainText: '包含預期文字',
  toHaveCount: '數量符合預期', toBeEnabled: '可以操作', toBeDisabled: '不可操作', toBeChecked: '已勾選',
  toHaveValue: '欄位值符合預期', toHaveAttribute: '屬性符合預期', toHaveURL: '網址符合預期', toHaveTitle: '標題符合預期' };
function state(info) {
  if (!sessions.has(info)) sessions.set(info, { sequence: 0, pages: new WeakMap(), pageCount: 0 });
  return sessions.get(info);
}
export function setUiRole(page, role) {
  const subject = subjects.get(page);
  const raw = subject?.page || page;
  if (typeof role !== 'string' || !role.trim() || role.length > 60) throw new Error('畫面角色必須是 1–60 字文字。');
  roles.set(raw, role);
}
function pageLabel(page, info) {
  const session = state(info);
  if (!session.pages.has(page)) session.pages.set(page, ++session.pageCount);
  return (roles.get(page) || '使用者') + '／頁面' + session.pages.get(page);
}
function description(key, args) {
  // Describe the target, never the typed value, URL, file path or key content.
  const label = key === 'getByRole' ? args[1]?.name : factories.has(key) && key !== 'locator' && key !== 'frameLocator' ? args[0] : '';
  return typeof label === 'string' ? label.slice(0, 70) : key === 'getByRole' ? String(args[0]).slice(0, 30) : '畫面元素';
}
export function setUiReady(page, selector, timeoutMs = 15_000) {
  const subject = subjects.get(page);
  if (!subject?.page || selector !== null && (typeof selector !== 'string' || !selector.trim()) || !Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) throw new Error('畫面就緒條件或等待上限不合法。');
  readySelectors.set(subject.page, { selector, timeoutMs });
}
async function waitUntilReady(page) {
  const {selector,timeoutMs} = readySelectors.get(page) || {timeoutMs:15_000};
  try {
    if (selector) await page.locator(selector).first().waitFor({ state: 'visible', timeout: timeoutMs });
    else await page.waitForFunction(() => {
      const body = document.body;
      if (!body) return false;
      if (body.innerText.trim()) return true;
      return [...body.querySelectorAll('input,button,canvas,svg,img')].some(element => {
        const box = element.getBoundingClientRect(), style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' &&
          (!(element instanceof HTMLImageElement) || element.complete && element.naturalWidth > 0);
      });
    }, undefined, { timeout: timeoutMs });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  } catch { throw uiFailure('UI_NOT_READY', { timeoutMs, ...observations.get(page) }); }
}
async function operation(page, info, step, caption, callback, expected = '完成' + caption + '，且操作後畫面具備可見內容。', ready = true) {
  const sequence = ++state(info).sequence;
  const title = `${sequence}. ${pageLabel(page, info)}｜${caption}`.slice(0, 170);
  return step(title, async () => {
    let value, failure;
    const errorsBefore = info.errors.length;
    try { value = await callback(); if (ready) await waitUntilReady(page); } catch (error) { failure = error; }
    const diagnostic = failure ? safeDiagnostic(failure, observations.get(page)) : undefined;
    let imageFailure;
    try {
      await captureUi(() => {
        if (page.isClosed()) throw new Error('畫面已關閉，無法擷取此步驟。');
        return page.screenshot({ type: 'png', fullPage: false, timeout: 10_000,
          mask: [page.locator('input[type="password"],input[autocomplete="one-time-code"],input[placeholder*="驗證碼"],input[name*="otp" i],input[name*="token" i],input[name*="password" i]')] });
      }, info,
      `${title}｜${failure || info.errors.length > errorsBefore ? '失敗當下' : '完成後'}`);
    } catch { imageFailure = new Error('逐步截圖失敗，證據不完整；未重送操作。'); }
    if (imageFailure) {
      await info.attach('archify-evidence-error', { body: '逐步截圖失敗，證據不完整；未重送操作。', contentType: 'text/plain' });
    }
    await info.attach('archify-step-detail', { body: JSON.stringify({ name: title, expected,
      actual: diagnostic ? diagnostic.message : info.errors.length > errorsBefore ? '斷言未符合預期。' : '此操作已完成；業務是否正確以相關斷言為準。', diagnostic }), contentType: 'application/json' });
    if (failure) throw failure;
    if (imageFailure) throw imageFailure;
    return value;
  });
}

export function instrumentBrowser(browser, getInfo, step) {
  const cache = new WeakMap();
  function wrap(object, kind, page, label = '畫面') {
    if (!object || typeof object !== 'object') return object;
    if (cache.has(object)) return cache.get(object);
    if (kind === 'page' && !observations.has(object)) {
      const counters = { pageErrors: 0, requestFailures: 0, httpErrors: 0 };
      observations.set(object, counters);
      object.on('pageerror', () => { counters.pageErrors++; });
      object.on('requestfailed', () => { counters.requestFailures++; });
      object.on('response', response => { if (response.status() >= 400) counters.httpErrors++; });
    }
    const proxy = new Proxy(object, { get(target, key) {
      const value = Reflect.get(target, key, target);
      if (kind === 'page' && ['keyboard', 'mouse', 'touchscreen'].includes(key)) return wrap(value, 'input', page);
      if (typeof value !== 'function') return value;
      return (...args) => {
        // Restore raw Locator arguments for APIs that use identity internally.
        const rawArgs = args.map(arg => subjects.get(arg)?.raw || arg);
        if (kind === 'browser' && ['newContext', 'newPage'].includes(key)) return value.apply(target, rawArgs).then(item => wrap(item, key === 'newPage' ? 'page' : 'context', key === 'newPage' ? item : undefined));
        if (kind === 'browser' && key === 'contexts') return value.apply(target, rawArgs).map(item => wrap(item, 'context'));
        if (kind === 'context' && key === 'newPage') return value.apply(target, rawArgs).then(item => wrap(item, 'page', item));
        if (kind === 'context' && key === 'pages') return value.apply(target, rawArgs).map(item => wrap(item, 'page', item));
        if (kind === 'page' && key === 'context') return wrap(value.apply(target, rawArgs), 'context');
        if (kind === 'page' && ['frame', 'mainFrame'].includes(key)) return wrap(value.apply(target, rawArgs), 'locator', page, '內嵌頁面');
        if (kind === 'page' && key === 'frames') return value.apply(target, rawArgs).map(item => wrap(item, 'locator', page, '內嵌頁面'));
        if ((kind === 'page' || kind === 'context') && key === 'waitForEvent' && ['popup', 'page'].includes(args[0])) return value.apply(target, rawArgs).then(item => wrap(item, 'page', item));
        if (kind === 'locator' && key === 'all') return value.apply(target, rawArgs).then(items => items.map(item => wrap(item, 'locator', page, label)));
        if ((kind === 'page' || kind === 'locator') && (factories.has(key) || chains.has(key))) {
          const item = value.apply(target, rawArgs);
          return wrap(item, 'locator', page, factories.has(key) ? description(key, args) : label);
        }
        if ((kind === 'page' || kind === 'locator' || kind === 'input') && actions.has(key)) {
          const caption = actions.get(key) + (kind === 'locator' ? '：' + label : '');
          return operation(page, getInfo(), step, caption, () => value.apply(target, rawArgs));
        }
        return value.apply(target, rawArgs);
      };
    } });
    cache.set(object, proxy);
    subjects.set(proxy, { raw: object, page, label, getInfo, step });
    return proxy;
  }
  return wrap(browser, 'browser');
}

export function uiStep(page, title, callback, expected) {
  const subject = subjects.get(page);
  if (!subject?.page) throw new Error('uiStep 必須使用共用 fixture 的 page。');
  return operation(subject.page, subject.getInfo(), subject.step, title, callback, expected);
}

export async function uiWaitForResponse(page, operationName, trigger, timeoutMs = 30_000) {
  const subject = subjects.get(page);
  if (!subject?.page || !/^[A-Z][A-Za-z0-9_]{1,79}$/.test(operationName)) throw new Error('必須使用共用 page 與 GraphQL operation 名稱。');
  const response = subject.page.waitForResponse(row => {
    try { return row.request().method() === 'POST' && row.request().postDataJSON()?.operationName === operationName; } catch { return false; }
  }, { timeout: timeoutMs });
  void response.catch(() => {});
  return operation(subject.page, subject.getInfo(), subject.step, '等待 ' + operationName + ' 回應', async () => {
    await trigger();
    try { return await response; } catch { throw uiFailure('RESPONSE_TIMEOUT', { operation: operationName, timeoutMs }); }
  }, '收到本次操作觸發的 ' + operationName + ' HTTP 回應；業務內容另行斷言。');
}

export function instrumentExpect(expect, getInfo, step) {
  function matcher(value, page, label, message, negated = false) {
    return new Proxy(value, { get(target, key) {
      const item = Reflect.get(target, key, target);
      if (typeof item === 'function') return (...args) => operation(page, getInfo(), step,
        '驗證：' + (typeof message === 'string' ? message.slice(0, 80) : label + '／' + (negated ? '不應' : '應') + (checks[key] || String(key))), () => item.apply(target, args),
        typeof message === 'string' ? message.slice(0, 500) : label + '／' + (negated ? '不應' : '應') + (checks[key] || String(key)));
      return item && typeof item === 'object' ? matcher(item, page, label, message, key === 'not' ? !negated : negated) : item;
    } });
  }
  return new Proxy(expect, { apply(target, receiver, args) {
    const subject = subjects.get(args[0]);
    const result = Reflect.apply(target, receiver, args);
    return subject?.page ? matcher(result, subject.page, subject.label, args[1]) : result;
  }, get(target, key) {
    const value = Reflect.get(target, key);
    return ['soft', 'configure', 'extend'].includes(key) && typeof value === 'function' ? (...args) => {
      if (key !== 'soft') return instrumentExpect(value.apply(target, args), getInfo, step);
      const subject = subjects.get(args[0]);
      const result = value.apply(target, args);
      return subject?.page ? matcher(result, subject.page, subject.label, args[1]) : result;
    } : value;
  } });
}
