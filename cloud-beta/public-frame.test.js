import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPublicFrame} from './public-frame.js';
test('phone frame does not contain hidden monster HP AC or internal action fields',()=>{
 const monster={id:'m1',kind:'monster',name:'Goblin',sourceId:'srd2014:goblin',initiative:19,
  ac:15,hpCurrent:1,hpMax:7,attack_bonus:4,private_note:'secret'};
 const rolled={actorId:'m1',attackName:'Scimitar',total:17,damage:6,damageType:'slashing',
  critical:false,fumble:false,bonus:4,target_ac:20,private_spell_slots:[1,2]};
 const view=projectPublicFrame('Test',2,monster,rolled);
 assert.equal(view.name,'Goblin');
 assert.equal(view.action.total,17);assert.equal(view.action.damage,6);
 const serialized=JSON.stringify(view);
 for(const secret of ['hpCurrent','hpMax','ac','attack_bonus','private_note','private_spell_slots','target_ac','bonus'])
  assert.equal(Object.hasOwn(view,secret)||Object.hasOwn(view.action,secret),false,secret);
 assert.equal(serialized.includes('secret'),false);
});
test('old action clears when turn advances',()=>{
 const actor={id:'b',name:'Wizard',kind:'player',initiative:12,ac:13};
 const view=projectPublicFrame('Test',1,actor,{actorId:'a',attackName:'Scimitar',total:16,damage:4});
 assert.equal(view.action,null);
});
