import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLocalDmPush} from './local-push-client.js';
test('local DM sends a single POST for one deliberate action',async()=>{
 const previous=globalThis.fetch;const calls=[];
 globalThis.fetch=async (...args)=>{calls.push(args);return {ok:true,json:async()=>({revision:1})};};
 try{
  const push=makeLocalDmPush('DM-KEY');
  await push({name:'Goblin',action:{total:19,damage:6}});
  assert.equal(calls.length,1);
  assert.equal(calls[0][1].method,'POST');
  assert.equal(calls[0][1].headers.Authorization,'Bearer DM-KEY');
 }finally{globalThis.fetch=previous;}
});
