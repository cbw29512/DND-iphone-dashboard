import test from 'node:test';
import assert from 'node:assert/strict';
import {RAW_MONSTERS,makeInstance,makePlayer,rollInitiative,rollAttack} from './cards.js';
test('immutable verified goblin source stays separate from battle instance',()=>{
  const source=RAW_MONSTERS[0],instance=makeInstance(source);
  instance.hpCurrent=1;
  assert.equal(source.hp,7);
  assert.equal(source.ac,15);
  assert.equal(source.attacks.length,2);
});
test('two goblins share initiative roll but players roll independently',()=>{
  const goblin=RAW_MONSTERS[0];
  const cards=[makeInstance(goblin),makeInstance(goblin),makePlayer('Fighter',18,1)];
  const ordered=rollInitiative(cards,()=>0.5);
  const g=ordered.filter(x=>x.kind==='monster');
  assert.equal(g.length,2);
  assert.equal(g[0].initiative,g[1].initiative);
  assert.equal(new Set(ordered.map(x=>x.id)).size,3);
});
test('natural one always misses regardless of bonus',()=>{
 const monster=makeInstance(RAW_MONSTERS[0]);
 const result=rollAttack(monster,RAW_MONSTERS[0].attacks[0],makePlayer('Fighter',1,1),'normal',()=>0);
 assert.equal(result.natural,1);
 assert.equal(result.fumble,true);
 assert.equal(result.total,5);
 assert.equal(result.damageDice.length,1);
});
test('natural twenty rolls double damage dice',()=>{
 const monster=makeInstance(RAW_MONSTERS[0]);
 const result=rollAttack(monster,RAW_MONSTERS[0].attacks[0],makePlayer('Fighter',99,1),'normal',()=>0.999);
 assert.equal(result.natural,20);
 assert.equal(result.critical,true);
 assert.equal(result.damageDice.length,2);
 assert.equal(result.damage,14);
});

test('attack total and damage do not depend on the player's AC',()=>{
 const monster=makeInstance(RAW_MONSTERS[0]), attack=RAW_MONSTERS[0].attacks[0];
 const low=rollAttack(monster,attack,makePlayer('A',10,0),'normal',()=>0.5);
 const high=rollAttack(monster,attack,makePlayer('B',30,0),'normal',()=>0.5);
 assert.equal(low.total,high.total);
 assert.equal(low.damage,high.damage);
 assert.equal(low.damageType,'slashing');
});
