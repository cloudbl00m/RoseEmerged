import {contentUrl} from './content-url.js';
const projectsNode=document.getElementById('project-notes');
const teamNode=document.getElementById('team-skills');
const motion=matchMedia('(prefers-reduced-motion:reduce)');
function node(tag,className,text) {
  const element=document.createElement(tag);
  element.className=className||'';
  if(text) element.textContent=text;
  return element;
}
function tags(values) {
  const list=node('ul','skill-tags');
  list.setAttribute('aria-label','Skills');
  for(const value of values||[]) list.append(node('li','',value));
  return list;
}
function flowerSkills(values) {
  const list=node('ul','skill-meadow');
  list.setAttribute('aria-label','Team skills');
  const colors=[['#9c344d','#e9a1a9'],['#ad6955','#efc4ab'],['#86668c','#ceb7d6'],['#b0934f','#f3e0a1']];
  values.forEach((value,index)=>{
    const item=node('li','skill-flower reveal');
    item.style.setProperty('--flower-delay',(index%4)*70+'ms');
    const [dark,light]=colors[index%colors.length];
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 160 180');
    svg.setAttribute('aria-hidden','true');
    const id='skill-petal-'+index;
    let petals='';
    for(let petal=0;petal<9;petal++) {
      petals+='<ellipse cx="80" cy="41" rx="14" ry="27" transform="rotate('+(petal*40)+' 80 65)" fill="url(#'+id+')" stroke="'+dark+'" stroke-opacity=".2" stroke-width=".7"/>';
    }
    svg.innerHTML='<defs><linearGradient id="'+id+'" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="'+light+'"/><stop offset=".65" stop-color="'+dark+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient></defs>'+
      '<ellipse cx="80" cy="170" rx="38" ry="5" fill="#78896a" opacity=".1"/>'+
      '<path d="M80 168C87 139 70 114 80 69" fill="none" stroke="#718363" stroke-width="3"/>'+
      '<path d="M80 139C57 141 42 127 40 114C58 115 74 122 80 139Z" fill="#879977"/>'+
      '<path d="M79 119C98 120 115 106 118 94C99 96 85 105 79 119Z" fill="#a3af8c"/>'+
      '<path d="M80 139L44 118M80 119L114 98" fill="none" stroke="#5b7355" stroke-width=".8" opacity=".6"/>'+
      '<g class="skill-bloom">'+petals+'<circle cx="80" cy="65" r="15" fill="#d7af62"/><circle cx="80" cy="65" r="10" fill="#ad8749"/>'+
      '<g fill="#f2d590"><circle cx="76" cy="61" r="1.7"/><circle cx="83" cy="60" r="1.4"/><circle cx="79" cy="68" r="1.5"/><circle cx="86" cy="67" r="1.5"/><circle cx="73" cy="67" r="1.2"/><circle cx="82" cy="73" r="1.1"/></g></g>';
    item.append(svg,node('span','flower-skill-name',value));
    list.append(item);
  });
  if(!values.length) list.append(node('li','empty-meadow','Our skills garden is taking root.'));
  return list;
}
const observer=new IntersectionObserver(entries=>{
  for(const entry of entries) if(entry.isIntersecting) {
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  }
},{threshold:.12});
function revealElements() {
  for(const element of document.querySelectorAll('.reveal:not(.is-visible)')) {
    if(motion.matches) element.classList.add('is-visible');
    else {element.classList.add('will-reveal');observer.observe(element);}
  }
}
function renderProjects(projects) {
  projectsNode.replaceChildren();
  if(!projects.length) projectsNode.append(node('p','empty-notes','The first project story is still taking root.'));
  projects.forEach((project,index)=>{
    const row=node('article','project-story reveal');
    row.append(node('span','story-number',String(index+1).padStart(2,'0')));
    const content=node('div','story-content');
    content.append(node('p','overline',project.type),node('h3','',project.title));
    if(project.description) content.append(node('p','story-description',project.description));
    content.append(tags(project.skills));
    if(project.sample) content.append(node('small','','Illustrative sample'));
    const status=node('div','story-status');
    status.append(node('span','story-percent',project.completion+'%'),node('span','',project.completion===100?'In bloom':'Still growing'));
    if(project.url) {
      try {
        const url=new URL(project.url);
        if(['http:','https:'].includes(url.protocol)) {
          const link=node('a','story-link','View project ↗');
          link.href=url.href;status.append(link);
        }
      } catch {}
    } else status.append(node('span','story-link','In development'));
    row.append(content,status);projectsNode.append(row);
  });
  revealElements();
}
async function loadTeam() {
  try {
    const response=await fetch(contentUrl('/api/team'),{cache:'no-store'});
    if(!response.ok) throw Error();
    const data=await response.json();

    const unique=new Map((Array.isArray(data)?data.flatMap(member=>member.skills||[]):data.skills||[]).map(tag=>[tag.toLowerCase(),tag]));
    document.getElementById('team-skills').replaceChildren(flowerSkills([...unique.values()]));
    revealElements();
  } catch {
    if(!teamNode.children.length) teamNode.append(node('p','','Team profiles could not load. Refresh to try again.'));
  }
}
document.addEventListener('garden-projects',event=>renderProjects(event.detail));
window.addEventListener('focus',loadTeam);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) void loadTeam();});
window.setInterval(()=>{if(!document.hidden) void loadTeam();},30000);
motion.addEventListener('change',revealElements);
revealElements();
void loadTeam();
