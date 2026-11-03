import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { scryptSync,randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../local-db.mjs';
import { hostedApi } from '../worker.mjs';
test('public garden and both authorized editors share a persistent project lifecycle',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'rose-test-'));process.env.ROSE_DATA_DIR=directory;
  const db=openDatabase(true);
  const pass=randomBytes(24).toString('hex');
  for(const account of ['akai','hoor']) {
    const salt=randomBytes(16).toString('hex');
    db.prepare('INSERT INTO accounts VALUES(?,?,?)').run(account,salt,scryptSync(pass,salt,64).toString('hex'));
  }
  db.close();
  const server=spawn(process.execPath,['server.mjs','--demo'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{server.kill();await once(server,'exit');await rm(directory,{recursive:true,force:true});});
  const [message]=await once(server.stdout,'data');const origin=message.toString().match(/http:\/\/[^ ]+/)[0].trim();
  const api=(path,method='GET',body,cookie)=>fetch(origin+path,{method,headers:{'content-type':'application/json',cookie:cookie||''},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await api('/')).status,200);assert.equal((await api('/admin')).status,200);
  for(const [path,method] of [['/api/admin/projects','GET'],['/api/admin/projects','POST'],['/api/admin/projects/example','PUT'],['/api/admin/projects/example','DELETE'],['/api/admin/order','POST']])
    assert.equal((await api(path,method)).status,401);
  assert.equal((await api('/api/login','POST',{account:'akai',password:'incorrect'})).status,401);
  const cookies=[];
  assert.equal((await api('/api/login','POST',{account:'outsider@example.com',password:pass})).status,401);
  assert.equal((await api('/api/login','POST',{account:'akai',password:pass})).status,401);
  for(const account of ['MOHAMMAD.AKAI21@gmail.com','hoorhkk@gmail.com']) {
    const response=await api('/api/login','POST',{account,password:pass});
    assert.equal(response.status,200);cookies.push(response.headers.get('set-cookie').split(';')[0]);
  }
  const [akai,hoor]=cookies;
  const draft={title:'Private test',type:'Tool',description:'Secret description',completion:0,published:false};
  const created=await api('/api/admin/projects','POST',draft,akai);
  assert.equal(created.status,201);const {id}=await created.json();
  const list=async()=>await (await api('/api/projects')).json();
  assert.deepEqual((await list()).map(p=>p.completion),[100,65,30]);
  assert(!(await (await api('/api/projects')).text()).includes('Secret description'));
  assert.equal((await api('/api/projects/'+id)).status,404);
  assert((await (await api('/api/admin/projects','GET',undefined,hoor)).json()).some(p=>p.id===id));
  const edit=async data=>api('/api/admin/projects/'+id,'PUT',{...draft,...data},hoor);
  assert.equal((await edit({url:'javascript:alert(1)'})).status,400);
  assert.equal((await edit({completion:101})).status,400);
  assert.equal((await edit({published:true})).status,200);assert.equal((await list()).length,4);
  await edit({completion:60,published:true});assert.equal((await list()).at(-1).completion,60);
  const ids=(await list()).map(p=>p.id).reverse();
  assert.equal((await api('/api/admin/order','POST',{ids},akai)).status,200);assert.equal((await list())[0].id,id);
  assert.equal((await api('/api/admin/order','POST',{ids:[id]},akai)).status,409);
  await edit({published:false});assert.equal((await list()).length,3);
  assert.equal((await api('/api/admin/projects/'+id,'DELETE',undefined,akai)).status,200);
  assert.equal((await api('/api/logout','POST',undefined,akai)).status,200);
  assert.equal((await api('/api/admin/projects','GET',undefined,akai)).status,401);
});
test('hosted admin requires a trusted identity with an allowlisted email',async()=>{
  const env={AKAI_EMAIL:'one@example.test',HOOR_EMAIL:'two@example.test',BUCKET:{get:async()=>null}};
  for(const [email,status] of [['outsider@example.test',401],['one@example.test',200],['two@example.test',200]]) {
    const request=new Request('https://site.test/api/admin/projects',{headers:{'oai-authenticated-user-id':'trusted','oai-authenticated-user-email':email}});
    assert.equal((await hostedApi(request,env)).status,status);
  }
});
