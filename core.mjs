export const samples = [
  ['bubbles','Bubbles',100], ['voice-ledger','Voice Ledger',65], ['modesty-filter','Modesty Filter',30]
].map(([id,title,completion]) => ({ id:'sample-'+id,title,type:'Software project',description:'Illustrative development sample.',thumbnail:'/assets/'+id+'.webp',url:'',completion,published:true,sample:true }));

const json = (value,status=200,headers={}) => Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
function projectFields(input) {
  const fields = {};
  for (const [key,max] of Object.entries({title:160,type:100,description:2000,url:2048,thumbnail:2048})) {
    const value = input[key] ?? '';
    if(typeof value !== 'string' || value.trim().length>max) fail('Invalid '+key+'.');
    fields[key]=value.trim();
  }
  if(!fields.title || !fields.type) fail('A title and project type are required.');
  for (const key of ['url','thumbnail']) if(fields[key]) {
    if(key==='thumbnail' && samples.some(p=>p.thumbnail===fields[key])) continue;
    try { if(!['https:','http:'].includes(new URL(fields[key]).protocol)) throw Error(); }
    catch { fail('Enter a full HTTP or HTTPS '+key+' URL.'); }
  }
  if(!Number.isInteger(input.completion) || input.completion<0 || input.completion>100) fail('Completion must be an integer from 0 to 100.');
  if(typeof input.published!=='boolean') fail('Choose a publication status.');
  return {...fields,completion:input.completion,published:input.published};
}
export async function handle(req,services) {
  try {
    const path=new URL(req.url).pathname;
    const method=req.method;
    if(method==='GET') {
      if(path==='/api/auth-mode') return json({mode:services.mode});
      if(path==='/api/demo-projects') return json(samples);
      if(path==='/api/projects') return json((await services.store.read()).rows.filter(p=>p.published));
    } else {
      const origin=req.headers.get('origin');
      if(origin && origin!==new URL(req.url).origin) fail('Cross-origin request rejected.',403);
    }
    async function body() {
      if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail('Expected JSON.',415);
      const raw=await req.text();
      if(raw.length>100000) fail('Request too large.',413);
      try { const value=JSON.parse(raw); if(!value || Array.isArray(value) || typeof value!=='object') throw Error(); return value; }
      catch { fail('Invalid JSON.'); }
    }
    if(path==='/api/login' && method==='POST' && services.login) return services.login(await body(),req);
    if(path==='/api/logout' && method==='POST' && services.logout) return services.logout(req);
    if(!path.startsWith('/api/admin/')) fail('Not found.',404);
    if(!await services.authorized(req)) fail('An authorized gardener account is required.',401);
    const {rows,version}=await services.store.read();
    const list=path==='/api/admin/projects';
    if(list && method==='GET') return json(rows);
    const index=rows.findIndex(p=>path==='/api/admin/projects/'+p.id);
    let result={ok:true};
    if(list && method==='POST') {
      result={...projectFields(await body()),id:crypto.randomUUID(),sample:false};
      rows.push(result);
    } else if(path==='/api/admin/order' && method==='POST') {
      const {ids}=await body();
      if(!Array.isArray(ids) || ids.length!==rows.length || new Set(ids).size!==ids.length) fail('Project list changed. Reload and try again.',409);
      const byId=new Map(rows.map(p=>[p.id,p]));
      const ordered=ids.map(id=>byId.get(id));
      if(ordered.includes(undefined)) fail('Project list changed. Reload and try again.',409);
      rows.splice(0,rows.length,...ordered);
    } else if(index>=0 && method==='PUT') {
      result={...rows[index],...projectFields(await body())};
      rows[index]=result;
    } else if(index>=0 && method==='DELETE') rows.splice(index,1);
    else fail('Project or operation not found.',404);
    if(!await services.store.write(rows,version)) fail('Another gardener saved a change. Reload and try again.',409);
    return json(result,list && method==='POST'?201:200);
  } catch(error) {
    return json({error:error.status?error.message:'The garden service could not complete the request.'},error.status||500);
  }
}

