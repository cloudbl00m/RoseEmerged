import { adminAccounts } from './admins.mjs';
import http from 'node:http';
import { createHash,randomBytes,scrypt,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './local-db.mjs';
import { handle,samples } from './core.mjs';
const demo=process.argv.includes('--demo'), db=openDatabase(demo);
db.prepare('INSERT OR IGNORE INTO garden VALUES(1,0,?)').run(JSON.stringify(demo?samples:[]));
const store={
  read(){ const row=db.prepare('SELECT version,rows FROM garden WHERE id=1').get();return {...row,rows:JSON.parse(row.rows)}; },
  write(rows,version){ return db.prepare('UPDATE garden SET rows=?,version=version+1 WHERE id=1 AND version=?').run(JSON.stringify(rows),version).changes===1; }
};
const token=req=>createHash('sha256').update(req.headers.get('cookie')?.match(/(?:^|;\s*)rose=([a-f0-9]{64})(?:;|$)/)?.[1]||'').digest('hex');
const cookie=(value,age)=>'rose='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(process.env.ROSE_HTTPS==='1'?'; Secure':'');
const answer=(obj,status=200,headers={})=>Response.json(obj,{status,headers:{'Cache-Control':'no-store',...headers}});
const derive=promisify(scrypt);
const attempts=new Map();
const auth={
  mode:'password',store,
  authorized(req){ return !!db.prepare('SELECT 1 FROM sessions JOIN accounts USING(name) WHERE token=? AND expires>?').get(token(req),Date.now()); },
  async login({account,password},req){
    const name=adminAccounts.get(String(account).trim().toLowerCase()),now=Date.now();
    if(typeof password!=='string'||password.length>256||!name) return answer({error:'Invalid sign-in.'},401);
    const key=req.headers.get('x-local-peer')+':'+name;
    for(const [k,v] of attempts) if(v.until<=now) attempts.delete(k);
    const rate=attempts.get(key)||{count:0,until:now+600000};
    if(rate.count>=10) return answer({error:'Try again in ten minutes.'},429);
    rate.count++;attempts.set(key,rate);
    const row=db.prepare('SELECT salt,hash FROM accounts WHERE name=?').get(name);
    const hash=await derive(password,row?.salt||'unconfigured-gardener',64);
    if(!row || !timingSafeEqual(hash,Buffer.from(row.hash,'hex'))) return answer({error:'Invalid sign-in.'},401);
    attempts.delete(key);
    const value=randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(value).digest('hex'),name,now+8*3600000);
    return answer({ok:true},200,{'Set-Cookie':cookie(value,28800)});
  },
  logout(req){ db.prepare('DELETE FROM sessions WHERE token=?').run(token(req));return answer({ok:true},200,{'Set-Cookie':cookie('',0)}); }
};
const root=fileURLToPath(new URL('./public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer(async (input,out)=>{
  try {
    const url=new URL(input.url,'http://'+input.headers.host);
    let result;
    if(url.pathname.startsWith('/api/')) {
      const chunks=[];let bytes=0;
      for await(const c of input) { bytes+=c.length;if(bytes>100000){out.writeHead(413);out.end();return;} chunks.push(c); }
      const headers=new Headers(input.headers);
      headers.set('x-local-peer',input.socket.remoteAddress||'local');
      if(process.env.ROSE_HTTPS==='1') url.protocol='https:';
      const req=new Request(url,{method:input.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
      result=await handle(req,auth);
    } else {
      if(!['GET','HEAD'].includes(input.method)){out.writeHead(405);out.end();return;}
      const route=decodeURIComponent(url.pathname);
      const name=({'/':'index.html','/demo':'index.html','/admin':'admin.html','/admin/':'admin.html'})[route]||route.slice(1);
      const path=resolve(root,name);
      if(!path.startsWith(resolve(root)+sep)) throw Error();
      result=new Response(await readFile(path),{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}});
    }
    out.writeHead(result.status,Object.fromEntries(result.headers));
    out.end(input.method==='HEAD'?undefined:Buffer.from(await result.arrayBuffer()));
  } catch {out.writeHead(404);out.end('Not found');}
});
server.listen(Number(process.env.PORT||4317),process.env.HOST||'127.0.0.1',()=>console.log('RoseEmerged at http://'+server.address().address+':'+server.address().port+(demo?' (development samples)':'')));
