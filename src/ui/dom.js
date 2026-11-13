// 小さな DOM のヘルパー

/** h('div', { class: 'a', onTap: fn, style: {...} }, 子ども...) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sv === undefined || sv === null) continue;
        if (sk.startsWith('--')) el.style.setProperty(sk, String(sv)); // CSS 変数は setProperty でないと入らない
        else el.style[sk] = sv;
      }
    }
    else if (k === 'onTap') onTap(el, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/**
 * タップ。連打しても1回ぶんだけ反応する（小さい子の連打・二度押し対策）。
 * disabled や .is-off の要素は反応しない。
 */
export function onTap(el, fn, wait = 350) {
  let last = -Infinity; // 0 だと、ページを開いた直後のタップが無視されてしまう
  el.addEventListener('click', (e) => {
    const now = performance.now();
    if (now - last < wait) return;
    if (el.disabled || el.classList.contains('is-off')) return;
    last = now;
    fn(e);
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ふりがなのない文を、行ごとの span に（改行 \n を活かす） */
export function lines(text) {
  return String(text).split('\n').flatMap((t, i) => (i ? [h('br'), t] : [t]));
}
