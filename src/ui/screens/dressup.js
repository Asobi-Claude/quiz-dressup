// ドレスアップ（ルック選択）
import { h, sleep } from '../dom.js';
import { bigButton, iconButton, stars } from '../common.js';
import { createWitch } from '../witch.js';
import { picture, charImageNames, preload } from '../images.js';
import { sparkleAt, flash } from '../effects.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import { looksFor, isUnlocked, remainingFor, lookPages, initialLookPage } from '../../logic/unlock.js';
import { setWearing, totalCorrect } from '../../logic/progress.js';

export function dressupScreen(app) {
  const placeId = app.visit?.placeId;
  const place = app.place(placeId);
  const looks = looksFor(app.game.looks, placeId, app.charId);
  const total = totalCorrect(app.progress, app.charId, placeId);
  // ドレスは1ページ6着（3×2）。たくさんあるときは、◀ ▶ でページをめくる。開くときは、着ているドレスのページ
  const pages = lookPages(looks);
  // 新しいドレスが解放された直後は、そのドレスのページで開く（2ページ目以降でも、見つけやすい）。
  // 「おひろめ」から戻ったときは、着ているドレスのページに戻れるよう、1回使ったら空にする
  const newly = app.visit?.summary?.newly ?? [];
  if (app.visit?.summary) app.visit.summary = { ...app.visit.summary, newly: [] };
  let page = initialLookPage(looks, placeId, app.wearingLook(), newly);
  const witch = createWitch(app, { cls: 'witch-dress' });
  const tok = app.token;
  preload(looks.filter((l) => isUnlocked(l, total)).map((l) => l.image));

  const figure = h('button', {
    class: 'figure',
    type: 'button',
    'aria-label': 'おひろめ する',
    onTap: () => toOhirome(),
  });
  function renderFigure() {
    const look = app.wearingLook();
    figure.classList.toggle('is-special', !!look?.special);
    figure.replaceChildren(picture(charImageNames(app.game, app.charId, look), { kind: 'char', label: app.char?.name }));
    thumbs.forEach((t) => t.classList.toggle('is-wearing', !!look && t.dataset.look === look.id));
  }

  let thumbs = []; // いまのページの6着（ページをめくると作り直す）
  const makeThumb = (l) => {
    const open = isUnlocked(l, total);
    const rest = remainingFor(l, total);
    const btn = h('button', {
      class: `thumb ${open ? 'is-open' : 'is-locked'} ${l.special ? 'is-special' : ''}`,
      type: 'button',
      'aria-label': open ? l.name : `あと ${rest}もん`,
      dataset: { look: l.id },
      onTap: () => (open ? wear(l, btn) : locked(l, btn, rest)),
    },
    h('span', { class: 'thumb-pic' }, picture(l.image, { kind: 'char', label: open ? l.name : '' })),
    open ? null : h('span', { class: 'thumb-lock' },
      h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒'),
      h('span', { class: 'thumb-rest' }, `あと${rest}もん`),
      stars(Math.min(rest, 9), 0, 'thumb-stars')));
    return btn;
  };

  const thumbsEl = h('div', { class: 'thumbs' });
  const prevBtn = iconButton('◀', 'まえの ページ', () => turn(-1), 'pager-btn');
  const nextBtn = iconButton('▶', 'つぎの ページ', () => turn(1), 'pager-btn');
  const pageNum = h('span', { class: 'pager-num', 'aria-live': 'polite' });
  const pager = pages.length > 1 ? h('div', { class: 'pager' }, prevBtn, pageNum, nextBtn) : null;

  function renderThumbs() {
    thumbs = (pages[page] ?? []).map(makeThumb);
    thumbsEl.replaceChildren(...thumbs);
    const wearing = app.wearingLook();
    thumbs.forEach((t) => t.classList.toggle('is-wearing', !!wearing && t.dataset.look === wearing.id));
    pageNum.textContent = `${page + 1} / ${pages.length}`;
    prevBtn.disabled = page === 0;
    nextBtn.disabled = page >= pages.length - 1;
  }
  function turn(d) {
    const next = page + d;
    if (next < 0 || next >= pages.length) return;
    page = next;
    renderThumbs();
  }

  let changing = false;
  async function wear(look, btn) {
    if (changing) return;
    changing = true;
    app.save(setWearing(app.progress, app.charId, { place: look.place, no: look.no }));
    figure.classList.add('is-changing');
    sparkleAt(app.stage, figure, { count: 24, spread: 300 });
    sfx.play('sparkle');
    await sleep(260);
    if (!tok.alive) return;
    flash(app.stage);
    sfx.play('shutter');
    renderFigure();
    figure.classList.remove('is-changing');
    figure.classList.add('is-changed');
    setTimeout(() => figure.classList.remove('is-changed'), 700);
    ohiromeBtn.classList.add('pulse');
    changing = false;
    await voice.speak(look.name, { key: `look:${look.id}` });
    if (!tok.alive) return;
    await witch.sayScene('afterDressup');
  }

  function locked(look, btn, rest) {
    sfx.play('pop');
    btn.classList.remove('wiggle');
    void btn.offsetWidth;
    btn.classList.add('wiggle');
    voice.speak(`あと ${rest}もん せいかい すると きられるよ`);
  }

  function toOhirome() { app.go('ohirome'); }

  const ohiromeBtn = bigButton('📸', 'おひろめ', toOhirome, 'go ohirome');

  const el = h('div', { class: `dress-wrap ${pager ? 'has-pager' : ''}` },
    iconButton('🏠', 'マップに もどる', () => app.go('map'), 'home'),
    witch.el,
    figure,
    thumbsEl,
    pager,
    ohiromeBtn);
  renderThumbs();
  renderFigure();

  return {
    el,
    bg: { name: place.bg, color: place.color },
    enter() { witch.sayScene('dressup'); },
  };
}
