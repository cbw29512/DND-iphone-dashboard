/** Player view renderer uses only /api/display/state, with no private DM fields. */
import { node } from './dom.js';

const DAMAGE_VISUALS = {
  fire: ['🔥', 'fire'], cold: ['❄️', 'cold'], poison: ['☠️', 'poison'],
  acid: ['🧪', 'acid'], lightning: ['⚡', 'lightning'], thunder: ['💥', 'thunder'],
  necrotic: ['💀', 'necrotic'], radiant: ['✨', 'radiant'],
  psychic: ['🧠', 'psychic'], force: ['✦', 'force'],
  bludgeoning: ['🔨', 'physical'], piercing: ['🏹', 'physical'], slashing: ['⚔️', 'physical']
};
function damageTypeBadge(raw) {
  const type = String(raw || 'untyped').toLowerCase().trim();
  const [symbol, theme] = DAMAGE_VISUALS[type] || ['◆', 'other'];
  return node('div', { cls: 'initiative-damage-type damage-' + theme }, [
    node('span', { text: symbol, attrs: { 'aria-hidden': 'true' } }),
    node('span', { text: type.toUpperCase() })
  ]);
}
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
    panel.append(node('p', { text: 'THE FATES HAVE SPOKEN', cls: 'eyebrow' }),
      node('div', { text: content.text || 'Ready to roll', cls: 'dice-result' }));
  } else if (state.card === 'initiative') {
    panel.classList.add('initiative-card', 'initiative-split');
    const combatants = content.combatants ?? [];
    const current = combatants.find(x => x.id === content.active_turn) ?? combatants[0];
    const top = node('div', { cls: 'initiative-token-zone' });
    const header = node('div', { cls: 'initiative-header' }, [
      node('strong', { text: 'ROUND ' + (content.round ?? 1) }),
      node('span', { text: 'TURN ' + (current ? combatants.indexOf(current) + 1 : 0) + ' / ' + combatants.length })
    ]);
    top.append(header);
    if (current?.asset_id) {
      const token = node('img', { cls: 'initiative-token', attrs: {
        src: '/api/media/' + encodeURIComponent(current.asset_id), alt: current.name
      } });
      token.onerror = () => { token.replaceWith(node('div', { cls: 'initiative-token-placeholder', text: current.name })); };
      top.append(token);
    } else {
      top.append(node('div', { cls: 'initiative-token-placeholder', text: current?.name || 'Waiting for combat' }));
    }
    const bottom = node('div', { cls: 'initiative-score-zone' }, [
      node('div', { cls: 'initiative-label', text: content.attack?.hit === false ? 'ATTACK' : content.attack ? 'TO HIT' : 'INITIATIVE' }),
      node('div', { cls: 'initiative-big-number', text: content.attack?.hit === false ? 'MISS' : content.attack ? String(content.attack.total) : current ? String(current.initiative) : '—' }),
      ...(content.attack?.hit !== false && content.attack ? [node('div', { cls: 'initiative-roll-breakdown', text: 'd20 (' + content.attack.natural + ') ' + (content.attack.bonus >= 0 ? '+' : '−') + ' ' + Math.abs(content.attack.bonus) })] : []),
      ...(content.attack?.hit !== false && content.attack ? [
        node('div', { cls: 'initiative-label', text: 'DAMAGE' }),
        damageTypeBadge(content.attack.damage_type),
        node('div', { cls: 'initiative-damage-number', text: String(content.attack.damage) }),
        node('div', { cls: 'initiative-roll-breakdown', text: content.attack.damage_formula || '' }),
      ] : []),
      ...(content.attack?.hit !== false && content.attack?.condition ? [
        node('div', { cls: 'initiative-effect', text: String(content.attack.condition).toUpperCase() }),
        ...(content.attack.save_dc ? [node('div', { cls: 'initiative-effect-save', text: 'SAVE DC ' + content.attack.save_dc + ' · ' + String(content.attack.save_ability || '').toUpperCase() + ' · ON FAILED SAVE' })] : []),
      ] : []),
      ...(content.attack?.hit !== false && content.attack?.natural === 1 ? [node('div', { cls: 'initiative-attack-critical nat1', text: '💀 NATURAL 1! 💀' })] : []),
      ...(content.attack?.natural === 20 ? [node('div', { cls: 'initiative-attack-critical nat20', text: '🎉 NATURAL 20! 🎉' })] : []),
      node('div', { cls: 'initiative-combatant-name', text: current?.name || 'No combatant' }),
    ]);
    panel.append(top, bottom);
  }
  target.append(panel);
}
