/** Player view renderer uses only /api/display/state, with no private DM fields. */
import { node } from './dom.js';

function placeholder(text = 'Waiting for the DM to share a card') {
  return node('div', { cls: 'screen-empty' }, [node('span', { cls: 'symbol', text: '✧' }), node('p', { text })]);
}

export function renderPublic(target, state, compact = false) {
  target.replaceChildren();
  if (!state?.card) { target.append(placeholder()); return; }
  const content = state.content ?? {};
  if (state.card === 'gallery' || state.card === 'map') {
    if (!content.asset) { target.append(placeholder('No artwork shared yet')); return; }
    const image = node('img', { cls: 'artwork', attrs: { src: `/api/media/${encodeURIComponent(content.asset.id)}`, alt: content.asset.name } });
    image.onerror = () => { target.replaceChildren(placeholder('Unable to load artwork')); };
    target.append(image);
    return;
  }
  const panel = node('section', { cls: `player-card${compact ? ' compact' : ''}` });
  if (state.card === 'scene') {
    panel.append(node('p', { text: 'A STORY UNFOLDS', cls: 'eyebrow' }),
      node('p', { text: content.text || 'The scene begins…', cls: 'scene-text' }));
  } else if (state.card === 'dice') {
    panel.classList.add('dice-card');
    const effect = ['nat1', 'nat20'].includes(content.effect) ? content.effect : null;
    panel.append(node('div', { text: content.text || 'Ready to roll', cls: 'dice-result' }));
    if (effect) {
      const feedback = node('div', {
        cls: 'dice-critical ' + effect,
        text: effect === 'nat1' ? '💀 NATURAL 1! 💀' : '🎉 NATURAL 20! 🎉',
        attrs: { 'aria-label': effect === 'nat1' ? 'Natural one' : 'Natural twenty' },
      });
      // Key animation to the roll itself, not to repeated network refreshes.
      const animationKey = 'iron-lantern-effect-' + (compact ? 'preview' : 'player');
      const key = String(content.roll_id || '');
      if (key && target.dataset.lastDiceAnimation !== key) {
        target.dataset.lastDiceAnimation = key;
        feedback.classList.add('animate');
      }
      panel.append(feedback);
    }
  } else if (state.card === 'initiative') {
    panel.classList.add('initiative-card');
    panel.append(node('p', { text: 'THE ORDER OF BATTLE', cls: 'eyebrow' }), node('h1', { text: `Round ${content.round ?? 1}` }));
    const list = node('ol', { cls: 'initiative-rows' });
    for (const combatant of content.combatants ?? []) {
      const row = node('li', {}, [node('span', { text: combatant.initiative, cls: 'roll' }), node('span', { text: combatant.name })]);
      if (combatant.id === content.active_turn) {
        row.classList.add('current');
        row.append(node('span', { text: '◀ NOW', cls: 'turn' }));
      }
      list.append(row);
    }
    if (!list.children.length) list.append(node('li', { text: 'Waiting for initiative…' }));
    panel.append(list);
  }
  target.append(panel);
}
