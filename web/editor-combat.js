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
  encounterSection.append(button('Load Goblin Test Fight', async () => {
    await api('/encounters/sample-goblin-fight', { method: 'POST' });
    await refresh(true);
  }, 'outline'));
  const editInputs = (card, current, save) => {
    const form = node('form', { cls: 'combat-edit-form' });
    const name = node('input', { attrs: { value: current.name, required: '', maxlength: 80, 'aria-label': 'Card name' } });
    const dex = node('input', { attrs: { type: 'number', value: current.modifier ?? current.initiative ?? 0, min: '-20', max: current.modifier === undefined ? '99' : '30', required: '', 'aria-label': current.modifier === undefined ? 'Initiative score' : 'Dexterity initiative modifier' } });
    const ac = node('input', { attrs: { type: 'number', value: current.armor_class ?? '', min: '1', max: '99', placeholder: 'AC', 'aria-label': 'Armor class' } });
    const token = node('select', { attrs: { 'aria-label': 'Card artwork' } }, tokenOptions());
    token.value = current.token_asset_id || '';
    const initiativeAdv = node('input', { attrs: { type: 'checkbox', 'aria-label': 'Advantage on initiative' } });
    initiativeAdv.checked = Boolean(current.initiative_advantage);
    form.append(node('label', { text: 'Name' }), name, node('label', { text: current.modifier === undefined ? 'Initiative score' : 'DEX / Initiative modifier' }), dex,
      node('label', { text: 'AC' }), ac, node('label', { text: 'Avatar' }), token);
    if (current.modifier !== undefined) form.append(node('label', { text: 'Initiative Advantage' }), initiativeAdv);
    form.append(node('button', { text: 'Save Changes', cls: 'primary', attrs: { type: 'submit' } }));
    form.addEventListener('submit', async e => { e.preventDefault(); await save({
      name: name.value.trim(), armor_class: ac.value ? Number(ac.value) : null,
      token_asset_id: token.value || null, [current.modifier === undefined ? 'initiative' : 'modifier']: Number(dex.value), initiative_advantage: initiativeAdv.checked
    }); await refresh(true); });
    card.append(form);
  };
  const tokenOptions = () => [
    node('option', { text: 'Name only (no artwork)', attrs: { value: '' } }),
    ...state.media.filter(m => m.category === 'gallery').map(m => node('option', { text: m.name, attrs: { value: m.id } }))
  ];
  for (const encounter of state.encounters || []) {
    const block = node('div', { cls: 'encounter-block' });
    block.append(node('strong', { text: encounter.name }));
    const participants = (state.encounter_members || []).filter(m => m.encounter_id === encounter.id);
    const roster = node('div', { cls: 'combat-card-grid prep-card-grid' });
    for (const member of participants) {
      const monster = Boolean(member.source_monster_id) || member.name.toLowerCase().includes('shaman');
      const preview = node('article', { cls: 'combatant-card prep-combatant-card' });
      const portrait = node('div', { cls: 'combatant-card-portrait' });
      if (member.token_asset_id) portrait.append(node('img', { attrs: {
        src: '/api/media/' + encodeURIComponent(member.token_asset_id), alt: member.name
      } }));
      else portrait.append(node('span', { text: member.name.slice(0,2).toUpperCase(), cls: 'combatant-card-monogram' }));
      const details = node('div', { cls: 'combatant-card-content' }, [
        node('div', { cls: 'combatant-card-heading' }, [
          node('strong', { text: member.name }),
          node('span', { text: monster ? 'MONSTER' : 'PLAYER', cls: 'combatant-card-badge' })
        ]),
        node('div', { cls: 'combatant-card-stats' }, [
          node('span', { text: (member.initiative_advantage ? 'ADV · ' : '') + 'DEX / INIT ' + (member.modifier >= 0 ? '+' : '') + member.modifier }),
          node('span', { text: 'AC ' + (member.armor_class ?? '—') })
        ]),
        ...(member.initiative_group ? [node('p', { cls: 'combatant-card-note', text: 'Shared initiative: ' + member.initiative_group })] : []),
        node('p', { cls: 'combatant-card-note', text: monster
          ? (state.attack_profiles || []).filter(p => p.source_complete && p.monster_id === member.source_monster_id)
              .map(p => p.attack_name + ' +' + p.attack_bonus + ' (' + p.damage_count + 'd' + p.damage_sides + (p.damage_bonus >= 0 ? '+' : '') + p.damage_bonus + ' ' + p.damage_type + ')').join(' · ') || 'No verified attacks or spells loaded'
          : 'Player controls their own actions' })
      ]);
      preview.append(portrait, details);
      const edit = button('Edit Card', () => {
        const existing = preview.querySelector('.combat-edit-form');
        if (existing) existing.remove();
        else editInputs(preview, member, data => api('/encounters/' + encodeURIComponent(encounter.id) + '/members/' + encodeURIComponent(member.id), { method: 'PUT', data }));
      }, 'quiet');
      preview.append(node('div', { cls: 'combatant-card-actions' }, [edit,
        button('Remove', async () => {
          await api('/encounters/' + encodeURIComponent(encounter.id) + '/members/' + encodeURIComponent(member.id), { method: 'DELETE' });
          await refresh(true);
        }, 'quiet')
      ]));
      roster.append(preview);
    }
    block.append(roster);
    const addForm = node('form', { cls: 'encounter-member-form' });
    const memberName = node('input', { attrs: { placeholder: 'Character or monster', maxlength: 80, required: '', 'aria-label': 'Participant' } });
    const modifier = node('input', { attrs: { type: 'number', value: '0', min: '-20', max: '30', required: '', 'aria-label': 'Initiative modifier' } });
    const armorClass = node('input', { attrs: { type: 'number', min: '1', max: '99', placeholder: 'AC', 'aria-label': 'Armor Class (optional)' } });
    const attackBonus = node('input', { attrs: { type: 'number', value: '0', min: '-30', max: '99', required: '', 'aria-label': 'Attack to-hit bonus' } });
    const artwork = node('select', { attrs: { 'aria-label': 'VTT artwork' } }, tokenOptions());
    const initiativeGroup = node('input', { attrs: { placeholder: 'Group (e.g. goblins)', maxlength: 80, 'aria-label': 'Shared initiative group' } });
    addForm.append(memberName, modifier, attackBonus, armorClass, artwork, initiativeGroup, node('button', { text: '+ Add', cls: 'outline', attrs: { type: 'submit' } }));
    addForm.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await api('/encounters/' + encodeURIComponent(encounter.id) + '/members', { method: 'POST', data: {
          name: memberName.value, modifier: Number(modifier.value), attack_bonus: Number(attackBonus.value), armor_class: armorClass.value ? Number(armorClass.value) : null, token_asset_id: artwork.value || null, initiative_group: initiativeGroup.value.trim() || null, source_monster_id: memberName.value.toLowerCase().trim() === 'goblin' ? 'goblin' : null
        } });
        await refresh(true);
      } catch (error) { console.error('Encounter participant failed', error); }
    });
    const monsterPicker = node('div', { cls: 'monster-picker' });
    monsterPicker.append(node('strong', { text: 'Add Monster Card' }));
    const monsterKind = node('select', { attrs: { 'aria-label': 'Monster library choice' } }, [
      node('option', { text: 'Goblin · 2014 SRD · Scimitar / Shortbow', attrs: { value: 'goblin' } }),
      node('option', { text: 'Goblin Shaman · placeholder (no verified spell card)', attrs: { value: 'shaman' } })
    ]);
    const monsterCount = node('input', { attrs: { type: 'number', min: 1, max: 10, value: 1, 'aria-label': 'How many monsters' } });
    monsterPicker.append(monsterKind, monsterCount, button('+ Add Monster', async () => {
      const type = monsterKind.value;
      const amount = Math.max(1, Math.min(10, Number(monsterCount.value) || 1));
      const already = participants.filter(p => type === 'goblin' ? p.source_monster_id === 'goblin' : p.name.startsWith('Goblin Shaman')).length;
      for (let n = 0; n < amount; n++) {
        await api('/encounters/' + encodeURIComponent(encounter.id) + '/members', { method: 'POST', data: type === 'goblin'
          ? { name: 'Goblin ' + (already + n + 1), modifier: 2, attack_bonus: 4, armor_class: 15, source_monster_id: 'goblin', initiative_group: 'goblins' }
          : { name: 'Goblin Shaman ' + (already + n + 1) + ' · example', modifier: 2, armor_class: 13 }
        });
      }
      await refresh(true);
    }, 'primary'));
    block.append(addForm, monsterPicker, button('⚄ Roll Initiative & Start Combat', async () => {
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
  const active = state.combatants.find(c => c.id === settings.active_turn);
  const cards = node('div', { cls: 'combat-card-grid' });
  for (const item of state.combatants) {
    const isActive = item.id === settings.active_turn;
    const isMonster = Boolean(item.source_monster_id) || item.name.toLowerCase().includes('goblin');
    const card = node('article', { cls: 'combatant-card' + (isActive ? ' is-active' : '') });
    const portrait = node('div', { cls: 'combatant-card-portrait' });
    if (item.token_asset_id) {
      const img = node('img', { attrs: { src: '/api/media/' + encodeURIComponent(item.token_asset_id), alt: item.name } });
      img.onerror = () => { img.remove(); portrait.append(node('span', { text: item.name.slice(0,1).toUpperCase(), cls: 'combatant-card-monogram' })); };
      portrait.append(img);
    } else {
      portrait.append(node('span', { text: item.name.split(' ').map(part => part[0]).slice(0,2).join('').toUpperCase(), cls: 'combatant-card-monogram' }));
    }
    card.append(portrait);
    card.append(node('div', { cls: 'combatant-card-content' }, [
      node('div', { cls: 'combatant-card-heading' }, [
        node('strong', { text: item.name }),
        node('span', { text: isActive ? 'CURRENT TURN' : (isMonster ? 'MONSTER' : 'PLAYER'), cls: 'combatant-card-badge' })
      ]),
      node('div', { cls: 'combatant-card-stats' }, [
        node('span', { text: 'INIT ' + item.initiative }),
        node('span', { text: 'AC ' + (item.armor_class ?? '—') }),
        node('span', { text: 'HP ' + (item.hp_current ?? '—') })
      ]),
      ...(item.initiative_group ? [node('p', { text: 'Shared initiative: ' + item.initiative_group, cls: 'combatant-card-note' })] : []),
      ...(isMonster ? [node('p', { text: (state.attack_profiles || []).filter(profile => profile.source_complete && profile.monster_id === item.source_monster_id).map(profile => profile.attack_name).join(' · ') || 'Attacks/spells not yet sourced', cls: 'combatant-card-note' })] : []),
    ]));
    if (isActive) {
      const activeActions = node('div', { cls: 'active-card-action-area' });
      const profiles = (state.attack_profiles || []).filter(p => p.source_complete && p.monster_id === item.source_monster_id);
      if (!isMonster) activeActions.append(node('p', { cls: 'combatant-card-note', text: 'Player turn — they roll and choose their actions.' }));
      else if (!profiles.length) activeActions.append(node('p', { cls: 'combatant-card-note', text: 'No verified attacks or spells available for this monster yet.' }));
      else {
        const move = node('select', { attrs: { 'aria-label': 'Choose monster attack' } },
          profiles.map(p => node('option', { text: p.attack_name + ' · +' + p.attack_bonus + ' · ' + p.damage_count + 'd' + p.damage_sides + (p.damage_bonus >= 0 ? '+' : '') + p.damage_bonus + ' ' + p.damage_type, attrs: { value: p.id } })));
        const targets = state.combatants.filter(c => c.id !== item.id && c.armor_class !== null && !c.source_monster_id);
        const target = node('select', { attrs: { 'aria-label': 'Choose player target' } },
          targets.map(t => node('option', { text: t.name + ' (AC ' + t.armor_class + ')', attrs: { value: t.id } })));
        activeActions.append(node('label', { text: 'Attack' }), move, node('label', { text: 'Target' }), target);
        if (!targets.length) activeActions.append(node('p', { cls: 'combatant-card-note', text: 'Add a player with AC to resolve hit or miss.' }));
        for (const [mode,label] of [['normal','Attack'],['advantage','ADV'],['disadvantage','DIS']]) {
          activeActions.append(button(label, async () => {
            await api('/combat/attack', { method: 'POST', data: { combatant_id: item.id, profile_id: move.value, target_id: target.value || null, mode } });
            await refresh(true);
          }, 'primary'));
        }
      }
      card.append(activeActions);
    }
        const actions = node('div', { cls: 'combatant-card-actions' });
    if (isActive) actions.append(button('Next Turn →', async () => { await api('/combat/next', { method: 'POST' }); await refresh(true); }, 'primary'));
    actions.append(button('Edit Card', () => {
      const existing = card.querySelector('.combat-edit-form');
      if (existing) existing.remove();
      else editInputs(card, item, data => api('/combatants/' + encodeURIComponent(item.id), { method: 'PUT', data }));
    }, 'quiet'));
    actions.append(button('Remove', async () => { await api('/combatants/' + item.id, { method: 'DELETE' }); await refresh(true); }, 'quiet'));
    card.append(actions);
    cards.append(card);
  }
  root.append(node('h3', { text: 'Combatant Cards · Round ' + settings.round_number }), cards.children.length ? cards : empty('Start a prepared combat to see its cards.'));
}
