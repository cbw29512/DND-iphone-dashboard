import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameStore} from './local-push-core.mjs';
test('no messages until DM publishes; one event per update',()=>{
 const store=createFrameStore(),events=[];
 const unsub=store.subscribe('demo',e=>events.push(e));
 assert.equal(events.length,0);
 store.publish('demo',{name:'Goblin',action:{total:19,damage:6}});
 assert.equal(events.length,1);
 store.publish('demo',{name:'Goblin',action:{total:21,damage:4}});
 assert.equal(events.length,2);
 unsub();store.publish('demo',{name:'Wizard'});assert.equal(events.length,2);
});
test('reconnect gets latest state exactly once',()=>{
 const store=createFrameStore();
 store.publish('demo',{name:'Goblin',action:{total:19,damage:6}});
 store.publish('demo',{name:'Fighter',action:null});
 const output=[];store.subscribe('demo',e=>output.push(e));
 assert.equal(output.length,1);assert.equal(output[0].revision,2);
 assert.equal(output[0].frame.name,'Fighter');
});
test('payloads and subscribers cannot mutate retained latest frame',()=>{
 const store=createFrameStore();const input={name:'Goblin',action:{damage:4}};
 store.publish('demo',input);input.action.damage=99;
 store.subscribe('demo',e=>{e.frame.action.damage=88;});
 let result;store.subscribe('demo',e=>{result=e;});
 assert.equal(result.frame.action.damage,4);
});
