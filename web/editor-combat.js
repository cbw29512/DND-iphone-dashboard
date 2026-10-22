/** Initiative order is authoritative on the backend; hidden HP never sent to players. */
import { api } from './api.js';
import { button, empty, node } from './dom.js';

export function combatEditor(root, state, refresh) {
  root.replaceChildren(node('p', { text: 'Track combat privately. Only visible combatants and initiative values reach the player screen.', cls: 'section-caption' }));
  const form = node('form', { cls: 'combat-form' });
  const name = node('input', { attrs: { placeholder: 'Combatant name', required: '', maxlength: 80, 'aria-label': 'Combatant name' } });
  const init = node('input', { attrs: { type: 'number', value: 10, min: -20, max: 99, required: '', 'aria-label': 'Initiative score' } });
  const add = node('button', { text: '+ Add', cls: 'primary', attrs: { type: 'submit' } });
  form.append(name, init, add);
  const hiddenLabel = node('label', { text: ' Hide this combatant from the player display', cls: 'section-caption' });
  const hidden = node('input', { attrs: { type: 'checkbox', style: 'width:auto;min-height:0;margin-right:8px' } });
  hiddenLabel.prepend(hidden);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await api('/combatants', { method: 'POST', data: { name: name.value, initiative: Number(init.value), visible: !hidden.checked } });
      await refresh();
    } catch (error) { console.error('Unable to add combatant', error); }
  });
  root.append(form, hiddenLabel);
  const settings = state.settings;
  root.append(node('div', { cls: 'toolbar' }, [node('strong', { text: `Turn Order · Round ${settings.round_number}` }),
    node('div', { cls: 'controls' }, [button('Next Turn →', async () => { await api('/combat/next', { method: 'POST' }); await refresh(); }, 'primary'),
      button('Reset Round', async () => { await api('/combat/reset', { method: 'POST' }); await refresh(); })])]));
  const list = node('ul', { cls: 'combat-list' });
  for (const item of state.combatants) {
    const row = node('li', { cls: `combat-row${item.id === settings.active_turn ? ' active-turn' : ''}` }, [
      node('strong', { text: String(item.initiative), cls: 'init' }),
      node('div', { cls: 'name' }, [node('strong', { text: item.name }),
        node('div', { cls: 'private', text: `${item.visible ? 'Player-visible' : 'DM only'}${item.hp_current !== null ? ` · HP ${item.hp_current}/${item.hp_max ?? '?'}` : ''}` })]),
      button('✕', async () => { await api(`/combatants/${item.id}`, { method: 'DELETE' }); await refresh(); }, 'quiet')]);
    list.append(row);
  }
  root.append(list.children.length ? list : empty('No combatants added yet.'));
}
