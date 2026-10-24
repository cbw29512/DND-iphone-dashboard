import { RAW_MONSTERS, MONSTER_BY_ID, makeInstance, makePlayer, rollInitiative, rollAttack } from './cards.js';
import { cardFace } from './card-view.js';
import { silhouetteFor } from './silhouettes.js';
import {configured,currentUser,signIn,signOut,createSession,savePrivateState,publishDisplayFrame,readMySessions} from './cloud-api.js';
import {projectPublicFrame} from './public-frame.js';
const $ = q => document.querySelector(q);
const node = (tag, text, cls) => { const el=document.createElement(tag); if(text!=null)el.textContent=String(text); if(cls)el.className=cls; return el; };
const button=(label,act,cls='secondary')=>{const e=node('button',label,cls);e.type='button';e.addEventListener('click',act);return e;};
let battles=[{id:'demo-1',name:'Goblin Ambush',cards:[]}], selectedId='demo-1', turnOrder=[], turnIndex=0, round=1, currentResult=null;
let targetSlot=0, pickerType='player';
let cloudSessionId=null,cloudRevision=0;
const cloudStatus=message=>{$('#cloud-message').textContent=message;};
const updateAuth=()=>{const on=!!currentUser();$('#cloud-login-form').hidden=on;$('#cloud-logout').hidden=!on;$('#cloud-create').disabled=!on;$('#cloud-load').disabled=!on;$('#cloud-save').disabled=!on;$('#cloud-status').textContent=!configured()?'Cloud not configured':on?'Signed in · '+currentUser().email:'Not signed in · local preview only';};
const publicFrame=()=>projectPublicFrame(currentBattle()?.name,round,turnOrder[turnIndex],currentResult);
async function pushFrame(){if(!cloudSessionId||!currentUser())return;cloudRevision=Math.max(Date.now(),cloudRevision+1);await publishDisplayFrame(cloudSessionId,publicFrame(),cloudRevision);cloudStatus('Phone frame updated · revision '+cloudRevision);}

const currentBattle=()=>battles.find(b=>b.id===selectedId);
const announce=message=>{$('#builder-status').textContent=message;};
function render(){
  const battle=currentBattle(); $('#battle-name').value=battle.name;
  const saved=$('#saved-battles');saved.replaceChildren();
  for(const b of battles){
    const c=button(b.name,()=>{selectedId=b.id;turnOrder=[];render();},b.id===selectedId?'selected':'secondary');
    saved.append(c);
  }
  const grid=$('#battle-grid');grid.replaceChildren();
  const slotCount=Math.max(6,Math.ceil((battle.cards.length+1)/3)*3);
  for(let i=0;i<slotCount;i++){
    const card=battle.cards[i],slot=button('',()=>openPicker(i),card?'slot filled':'slot empty');
    slot.setAttribute('aria-label',card?'Edit '+card.name:'Add a card in slot '+(i+1));
    if(card) slot.append(cardFace(card,{mode:'slot'}));
    else slot.append(node('span','+','plus'),node('small','Empty Slot'));
    grid.append(slot);
  }
  $('#start-battle').disabled=!battle.cards.length;
  renderCombat();
}
function openPicker(index){
  targetSlot=index;pickerType=currentBattle().cards[index]?.kind==='monster'?'monster':'player';
  renderPicker();$('#card-picker').showModal();
}
function renderPicker(){
  $('#tab-player').classList.toggle('selected',pickerType==='player');
  $('#tab-monster').classList.toggle('selected',pickerType==='monster');
  const body=$('#picker-content');body.replaceChildren();
  const current=currentBattle().cards[targetSlot];
  $('#remove-card').hidden=!current;
  if(pickerType==='monster'){
    const options=node('div',null,'monster-options');
    for(const monster of RAW_MONSTERS){
      const tile=button('',()=>{
        const cards=currentBattle().cards;const instance=makeInstance(monster);
        if(targetSlot<cards.length)cards[targetSlot]=instance;else cards.push(instance);
        $('#card-picker').close();announce(monster.name+' added. Save the battle name when ready.');render();
      },'monster-choice');
      tile.append(cardFace(makeInstance(monster),{mode:'library'}));
      options.append(tile);
    }
    body.append(options);
    body.append(node('p','Only source-verified cards appear here. Additional monsters will be imported as their mechanics are supported.','helper'));
  } else {
    const form=node('form',null,'player-form');form.noValidate=true;
    const name=node('input');name.placeholder='Player name';name.maxLength=80;name.required=true;name.value=current?.kind==='player'?current.name:'';
    const ac=node('input');ac.type='number';ac.min='1';ac.max='99';ac.placeholder='AC';ac.required=true;ac.value=current?.kind==='player'?current.ac:15;
    const dex=node('input');dex.type='number';dex.min='-20';dex.max='30';dex.placeholder='DEX / initiative bonus';dex.required=true;dex.value=current?.kind==='player'?current.dexModifier:0;
    const labelled=(text,input)=>{const wrap=node('label',text);wrap.append(input);return wrap;};
    form.append(labelled('Character name',name),labelled('Armor Class',ac),labelled('DEX modifier',dex));
    const add=node('button','Add Player Card','action');add.type='submit';form.append(add);
    form.addEventListener('submit',e=>{
      e.preventDefault();
      if(!name.value.trim()||!ac.checkValidity()||!dex.checkValidity())return;
      const instance=makePlayer(name.value.trim(),Number(ac.value),Number(dex.value));
      const cards=currentBattle().cards;if(targetSlot<cards.length)cards[targetSlot]=instance;else cards.push(instance);
      $('#card-picker').close();announce('Player card added.');render();
    });
    body.append(form);
  }
}
/** Player-safe projection: intentionally no monster AC, HP, source stats or DM options. */
function renderPhone(fighter) {
  const panel=$('#public-result');panel.replaceChildren();
  if(!fighter){panel.append(node('span','Waiting for Battle','helper'));return;}
  const heading=node('div',null,'phone-view-heading');
  heading.append(node('span','IRON LANTERN · ROUND '+round,'eyebrow'),node('h3',fighter.name));
  const portrait=node('div',null,'phone-view-portrait');
  if(fighter.portrait) {
    const img=node('img');img.src=fighter.portrait;img.alt='';portrait.append(img);
  } else portrait.append(silhouetteFor(fighter.sourceId||fighter.kind));
  panel.append(heading,portrait);
  if(currentResult?.actorId===fighter.id){
    const result=currentResult;
    panel.append(node('p',result.attackName.toUpperCase(),'phone-attack-name'));
    panel.append(node('span','TO HIT','phone-field-label'),node('strong',String(result.total),'phone-hit-number'));
    if(result.critical||result.fumble)panel.append(node('span',result.critical?'NATURAL 20':'NATURAL 1','phone-natural'));
    panel.append(node('span','DAMAGE · '+result.damageType.toUpperCase(),'phone-field-label'),node('strong',String(result.damage),'phone-damage-number'));
  } else if(fighter.kind==='player') {
    panel.append(node('p','PLAYER TURN','phone-attack-name'),node('span','INITIATIVE '+fighter.initiative,'phone-field-label'));
  } else {
    panel.append(node('p','MONSTER TURN','phone-attack-name'),node('span','INITIATIVE '+fighter.initiative,'phone-field-label'));
  }
}
function renderCombat(){
  const holder=$('#turn-card'), actions=$('#combat-actions');holder.replaceChildren();actions.replaceChildren();
  const fighter=turnOrder[turnIndex];$('#next-turn').disabled=!fighter;
  $('#round-chip').textContent=fighter?'ROUND '+round:'NOT STARTED';
  if(!fighter){holder.append(node('div','Click Battle to roll initiative and begin.','empty-state'));renderPhone(null);return;}
  const card=node('article',null,'active-combat-card');
  card.append(node('span',fighter.kind==='monster'?'MONSTER TURN':'PLAYER TURN','eyebrow'));
  card.append(cardFace(fighter,{mode:'combat',initiative:fighter.initiative}));
  holder.append(card);
  if(fighter.kind==='player'){
    actions.append(node('p','Player takes their own turn. Press Next Turn when finished.','helper'));
  } else {
    const source=MONSTER_BY_ID.get(fighter.sourceId);
    const attack=source?.attacks.find(a=>a.id===fighter.preparedAttackId)??source?.attacks[0];
    const selector=node('select');selector.setAttribute('aria-label','Prepare monster attack');
    for(const a of source?.attacks||[]){const opt=node('option',a.name+' · +'+a.bonus+' · '+a.dice.join('d')+'+'+a.modifier);opt.value=a.id;selector.append(opt);}
    if(attack)selector.value=attack.id;
    selector.addEventListener('change',()=>{fighter.preparedAttackId=selector.value;renderCombat();});
    actions.append(node('label','Selected attack'),selector);
    const targets=turnOrder.filter(c=>c.kind==='player');
    const targetSelect=node('select');targetSelect.setAttribute('aria-label','Attack target');
    for(const t of targets){const opt=node('option',t.name+' · AC '+t.ac);opt.value=t.id;targetSelect.append(opt);}
    if(!targets.length||!attack)actions.append(node('p','A verified monster attack and a player target are required.','helper'));
    else{
      actions.append(node('label','Target player'),targetSelect);
      const modes=node('div',null,'roll-buttons');
      for(const [mode,label] of [['normal','ROLL'],['advantage','ADV'],['disadvantage','DIS']]){
        modes.append(button(label,()=>{
          const chosen=source.attacks.find(a=>a.id===selector.value);
          const target=targets.find(t=>t.id===targetSelect.value);
          if(!chosen||!target)return;
          currentResult={actorId:fighter.id,...rollAttack(fighter,chosen,target,mode)};
          renderCombat();pushFrame().catch(e=>cloudStatus('Sync failed: '+e.message));
        },'action'));
      }
      actions.append(modes);
    }
    if(currentResult?.actorId===fighter.id){
      const r=currentResult;
      const result=node('div',null,'roll-result'+(r.critical?' critical':''));
      result.append(node('strong','TO HIT '+r.total),node('p',r.attackName+' vs '+r.target+' · d20 '+r.dice.join('/')+' + bonus = '+r.total));
      result.append(node('b',r.damage+' '+r.damageType+' damage'));
      if(r.critical||r.fumble)result.append(node('small',r.critical?'NATURAL 20':'NATURAL 1'));
      actions.append(result);
    }
  }
  renderPhone(fighter);
}
$('#tab-player').addEventListener('click',()=>{pickerType='player';renderPicker();});
$('#tab-monster').addEventListener('click',()=>{pickerType='monster';renderPicker();});
$('#remove-card').addEventListener('click',()=>{
  currentBattle().cards.splice(targetSlot,1);
  $('#card-picker').close();announce('Card removed');render();
});
$('#new-battle').addEventListener('click',()=>{
  const id='battle-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  battles.push({id,name:'Combat '+(battles.length+1),cards:[]});selectedId=id;turnOrder=[];announce('New empty battle created');render();
});
$('#save-battle').addEventListener('click',()=>{
  const name=$('#battle-name').value.trim();if(!name)return;
  currentBattle().name=name;announce('Saved in this preview session only — cloud storage is not connected.');render();
});
$('#start-battle').addEventListener('click',()=>{
  turnOrder=rollInitiative(currentBattle().cards);
  turnIndex=0;round=1;currentResult=null;announce('Initiative rolled.');render();pushFrame().catch(e=>cloudStatus('Sync failed: '+e.message));
});
$('#next-turn').addEventListener('click',()=>{
  if(!turnOrder.length)return;
  turnIndex++;if(turnIndex>=turnOrder.length){turnIndex=0;round++;}
  currentResult=null;renderCombat();pushFrame().catch(e=>cloudStatus('Sync failed: '+e.message));
});
$('#cloud-login-form').addEventListener('submit',async e=>{
 e.preventDefault();try{await signIn($('#cloud-email').value,$('#cloud-password').value);
 $('#cloud-password').value='';updateAuth();cloudStatus('Authenticated. Create a private cloud battle to enable phone updates.');
 }catch(error){cloudStatus('Sign-in failed: '+error.message);}
});
$('#cloud-logout').addEventListener('click',()=>{signOut();cloudSessionId=null;updateAuth();cloudStatus('Signed out');});
$('#cloud-create').addEventListener('click',async()=>{
 try{const session=await createSession(currentBattle().name);
 cloudSessionId=session.id;cloudRevision=0;
 await savePrivateState(cloudSessionId,{cards:currentBattle().cards},currentBattle().name);
 await pushFrame();cloudStatus('Private battle created; authorize your display account for this session.');
 }catch(e){cloudStatus('Cloud creation failed: '+e.message);}
});
$('#cloud-save').addEventListener('click',async()=>{
 if(!cloudSessionId){cloudStatus('Create a private cloud battle first');return;}
 try{await savePrivateState(cloudSessionId,{cards:currentBattle().cards},currentBattle().name);
 await pushFrame();cloudStatus('Private battle saved');
 }catch(e){cloudStatus('Cloud save failed: '+e.message);}
});
updateAuth();
render();
