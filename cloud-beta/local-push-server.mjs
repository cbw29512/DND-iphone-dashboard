/** Development ONLY. Run on laptop with Node 22+; never deploy as a Netlify Function.
 * Provides a DM-authenticated push endpoint and a display-only SSE connection.
 * Two distinct secrets. They are supplied via environment variables.
 */
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createFrameStore} from './local-push-core.mjs';
const host=process.env.IRON_LANTERN_HOST||'127.0.0.1';
const port=Number(process.env.IRON_LANTERN_PORT||8787);
const dmKey=process.env.IRON_LANTERN_DM_KEY;
const phoneKey=process.env.IRON_LANTERN_PHONE_KEY;
if(!dmKey||!phoneKey||dmKey===phoneKey||dmKey.length<24||phoneKey.length<24)
 throw Error('Set two different IRON_LANTERN_DM_KEY and IRON_LANTERN_PHONE_KEY secrets, each at least 24 characters.');
const store=createFrameStore();const root=resolve(import.meta.dirname);
const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const auth=(req,key)=>{
 const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
 const a=Buffer.from(provided),b=Buffer.from(key);
 return a.length===b.length&&timingSafeEqual(a,b);
};
function reply(res,code,obj){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/local-api/frame'&&req.method==='POST'){
   if(!auth(req,dmKey))return reply(res,401,{error:'unauthorized'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)return reply(res,413,{error:'too large'});}
   let body;try{body=JSON.parse(raw);}catch{return reply(res,400,{error:'invalid JSON'});}
   if(body?.session!=='demo'||!body?.frame||typeof body.frame!=='object')return reply(res,400,{error:'invalid frame'});
   // Strict allowlist: accept only known public fields, never raw monster cards.
   const f=body.frame;
   const frame={
    battleName:String(f.battleName||'Battle').slice(0,80),round:Number(f.round)||1,
    name:f.name==null?null:String(f.name).slice(0,80),
    kind:f.kind==='monster'?'monster':f.kind==='player'?'player':null,
    sourceId:f.sourceId==='srd2014:goblin'?'srd2014:goblin':null,
    initiative:Number.isFinite(f.initiative)?f.initiative:null,
    action:f.action?.type==='attack'?{
     type:'attack',name:String(f.action.name||'').slice(0,80),
     total:Number(f.action.total),damage:Number(f.action.damage),
     damageType:String(f.action.damageType||'').slice(0,40),
     critical:!!f.action.critical,fumble:!!f.action.fumble
    }:null
   };
   if(frame.action&&(!Number.isFinite(frame.action.total)||!Number.isFinite(frame.action.damage)))
    return reply(res,400,{error:'invalid attack'});
   return reply(res,200,store.publish('demo',frame));
  }
  if(url.pathname==='/local-api/events'&&req.method==='GET'){
   // EventSource cannot set Authorization headers: use an in-memory display token in URL.
   // Strictly local dev only; no logs/cache; do not use this design in production.
   if(url.searchParams.get('displayKey')!==phoneKey)return reply(res,401,{error:'unauthorized'});
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
   const unsubscribe=store.subscribe('demo',event=>res.write('id: '+event.revision+'\ndata: '+JSON.stringify(event)+'\n\n'));
   req.on('close',unsubscribe);
   return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'method not allowed'});
  const name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
  const target=resolve(root,'.'+name);
  if(target!==root&&!target.startsWith(root+sep))return reply(res,403,{error:'forbidden'});
  if(!Object.hasOwn(type,extname(target)))return reply(res,404,{error:'not found'});
  let data;try{data=await readFile(target);}catch{return reply(res,404,{error:'not found'});}
  res.writeHead(200,{'Content-Type':type[extname(target)],'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch(e){reply(res,500,{error:'server error'});}
});
server.listen(port,host,()=>console.log('Iron Lantern local push test listening on http://'+host+':'+port));
