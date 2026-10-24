/** Minimal same-origin-independent Supabase client: no secrets and no anonymous data access.
 * Store tokens only in tab session storage; phones must sign in again after a closed session.
 * This is a beta transport, not an audited production authentication implementation.
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './cloud-config.js';
const root=String(SUPABASE_URL||'').replace(/\/$/,'');
const key=SUPABASE_PUBLISHABLE_KEY;
const storageKey='iron-lantern-beta-auth';
let credentials=null;
try {credentials=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{credentials=null;}
export const configured=()=>root.startsWith('https://') && Boolean(key);
export const currentUser=()=>credentials?.user||null;
export const signOut=()=>{credentials=null;sessionStorage.removeItem(storageKey);};
async function send(path,{method='GET',data,auth=true,headers={}}={}){
 if(!configured())throw Error('Cloud service not configured yet');
 const response=await fetch(root+path,{method,headers:{apikey:key,'Content-Type':'application/json',
 ...(auth?{Authorization:'Bearer '+(credentials?.access_token||'')}:{}),...headers},
 body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 const text=await response.text();let result=null;
 try{result=text?JSON.parse(text):null;}catch{result=text;}
 if(!response.ok)throw Error(result?.message||result?.msg||result?.error_description||result?.error||('HTTP '+response.status));
 return result;
}
export async function signIn(email,password){
 const result=await send('/auth/v1/token?grant_type=password',{method:'POST',auth:false,data:{email,password}});
 credentials=result;sessionStorage.setItem(storageKey,JSON.stringify(credentials));
 return result.user;
}
async function refreshSession(){
 if(!credentials?.refresh_token)throw Error('Sign in required');
 const result=await send('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,data:{refresh_token:credentials.refresh_token}});
 credentials=result;sessionStorage.setItem(storageKey,JSON.stringify(credentials));
}
export async function db(path,opts={}){
 if(!credentials?.access_token)throw Error('Sign in required');
 try{return await send('/rest/v1/'+path,opts);}
 catch(e){
  if(!/HTTP 401|JWT expired|token is expired|invalid JWT/i.test(e.message))throw e;
  await refreshSession();return send('/rest/v1/'+path,opts);
 }
}
export async function createSession(name){
 const list=await db('il_sessions',{method:'POST',headers:{Prefer:'return=representation'},data:{name,owner_id:currentUser().id}});
 return list?.[0];
}
export async function savePrivateState(id,privateState,name){
 return db('il_sessions?id=eq.'+encodeURIComponent(id),{method:'PATCH',data:{name,private_state:privateState,updated_at:new Date().toISOString()}});
}
export async function publishDisplayFrame(id,publicState,revision){
 return db('il_display_frames?on_conflict=session_id',{method:'POST',
 headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
 data:{session_id:id,owner_id:currentUser().id,revision,public_state:publicState,updated_at:new Date().toISOString()}});
}
export async function readPublicFrames(){
 return db('il_display_frames?select=session_id,revision,public_state,updated_at&order=updated_at.desc&limit=30');
}
export async function readMySessions(){
 return db('il_sessions?select=id,name,private_state,updated_at&order=updated_at.desc&limit=30');
}
