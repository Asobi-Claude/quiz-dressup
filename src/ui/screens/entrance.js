// 場所の入口（魔女のあいさつ）
import { h, sleep } from '../dom.js';
import { bigButton, iconButton } from '../common.js';
import { createWitch } from '../witch.js';
import { entranceLines } from '../../logic/witch.js';
import { startPlace } from '../flow.js';

export function entranceScreen(app, { placeId }) {
  const place = app.place(placeId);
  const witch = createWitch(app, { cls: 'witch-entrance' });
  const lines = entranceLines(app.game.witch, app.mode, place);

  const start = () => startPlace(app, place);

  const el = h('div', { class: 'entrance-wrap' },
    iconButton('🏠', 'マップに もどる', () => app.go('map'), 'home'),
    h('div', { class: 'place-title', style: { '--c': place.color } },
      h('span', { class: 'place-title-icon', 'aria-hidden': 'true' }, place.icon), place.name),
    witch.el,
    bigButton('▶', 'はじめる', start, 'go start'));

  return {
    el,
    bg: { name: place.bg, color: place.color },
    async enter() {
      const tok = app.token;
      for (const line of lines) {
        if (!tok.alive) return;
        await witch.say(line);
        await sleep(200);
      }
    },
  };
}
