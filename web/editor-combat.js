/** Initiative order is authoritative on the backend; hidden HP never sent to players. */
import { api } from './api.js';
import { button, empty, node } from './dom.js';

export function combatEditor(root, state, refresh) {
  root.replaceChildren(node('p', { text: 'Track combat privately. Only visible combatants and initiative values reach the player screen.', cls: 'section-caption' }));
  const encounterSection = node('section', { cls: 'encounter-prep' });
  encounterSection.append(node('h3', { text: 'Prepared combats' }));
  const newEncounterName = node('input', { attrs: { placeholder: 'Combat 1 · Goblin Ambush', maxlength: 80, 'aria-label': 'New encounter name' } });
  encounterSection.append(newEncounterName, button('+ Save Combat', async () => {
    if (!newEncounterName.value.trim()) return;
    await api('/encounters', { method: 'POST', data: { name: newEncounterName.value.trim() } });
    await refresh(true);
  }, 'primary'));
  const tokenOptions = () => [
    node('option', { text: 'Name only (no artwork)', attrs: { value: '' } }),
    ...state.media.filter(m => m.category === 'gallery').map(m => node('option', { text: m.name, attrs: { value: m.id } }))
  ];
  for (const encounter of state.encounters || []) {
    const block = node('div', { cls: 'encounter-block' });
    block.append(node('strong', { text: encounter.name }));
    const participants = (state.encounter_members || []).filter(m => m.encounter_id === encounter.id);
    const roster = node('ul', { cls: 'encounter-roster' });
    for (const member of participants) {
      const entry = node('li', {}, [
        node('span', { text: member.name + ' (' + (member.modifier >= 0 ? '+' : '') + member.modifier + ')' }),
        button('Remove', async () => {
          await api('/encounters/' + encodeURIComponent(encounter.id) + '/members/' + encodeURIComponent(member.id), { method: 'DELETE' });
          await refresh(true);
        }, 'quiet')
      ]);
      roster.append(entry);
    }
    block.append(roster);
    const addForm = node('form', { cls: 'encounter-member-form' });
    const memberName = node('input', { attrs: { placeholder: 'Character or monster', maxlength: 80, required: '', 'aria-label': 'Participant' } });
    const modifier = node('input', { attrs: { type: 'number', value: '0', min: '-20', max: '30', required: '', 'aria-label': 'Initiative modifier' } });
    const artwork = node('select', { attrs: { 'aria-label': 'VTT artwork' } }, tokenOptions());
    addForm.append(memberName, modifier, artwork, node('button', { text: '+ Add', cls: 'outline', attrs: { type: 'submit' } }));
    addForm.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await api('/encounters/' + encodeURIComponent(encounter.id) + '/members', { method: 'POST', data: {
          name: memberName.value, modifier: Number(modifier.value), token_asset_id: artwork.value || null
        } });
        await refresh(true);
      } catch (error) { console.error('Encounter participant failed', error); }
    });
    block.append(addForm, button('▶ Start Combat', async () => {
      if (!confirm('Start ' + encounter.name + '? This replaces the current turn order and rolls initiative for everyone.')) return;
      await api('/encounters/' + encodeURIComponent(encounter.id) + '/start', { method: 'POST' });
      await refresh(true);
    }, 'primary'));
    encounterSection.append(block);
  }
  root.append(encounterSection, node('div', { cls: 'editor-divider' }));
  const form = node('form', { cls: 'combat-form' });
  const name = node('input', { attrs: { placeholder: 'Combatant name', required: '', maxlength: 80, 'aria-label': 'Combatant name' } });
  const init = node('input', { attrs: { type: 'number', value: 10, min: -20, max: 99, required: '', 'aria-label': 'Initiative score' } });
  const add = node('button', { text: '+ Add', cls: 'primary', attrs: { type: 'submit' } });
  const token = node('select', { attrs: { 'aria-label': 'VTT artwork for manual combatant' } }, tokenOptions());
  form.append(name, init, token, add);
  const hiddenLabel = node('label', { text: ' Hide this combatant from the player display', cls: 'section-caption' });
  const hidden = node('input', { attrs: { type: 'checkbox', style: 'width:auto;min-height:0;margin-right:8px' } });
  hiddenLabel.prepend(hidden);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await api('/combatants', { method: 'POST', data: { name: name.value, initiative: Number(init.value), visible: !hidden.checked, token_asset_id: token.value || null } });
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
