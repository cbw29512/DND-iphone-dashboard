import test from 'node:test';
import assert from 'node:assert/strict';
import {RAW_MONSTERS,makeInstance,makePlayer} from './cards.js';
import {applyMonsterHp} from './combat-state.js';
test('monster HP remains battle-only; no original RAW card mutation',()=>{
 const source=RAW_MONSTERS[0],instance=makeInstance(source);
 assert.equal(applyMonsterHp(instance,-3),4);
 assert.equal(source.hp,7);
 assert.equal(applyMonsterHp(instance,-15),0);
 assert.equal(applyMonsterHp(instance,100),7);
});
test('player HP is never adjusted by monster controls',()=>{
 assert.throws(()=>applyMonsterHp(makePlayer('Fighter',18,1),-2));
});
