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
  const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG8sAAAAASUVORK5CYII=','base64');
  const upload=cookie=>fetch(origin+'/api/admin/uploads',{method:'POST',headers:{'content-type':'image/png',cookie:cookie||''},body:picture});
  assert.equal((await upload()).status,401);
  const uploaded=await upload(akai);assert.equal(uploaded.status,201);
  const imageUrl=(await uploaded.json()).url;
  assert.equal((await api(imageUrl)).status,404);
  assert.equal((await api(imageUrl,'GET',undefined,hoor)).status,200);
  const invalid=await fetch(origin+'/api/admin/uploads',{method:'POST',headers:{'content-type':'image/png',cookie:akai},body:'not an image'});
  assert.equal(invalid.status,400);

  assert.equal((await api('/api/admin/team')).status,401);
  assert.equal((await api('/api/admin/team','PUT',{members:[]},akai)).status,400);
  const members=[
    {id:'akai',bio:'Builds thoughtful tools.',skills:['React','UI design','React']},
    {id:'hoor',bio:'Makes ideas tangible.',skills:['Python','Research']}
  ];
  assert.equal((await api('/api/admin/team','PUT',{members,skills:['React','UI design','React','Python','Research']},akai)).status,200);
  const publicTeam=await (await api('/api/team')).json();
  assert.deepEqual(publicTeam.skills,['React','UI design','Python','Research']);
  assert.equal((await (await api('/api/admin/team','GET',undefined,hoor)).json()).members[1].bio,members[1].bio);
  const longTag='cybersecurity ( OSCP certificate & CPTS certificate)';
  assert.equal((await api('/api/admin/team','PUT',{members,skills:[longTag]},akai)).status,200);
  assert.deepEqual((await (await api('/api/team')).json()).skills,[longTag]);
  assert.equal((await api('/api/admin/team','PUT',{members,skills:['x'.repeat(121)]},akai)).status,400);

  const draft={title:'Private test',thumbnail:imageUrl,type:'Tool',description:'Secret description',completion:0,published:false,skills:['JavaScript','Accessibility']};
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
  assert.equal((await edit({published:true})).status,200);assert.equal((await list()).length,4);assert.equal((await api(imageUrl)).status,200);assert.deepEqual((await list()).at(-1).skills,draft.skills);
  await edit({completion:60,published:true});assert.equal((await list()).at(-1).completion,60);
  const ids=(await list()).map(p=>p.id).reverse();
  assert.equal((await api('/api/admin/order','POST',{ids},akai)).status,200);assert.equal((await list())[0].id,id);
  assert.equal((await api('/api/admin/order','POST',{ids:[id]},akai)).status,409);
  await edit({published:false});assert.equal((await list()).length,3);assert.equal((await api(imageUrl)).status,404);
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

