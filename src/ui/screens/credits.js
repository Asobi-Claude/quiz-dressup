// 写真のクレジット（作者・ライセンス・出典）。文字だけで、リンクは付けない（URL も文字のまま）。
// 子どもが開かないよう、設定の「おとなの ひとへ」の3秒長押しから開く。
import { h } from '../dom.js';
import { bigButton } from '../common.js';
import { creditLines } from '../../logic/zukan.js';

export function openCredits(app) {
  const items = app.game.places.flatMap((p) => p.zukan ?? []);
  const groups = creditLines(items, app.game.places);
  const close = () => wrap.remove();

  const body = groups.length
    ? groups.map((g) => h('section', { class: 'credits-group' },
      h('h3', { class: 'credits-place' }, g.placeName),
      g.lines.map((l) => h('p', { class: 'credit-line' },
        h('b', {}, l.name), `　${l.author} ／ ${l.license}`,
        l.source ? h('span', { class: 'credit-source' }, l.source) : null,
        l.sourceUrl ? h('span', { class: 'credit-source' }, l.sourceUrl) : null,
        l.licenseUrl ? h('span', { class: 'credit-source' }, l.licenseUrl) : null))))
    : [h('p', { class: 'settings-note' }, 'まだ しゃしんは ありません')];

  const wrap = h('div', { class: 'modal credits' },
    h('div', { class: 'modal-card credits-card' },
      h('h2', { class: 'settings-title' }, 'しゃしんの さくしゃ'),
      // 写真は、ゲームで見やすいように小さくしている（CC BY は、変えたことを知らせる決まり）
      h('p', { class: 'settings-note small credits-note' }, 'しゃしんは、ゲームで みやすいように、ちいさく しています。'),
      h('div', { class: 'credits-body' }, body),
      bigButton('✅', 'とじる', close, 'close')));
  app.stage.appendChild(wrap);
}
