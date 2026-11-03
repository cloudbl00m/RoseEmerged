import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {samples} from './core.mjs';
const output=resolve('pages-dist');
const input=process.env.PAGES_BASE_PATH||'/';
const segments=input.split('/').filter(Boolean);
if(segments.some(part=>!(/^[a-zA-Z0-9_.-]+$/.test(part))||part==='..'||part==='.')) throw Error('Invalid PAGES_BASE_PATH.');
const base='/'+(segments.length?segments.join('/')+'/':'');
const data=JSON.parse(await readFile('site-content/published.json','utf8').catch(()=>{throw Error('Run npm run export:pages locally and commit site-content/published.json first.');}));
// This fixed build directory is the only directory removed by this script.
if(output!==join(process.cwd(),'pages-dist')) throw Error('Invalid output directory.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
async function copy(source,target) {
  await mkdir(target,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})) {
    if(['admin.html','admin.js','admin.css'].includes(entry.name)) continue;
    const from=join(source,entry.name),to=join(target,entry.name);
    if(entry.isDirectory()) {await copy(from,to);continue;}
    let bytes=await readFile(from);
    if(/\.(html|js|css)$/.test(entry.name)) {
      let text=bytes.toString().replaceAll('/assets/',base+'assets/');
      if(entry.name.endsWith('.html')) text=text.replace(/(href|src)="\/(?!\/)([^"]*)"/g,(_,attr,path)=>attr+'="'+base+path+'"');
      bytes=Buffer.from(text);
    }
    await writeFile(to,bytes);
  }
}
await copy('public',output);
await writeFile(join(output,'content-url.js'),`const base=${JSON.stringify(base)};
export function contentUrl(path) {
  const routes={'/api/projects':'content/projects.json','/api/team':'content/team.json','/api/demo-projects':'content/samples.json','/demo':'demo/'};
  if(routes[path]) return base+routes[path];
  if(path.startsWith('/media/')) return base+'content/uploads/'+path.slice(7);
  if(path.startsWith('/assets/')) return base+path.slice(1);
  return path;
}
`);
await mkdir(join(output,'content/uploads'),{recursive:true});
await writeFile(join(output,'content/projects.json'),JSON.stringify(data.projects));
await writeFile(join(output,'content/team.json'),JSON.stringify(data.team));
await writeFile(join(output,'content/samples.json'),JSON.stringify(samples.map(p=>({...p,thumbnail:base+p.thumbnail.slice(1)}))));
for(const [id,image] of Object.entries(data.uploads)) {
  if(!/^[a-f0-9-]{36}[.](png|jpg|webp)$/.test(id)) throw Error('Invalid upload ID.');
  await writeFile(join(output,'content/uploads',id),Buffer.from(image.base64,'base64'));
}
await mkdir(join(output,'demo'),{recursive:true});
await writeFile(join(output,'demo/index.html'),await readFile(join(output,'index.html')));
const admin='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Garden studio</title><body style="font:18px/1.7 system-ui;background:#f3f1e7;color:#263f3b;max-width:650px;margin:12vh auto;padding:24px"><h1>Garden studio</h1><p>Manage projects in your local RoseEmerged app. Run <code>npm start</code>, open <code>http://127.0.0.1:4317/admin</code>, and save your edits. Then run <code>npm run export:pages</code> and push the updated export to GitHub.</p><a href="'+base+'">Return to the garden</a></body></html>';
await mkdir(join(output,'admin'),{recursive:true});
await writeFile(join(output,'admin/index.html'),admin);
await writeFile(join(output,'admin.html'),admin);
await writeFile(join(output,'.nojekyll'),'');
console.log('Built GitHub Pages garden for '+base);
