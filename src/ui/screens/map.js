// おでかけマップ
import { h } from '../dom.js';
import { picture, charImageNames } from '../images.js';
import { iconButton } from '../common.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import { hasVisited, totalCorrect } from '../../logic/progress.js';
import { looksFor, unlockedLooks } from '../../logic/unlock.js';
import { openSettings } from './settings.js';

export function mapScreen(app) {
  const look = app.wearingLook();
  const pins = app.game.places.map((p) => {
    const visited = hasVisited(app.progress, app.charId, p.id);
    const looks = looksFor(app.game.looks, p.id, app.charId);
    const got = visited ? unlockedLooks(looks, totalCorrect(app.progress, app.charId, p.id)).length : 0;
    const cls = ['place-pin', !p.enabled && 'is-off', p.enabled && !visited && 'is-new'].filter(Boolean).join(' ');
    return h('button', {
      class: cls,
      type: 'button',
      style: { left: `${p.map?.x ?? 50}%`, top: `${p.map?.y ?? 50}%`, '--c': p.color ?? '#9b7fc9' },
      'aria-label': p.name,
      dataset: { place: p.id },
      onTap: () => {
        if (!p.enabled) return;
        sfx.play('pop');
        app.go('entrance', { placeId: p.id });
      },
    },
    h('span', { class: 'pin-medal', 'aria-hidden': 'true' }, p.icon ?? '❓'),
    h('span', { class: 'pin-name' }, p.enabled ? p.name : 'じゅんびちゅう'),
    p.enabled ? h('span', { class: 'pin-dots', 'aria-label': `ドレス ${got} / ${looks.length}` },
      looks.map((l, i) => h('i', { class: i < got ? 'is-on' : '' }))) : null);
  });
  // 場所がタップできないとき（じゅんびちゅう）は反応を返す
  pins.forEach((pin, i) => {
    if (!app.game.places[i].enabled) pin.addEventListener('click', () => voice.speak('ここは まだ じゅんびちゅう だよ'));
  });

  const el = h('div', { class: `map-wrap ${app.game.places.length > 5 ? 'is-dense' : ''}` },
    h('button', {
      class: `me ${look?.special ? 'is-special' : ''}`,
      type: 'button',
      'aria-label': 'キャラを かえる',
      style: { '--c': app.char?.color },
      onTap: () => { sfx.play('tap'); app.go('title'); },
    },
    h('span', { class: 'me-pic' }, picture(charImageNames(app.game, app.charId, look), { kind: 'char', label: app.char?.name })),
    h('span', { class: 'me-name' }, app.char?.name)),
    h('div', { class: 'map-ask' }, 'どこに いく？'),
    iconButton('⚙️', 'せってい', () => openSettings(app), 'gear'),
    h('div', { class: 'pins' }, pins));

  return {
    el,
    bg: { name: 'bg_map', color: '#f3ead2' },
    enter() { voice.speak('どこに あそびに いく？'); },
  };
}
