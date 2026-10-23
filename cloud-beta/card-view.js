/** One visual card language for library, encounter slots, and live combat. */
import { MONSTER_BY_ID } from './cards.js';
const elem=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const pair=(key,value)=>{const e=elem('div','character-stat');e.append(elem('span','stat-label',key),elem('strong','stat-value',value));return e;};
export function cardFace(instance,{mode='slot',initiative=null}={}){
  const source=instance.kind==='monster'?MONSTER_BY_ID.get(instance.sourceId):null;
  const wrap=elem('div','character-face card-'+mode+' '+(instance.kind==='monster'?'monster-face':'player-face'));
  const art=elem('div','character-portrait');
  if(instance.portrait){
    const img=elem('img');img.src=instance.portrait;img.alt='';img.loading='lazy';art.append(img);
  } else art.append(elem('span','portrait-placeholder',instance.kind==='monster'?'⚔':'♟'));
  wrap.append(art);
  const content=elem('div','character-details');
  content.append(elem('span','character-type',instance.kind==='monster'?'MONSTER · '+(source?.ruleset||'UNVERIFIED'):'PLAYER'));
  content.append(elem('strong','character-name',instance.name));
  const stats=elem('div','character-stat-grid');
  stats.append(pair('AC',instance.ac??'—'));
  if(instance.hpMax!=null)stats.append(pair('HP',instance.hpCurrent+' / '+instance.hpMax));
  stats.append(pair('DEX',(instance.dexModifier>=0?'+':'')+instance.dexModifier));
  if(initiative!=null)stats.append(pair('INIT',initiative));
  content.append(stats);
  if(source && mode!=='slot'){
    const attacks=elem('div','character-attacks');
    attacks.append(elem('span','stat-label','ATTACKS'));
    for(const a of source.attacks){
      attacks.append(elem('p','attack-entry',a.name+'  +'+a.bonus+' · '+a.dice[0]+'d'+a.dice[1]+(a.modifier>=0?'+':'')+a.modifier+' '+a.damageType));
    }
    content.append(attacks);
    content.append(elem('small','card-source',source.source));
  } else if(instance.kind==='player' && mode==='combat'){
    content.append(elem('p','player-turn-note','Player controls their turn. DM advances with Next Turn.'));
  }
  wrap.append(content);
  return wrap;
}
