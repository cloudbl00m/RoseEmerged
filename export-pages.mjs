import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile,rename,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const database=join(resolve(process.env.ROSE_DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url))),'garden.sqlite');
await access(database).catch(()=>{throw Error('Save your projects locally first. The real database was not found.');});
const db=new DatabaseSync(database,{readOnly:true});
db.exec('BEGIN');
try {
  const rows=JSON.parse(db.prepare('SELECT rows FROM garden WHERE id=1').get()?.rows||'[]');
  const projects=rows.filter(p=>p.published).map(({id,title,type,description,url,thumbnail,completion,skills})=>({id,title,type,description,url,thumbnail,completion,skills:skills||[],published:true}));
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name);
  const team=tables.includes('team')?JSON.parse(db.prepare('SELECT rows FROM team WHERE id=1').get()?.rows||'[]'):[];
  const tags=Array.isArray(team)?team.flatMap(member=>member.skills||[]):team.skills||[];
  const skills=[...new Map(tags.map(tag=>[tag.toLowerCase(),tag])).values()];
  const uploads={};
  for(const project of projects) {
    if(!project.thumbnail?.startsWith('/media/')) continue;
    const id=project.thumbnail.slice(7);
    if(!/^[a-f0-9-]{36}[.](png|jpg|webp)$/.test(id)) throw Error('Invalid image ID.');
    const image=db.prepare('SELECT type,bytes FROM uploads WHERE id=?').get(id);
    if(!image) throw Error('Missing image for '+project.title);
    uploads[id]={base64:Buffer.from(image.bytes).toString('base64')};
  }
  await mkdir('site-content',{recursive:true});
  await writeFile('site-content/published.json.tmp',JSON.stringify({projects,team:{skills},uploads},null,2)+'\n');
  await rename('site-content/published.json.tmp','site-content/published.json');
  console.log('Exported '+projects.length+' published projects and '+skills.length+' shared skills.');
} finally {db.exec('ROLLBACK');db.close();}
