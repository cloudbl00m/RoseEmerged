export const samples = [
  ['bubbles','Bubbles',100], ['voice-ledger','Voice Ledger',65], ['modesty-filter','Modesty Filter',30]
].map(([id,title,completion]) => ({ id:'sample-'+id,title,type:'Software project',description:'Illustrative development sample.',thumbnail:'/assets/'+id+'.webp',url:'',completion,published:true,sample:true }));

const json = (value,status=200,headers={}) => Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
export const defaultTeam = [
  {id:'akai',name:'Akai',bio:'',skills:[]},
  {id:'hoor',name:'Hoor',bio:'',skills:[]}
];
function teamData(value) {
  if(!Array.isArray(value)) return value;
  const unique=new Map(value.flatMap(member=>member.skills||[]).map(tag=>[tag.toLowerCase(),tag]));
  return {members:(value.length ? value : defaultTeam).map(({skills,...member})=>member),skills:[...unique.values()]};
}
function skillTags(value,limit=24) {
  if(!Array.isArray(value) || value.length>limit) fail('Use up to '+limit+' skill tags.');
  for(const tag of value) {
    if(typeof tag!=='string' || !tag.trim()) fail('Skill tags cannot be empty.');
    if(tag.trim().length>120) fail('The tag “'+tag.trim().slice(0,45)+'…” is too long. Use up to 120 characters per tag.');
  }
  const unique=new Map(value.map(tag=>[tag.trim().toLowerCase(),tag.trim()]));
  return [...unique.values()];
}
function projectFields(input) {
  const fields = {};
  for (const [key,max] of Object.entries({title:160,type:100,description:2000,url:2048,thumbnail:2048})) {
    const value = input[key] ?? '';
    if(typeof value !== 'string' || value.trim().length>max) fail('Invalid '+key+'.');
    fields[key]=value.trim();
  }
  if(!fields.title || !fields.type) fail('A title and project type are required.');
  for (const key of ['url','thumbnail']) if(fields[key]) {
    if(key==='thumbnail' && new RegExp('^/media/[a-f0-9-]{36}[.](png|jpg|webp)$').test(fields[key])) continue;
    if(key==='thumbnail' && samples.some(p=>p.thumbnail===fields[key])) continue;
    try { if(!['https:','http:'].includes(new URL(fields[key]).protocol)) throw Error(); }
    catch { fail('Enter a full HTTP or HTTPS '+key+' URL.'); }
  }
  if(!Number.isInteger(input.completion) || input.completion<0 || input.completion>100) fail('Completion must be an integer from 0 to 100.');
  if(typeof input.published!=='boolean') fail('Choose a publication status.');
  return {...fields,completion:input.completion,published:input.published,...(input.skills===undefined?{}:{skills:skillTags(input.skills)})};
}
export async function handle(req,services) {
  try {
    const path=new URL(req.url).pathname;
    const method=req.method;
    if(method==='GET' && /^\/media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path)) {
      const projects=(await services.store.read()).rows;
      const publicImage=projects.some(project=>project.published && project.thumbnail===path);
      if(!publicImage && !await services.authorized(req)) fail('Image not found.',404);
      const image=await services.uploads?.get(path.slice(7));
      if(!image) fail('Image not found.',404);
      return new Response(image.bytes,{headers:{'Content-Type':image.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
    }
    if(method==='GET') {
      if(path==='/api/team') { const team=services.teamStore ? (await services.teamStore.read()).rows : []; return json({skills:teamData(team).skills}); }
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
    if(path==='/api/admin/uploads' && method==='POST') {
      if(!services.uploads) fail('Image storage is unavailable.',503);
      const bytes=new Uint8Array(await req.arrayBuffer());
      if(!bytes.length || bytes.length>5*1024*1024) fail('Choose an image up to 5 MB.',413);
      const starts=(values,offset=0)=>values.every((value,index)=>bytes[offset+index]===value);
      let type,extension;
      if(starts([137,80,78,71,13,10,26,10])) {type='image/png';extension='png';}
      else if(starts([255,216,255])) {type='image/jpeg';extension='jpg';}
      else if(starts([82,73,70,70]) && starts([87,69,66,80],8)) {type='image/webp';extension='webp';}
      else fail('Choose a PNG, JPEG, or WebP image.');
      if(req.headers.get('content-type')?.split(';')[0]!==type) fail('Image contents do not match its format.');
      const id=crypto.randomUUID()+'.'+extension;
      await services.uploads.put(id,bytes,type);
      return json({url:'/media/'+id},201);
    }
    if(path==='/api/admin/team') {
      if(!services.teamStore) fail('Team storage is unavailable.',503);
      const state=await services.teamStore.read();
      if(method==='GET') return json(teamData(state.rows));
      if(method!=='PUT') fail('Operation not supported.',405);
      const input=await body();
      if(!Array.isArray(input.members) || input.members.length!==2) fail('Both team profiles are required.');
      const members=defaultTeam.map(person=>{
        const member=input.members.find(item=>item?.id===person.id);
        if(!member || typeof member.bio!=='string' || member.bio.trim().length>1000) fail('Enter a bio up to 1000 characters for each person.');
        return {id:person.id,name:person.name,bio:member.bio.trim()};
      });
      const skills=input.skills===undefined ? teamData(state.rows).skills : skillTags(input.skills,48);
      const team={members,skills};
      if(!await services.teamStore.write(team,state.version)) fail('Another gardener saved a change. Reload and try again.',409);
      return json(team);
    }
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


