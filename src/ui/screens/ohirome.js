// おひろめ（着替えた姿を大きく）
import { h, sleep } from '../dom.js';
import { bigButton } from '../common.js';
import { picture, charImageNames } from '../images.js';
import { flash, sparkle } from '../effects.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import { pickLine } from '../../logic/witch.js';

export function ohiromeScreen(app) {
  const place = app.place(app.visit?.placeId) ?? app.game.places[0];
  const look = app.wearingLook();
  const tok = app.token;

  const photo = h('div', { class: `photo ${look?.special ? 'is-special' : ''}` },
    h('div', { class: 'photo-pic' }, picture(charImageNames(app.game, app.charId, look), { kind: 'char', label: app.char?.name })),
    h('p', { class: 'photo-caption' }, look ? `${app.char?.name}　${look.name}` : app.char?.name));

  const buttons = h('div', { class: 'ohirome-buttons is-later' },
    bigButton('👗', 'きがえる', () => app.go('dressup'), 'back'),
    bigButton('🗺️', 'マップへ', () => { app.visit = null; app.go('map'); }, 'go map'));

  const el = h('div', { class: 'ohirome-wrap' }, photo, buttons);

  return {
    el,
    bg: { name: place.bg, color: place.color },
    async enter() {
      // 読み上げが終わらなくても、ボタンは出す
      setTimeout(() => buttons.classList.remove('is-later'), 2600);
      await sleep(250);
      if (!tok.alive) return;
      flash(app.stage);
      sfx.play('shutter');
      photo.classList.add('snap');
      await sleep(350);
      sparkle(app.stage, 640, 330, { count: 30, spread: 420 });
      sfx.play('sparkle');
      const line = pickLine(app.game.witch, app.mode, 'ohirome');
      await voice.speak(line.text);
      if (!tok.alive) return;
      buttons.classList.remove('is-later');
    },
  };
}
