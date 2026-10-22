/** Story cards and simple dice: editable on Windows, read-only on the phone. */
import { api } from './api.js';
import { button, node, notify } from './dom.js';

export function sceneEditor(root, state, refresh) {
  const field = node('textarea', { attrs: { placeholder: 'The tavern door creaks open…', maxlength: 4000, rows: 8, 'aria-label': 'Scene description' } });
  field.value = state.settings.scene_text;
  root.replaceChildren(node('p', { cls: 'section-caption', text: 'Write narration or a clue. Share the Scene Text card to reveal it on the phone.' }),
    node('label', { text: 'Player-facing narration' }), field,
    button('Save Scene', async () => { await api('/scene', { method: 'PUT', data: { text: field.value } }); notify('Scene saved'); await refresh(); }, 'primary'));
}

export function diceEditor(root, state, refresh) {
  const grid = node('div', { cls: 'dice-grid' });
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    grid.append(button(`d${sides}`, async () => {
      const result = await api('/dice/roll', { method: 'POST', data: { sides, count: 1, modifier: 0 } });
      notify(`Rolled d${sides}: ${result.total}`);
      await refresh();
    }));
  }
  const custom = node('input', { attrs: { placeholder: 'e.g. Critical hit! 42 damage', maxlength: 120, 'aria-label': 'Manual roll display' } });
  root.replaceChildren(node('p', { cls: 'section-caption', text: 'Roll a die or send a custom announcement to the player display.' }),
    node('p', { cls: 'section-label', text: 'Quick roll' }), grid, node('div', { cls: 'editor-divider' }),
    node('p', { cls: 'section-label', text: 'Custom display message' }), custom,
    button('Send Result', async () => { await api('/dice', { method: 'POST', data: { text: custom.value || 'Ready to roll' } }); await refresh(); }, 'primary'),
    node('p', { text: `Last display: ${state.settings.dice_text || '—'}`, cls: 'section-caption' }));
}
