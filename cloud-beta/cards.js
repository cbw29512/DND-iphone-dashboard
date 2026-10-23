/** Immutable RAW-card definitions; battle instances are separate objects. */
export const SOURCE_RULES = '2014';
export const RAW_MONSTERS = Object.freeze([
  Object.freeze({
    id: 'srd2014:goblin', kind: 'monster', name: 'Goblin',
    source: 'D&D 5e 2014 SRD', ruleset: '2014', verified: true,
    ac: 15, hp: 7, dexModifier: 2,
    attacks: Object.freeze([
      Object.freeze({ id: 'scimitar', name: 'Scimitar', bonus: 4, dice: [1,6], modifier: 2, damageType: 'slashing', attacksPerAction: 1 }),
      Object.freeze({ id: 'shortbow', name: 'Shortbow', bonus: 4, dice: [1,6], modifier: 2, damageType: 'piercing', attacksPerAction: 1 })
    ])
  })
]);
export const MONSTER_BY_ID = new Map(RAW_MONSTERS.map(card => [card.id, card]));
export const makeInstance = (card, extras={}) => ({
  id: globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random(),
  sourceId: card.id,
  kind: card.kind,
  name: extras.name || card.name,
  portrait: extras.portrait || null,
  ac: card.ac,
  hpMax: card.hp,
  hpCurrent: card.hp,
  dexModifier: card.dexModifier,
  initiativeAdvantage: false,
  preparedAttackId: card.attacks?.[0]?.id || null
});
export function makePlayer(name, ac, dexModifier) {
  return { id:globalThis.crypto?.randomUUID?.() || String(Date.now())+'-'+Math.random(),
    kind:'player', sourceId:null, name, ac, hpMax:null, hpCurrent:null, dexModifier,
    portrait:null, initiativeAdvantage:false, preparedAttackId:null };
}
export function rollD20(mode='normal', rng=Math.random) {
  const a = Math.floor(rng()*20)+1;
  const b = mode === 'normal' ? null : Math.floor(rng()*20)+1;
  return { natural: b === null ? a : mode === 'advantage' ? Math.max(a,b) : Math.min(a,b), dice: b === null ? [a] : [a,b] };
}
export function rollInitiative(instances, rng=Math.random) {
  const groups=new Map();
  const entries=instances.map((card,index)=>{
    const groupKey=card.kind==='monster' && card.sourceId ? card.sourceId : card.id;
    if (!groups.has(groupKey)) {
      const dice=rollD20(card.initiativeAdvantage ? 'advantage' : 'normal',rng);
      groups.set(groupKey,{...dice,total:dice.natural+card.dexModifier});
    }
    return {...card,initiative:groups.get(groupKey).total,initiativeDice:groups.get(groupKey).dice,originalIndex:index};
  });
  return entries.sort((a,b)=>b.initiative-a.initiative || a.originalIndex-b.originalIndex);
}
/** RAW attack total and independently rolled damage; target resolves changing AC.
 * Natural 1/20 flags retained without showing HIT/MISS on the public display.
 * Damage is a prospective roll, not applied automatically to player HP.
 */
export function rollAttack(attacker, attack, target=null, mode='normal',rng=Math.random) {
  const d20=rollD20(mode,rng), critical=d20.natural===20, fumble=d20.natural===1;
  const total=d20.natural+attack.bonus;
  const dice=Array.from({length:attack.dice[0]*(critical?2:1)},()=>Math.floor(rng()*attack.dice[1])+1);
  const damage=Math.max(0,dice.reduce((a,b)=>a+b,0)+attack.modifier);
  return {natural:d20.natural,dice:d20.dice,total,critical,fumble,
    damage,damageDice:dice,damageType:attack.damageType,attackName:attack.name,
    target:target?.name || null};
}
