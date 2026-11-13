// ドレスアップ（ルック選択）
import { h, sleep } from '../dom.js';
import { bigButton, iconButton, stars } from '../common.js';
import { createWitch } from '../witch.js';
import { picture, charImageNames, preload } from '../images.js';
import { sparkleAt, flash } from '../effects.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import { looksFor, isUnlocked, remainingFor } from '../../logic/unlock.js';
import { setWearing, totalCorrect } from '../../logic/progress.js';

export function dressupScreen(app) {
  const placeId = app.visit?.placeId;
  const place = app.place(placeId);
  const looks = looksFor(app.game.looks, placeId, app.charId);
  const total = totalCorrect(app.progress, app.charId, placeId);
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

  const thumbs = looks.map((l) => {
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
  });

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

  const el = h('div', { class: 'dress-wrap' },
    iconButton('🏠', 'マップに もどる', () => app.go('map'), 'home'),
    witch.el,
    figure,
    h('div', { class: 'thumbs' }, thumbs),
    ohiromeBtn);
  renderFigure();

  return {
    el,
    bg: { name: place.bg, color: place.color },
    enter() { witch.sayScene('dressup'); },
  };
}
