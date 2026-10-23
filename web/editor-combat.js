/** One-screen encounter slot builder and combat turn panel. */
import { api } from './api.js';
import { button, empty, node } from './dom.js';

let selectedEncounterId = null;

export function combatEditor(root, state, refresh) {
  root.replaceChildren();
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

  const encounters = state.encounters || [];
  if (!encounters.some(e => e.id === selectedEncounterId)) selectedEncounterId = encounters[0]?.id || null;
  const encounter = encounters.find(e => e.id === selectedEncounterId);
  const members = encounter ? (state.encounter_members || []).filter(m => m.encounter_id === encounter.id) : [];
  const builder = node('section', { cls: 'simple-battle-builder' });
  builder.append(node('h3', { text: 'Build Your Battle' }));
  const top = node('div', { cls: 'simple-battle-bar' });
  const selection = node('select', { attrs: { 'aria-label': 'Saved battle' } },
    encounters.map((e,i) => node('option', { text: 'Battle ' + (i+1) + ': ' + e.name, attrs: { value: e.id } })));
  selection.value = encounter?.id || '';
  selection.addEventListener('change', () => { selectedEncounterId = selection.value; refresh(true); });
  const create = button('+ New Battle', async () => {
    const next = encounters.length + 1;
    const response = await api('/encounters', { method: 'POST', data: { name: 'Combat ' + next } });
    selectedEncounterId = response.id;
    await refresh(true);
  }, 'outline');
  top.append(selection, create);
  builder.append(top);
  if (encounter) {
    const title = node('input', { attrs: { value: encounter.name, maxlength: 80, required: '', 'aria-label': 'Battle name' } });
    const status = node('span', { cls: 'battle-save-status', text: 'Cards persist when added' });
    const save = button('Save Battle', async () => {
      await api('/encounters/' + encodeURIComponent(encounter.id), { method: 'PUT', data: { name: title.value.trim() } });
      status.textContent = 'Saved';
      await refresh(true);
    }, 'primary');
    builder.append(node('div', { cls: 'simple-battle-bar' }, [title, save, status]));
    const slots = node('div', { cls: 'simple-slot-grid' });
    const total = Math.max(6, Math.ceil((members.length + 1) / 3) * 3);
    const openPicker = (index, existing) => {
      const previous = builder.querySelector('.simple-card-picker');
      if (previous) previous.remove();
      const picker = node('div', { cls: 'simple-card-picker' });
      picker.append(node('div', { cls: 'simple-picker-heading' }, [
        node('strong', { text: 'Slot ' + (index+1) + ' — Choose Card' }),
        button('Close', () => picker.remove(), 'quiet')
      ]));
      const playerName = node('input', { attrs: { value: existing && !existing.source_monster_id && !existing.name.includes('Shaman') ? existing.name : '', placeholder: 'Player name', maxlength: 80, 'aria-label': 'Player name' } });
      const playerAC = node('input', { attrs: { type: 'number', min: 1, max: 99, value: existing?.armor_class ?? 15, 'aria-label': 'Player AC' } });
      const playerDex = node('input', { attrs: { type: 'number', min: -20, max: 30, value: existing?.modifier ?? 0, 'aria-label': 'Player Dexterity modifier' } });
      const art = node('select', { attrs: { 'aria-label': 'Avatar' } }, tokenOptions());
      art.value = existing?.token_asset_id || '';
      const advLabel = node('label', { text: 'ADV on initiative' });
      const adv = node('input', { attrs: { type: 'checkbox', 'aria-label': 'Advantage on initiative' } });
      adv.checked = Boolean(existing?.initiative_advantage);
      advLabel.prepend(adv);
      const replaceWith = async data => {
        if (existing) await api('/encounters/' + encodeURIComponent(encounter.id) + '/members/' + encodeURIComponent(existing.id), { method: 'DELETE' });
        await api('/encounters/' + encodeURIComponent(encounter.id) + '/members', { method: 'POST', data });
        await refresh(true);
      };
      const addPlayer = async () => {
        if (!playerName.value.trim()) { playerName.focus(); return; }
        await replaceWith({ name: playerName.value.trim(), modifier: Number(playerDex.value), armor_class: Number(playerAC.value),
          token_asset_id: art.value || null, initiative_advantage: adv.checked });
      };
      const playerBox = node('div', { cls: 'simple-picker-section' }, [
        node('strong', { text: 'PLAYER' }), playerName, playerAC, playerDex, art, advLabel,
        button('Use Player Card', addPlayer, 'primary')
      ]);
      picker.append(playerBox);
      const monsterBox = node('div', { cls: 'simple-picker-section' });
      monsterBox.append(node('strong', { text: 'MONSTER' }));
      for (const type of [
        { name: 'Goblin', monster: 'goblin', group: 'goblins', ac:15, mod:2, attack:4, detail:'2014 SRD · Scimitar · Shortbow' },
        { name: 'Goblin Shaman · example', monster:null, group:null, ac:13, mod:2, attack:0, detail:'Example only · spells not implemented' }
      ]) {
        const name = type.monster ? 'Goblin ' + (members.filter(m => m.source_monster_id === 'goblin').length + 1) : type.name;
        monsterBox.append(button(type.name + ' — ' + type.detail, () => replaceWith({
          name, modifier:type.mod, armor_class:type.ac, attack_bonus:type.attack, source_monster_id:type.monster,
          initiative_group:type.group
        }), 'outline'));
      }
      picker.append(monsterBox);
      if (existing) picker.append(button('Clear Slot', async () => {
        await api('/encounters/' + encodeURIComponent(encounter.id) + '/members/' + encodeURIComponent(existing.id), { method:'DELETE' });
        await refresh(true);
      }, 'quiet'));
      builder.append(picker);
    };
    for (let i=0;i<total;i++) {
      const m=members[i];
      const slot=node('button', { cls: 'simple-battle-slot' + (m ? ' filled' : ''), attrs: { type:'button', 'aria-label':m ? 'Edit ' + m.name : 'Add card to slot ' + (i+1) } });
      if (m) {
        const portrait=node('div', { cls:'simple-slot-portrait' });
        if (m.token_asset_id) portrait.append(node('img', { attrs:{ src:'/api/media/'+encodeURIComponent(m.token_asset_id), alt:'' } }));
        else portrait.append(node('span', { text:m.name.slice(0,2).toUpperCase() }));
        slot.append(portrait,node('strong',{text:m.name}),node('small',{text:'AC '+(m.armor_class??'—')+' · DEX '+(m.modifier>=0?'+':'')+m.modifier}));
      } else slot.append(node('span',{text:'＋',cls:'simple-empty-plus'}),node('small',{text:'Empty Slot'}));
      slot.addEventListener('click',()=>openPicker(i,m));
      slots.append(slot);
    }
    builder.append(slots);
    builder.append(button('⚔ BATTLE — Roll Initiative',async()=>{
      if (!members.length) return;
      await api('/encounters/'+encodeURIComponent(encounter.id)+'/start',{method:'POST'});
      await refresh(true);
    },'primary'));
  } else builder.append(node('p',{text:'Create Battle 1, then click an empty slot to add cards.'}));
  root.append(builder);
  root.append(node('div',{cls:'editor-divider'}));
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
