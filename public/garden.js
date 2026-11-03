import {contentUrl} from './content-url.js';
import {createRose} from './rose.js';
import {createSoilSurface} from './soil.js';
import './rain-audio.js';

const $ = selector => document.querySelector(selector);
const beds = $('#beds');
let drag = null;
const memory = new Map();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const sampleGarden = location.pathname.replace(/\/$/,'')  .endsWith('/demo');
let projects = [], plot = 0, plants = [], elapsed = 0, frame = 0, last = null, loaded = false, requestId = 0;
const digits = value => String(value).padStart(2,'0');
const clamp = value => Math.max(0,Math.min(1,value));
const ease = value => value*value*(3-2*value);
const memoryKey = id => 'roseemerged:reveal:v1:' + id;
function seen(project) {
  const key = memoryKey(project.id);
  try { return sessionStorage.getItem(key) === String(project.completion); }
  catch { return memory.get(key) === String(project.completion); }
}
function remember(project) {
  const key = memoryKey(project.id), value = String(project.completion);
  memory.set(key,value);
  try { sessionStorage.setItem(key,value); } catch { /* Memory covers storage-restricted tabs. */ }
}
function node(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value != null) element.textContent = value;
  return element;
}
function safeWebUrl(value, local = false) {
  if (!value) return '';
  try {
    const url = local ? new URL(contentUrl(value),location.href) : new URL(value);
    return ['https:','http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function buildBed(project, index) {
  const bed = node('article','bed'), rose = createRose();
  rose.element.classList.add('rose');
  const pot = node('div','planter'), plate = node('div','plaque'), content = node('div','plaque-content');
  const details = node('div','details'), meta = node('div','plate-meta');
  meta.append(node('span','plate-type',digits(index+1) + ' · ' + project.type),node('span','percentage',project.completion + '%'));
  const title = node('h3','',project.title);
  title.title = project.title;
  details.append(meta,title);
  const url = safeWebUrl(project.url);
  const action = node(url ? 'a':'span','project-action ' + (url ? 'project-link':''));
  if (url) {
    action.href = url;
    action.textContent = 'View project ↗';
    action.setAttribute('aria-label','View project: ' + project.title);
  } else {
    action.append(node('i','status-dot'),document.createTextNode('In development'));
  }
  details.append(action);
  if (project.sample) details.append(node('small','sample','· Sample'));
  const thumbnail = safeWebUrl(project.thumbnail,true);
  if (thumbnail) {
    const img = node('img','medallion'); img.src = thumbnail; img.alt = ''; img.decoding = 'async';
    img.addEventListener('error',() => img.remove(),{once:true}); content.append(img);
  }
  if (project.description) {
    details.title = project.description;
    details.append(node('span','visually-hidden',project.description));
  }
  content.append(details); plate.append(content); pot.append(createSoilSurface(),plate); bed.append(rose.element,pot);
  const established = seen(project);
  content.style.opacity = established ? '1':'0';
  content.inert = !established;
  rose.setGrowth(established ? project.completion:0);
  return {bed, rose, project, content, established, reached:established, age:null, growthDuration:1300};
}

const canvas = $('#rain'), ctx = canvas.getContext('2d');
let drops = [], soil = [], width = 0, height = 0, rainTime = 0;
function locateSoil() {
  soil=Array.from(beds.querySelectorAll('.planter'),element=>element.getBoundingClientRect());
}
function resizeRain() {
  width = innerWidth; height = innerHeight;
  const scale = Math.min(devicePixelRatio || 1,1.5);
  canvas.width = Math.round(width*scale); canvas.height = Math.round(height*scale);
  if (ctx) ctx.setTransform(scale,0,0,scale,0,0);
  drops = Array.from({length:width<=700 ? 90:220},() => ({
    x:Math.random(), y:Math.random(), z:.3 + Math.random()*.7, splash:Math.random()
  }));
  locateSoil();
}
function drawRain(strength,delta) {
  if (!ctx) return;
  ctx.clearRect(0,0,width,height); rainTime += delta*.001;
  const count = Math.round(drops.length*(.24+.76*strength));
  for (let i=0; i<count; i++) {
    const drop=drops[i], speed=drop.z*(.65+.65*strength);
    const y=((drop.y + rainTime*speed) % 1) * (height+32)-16;
    const x=((drop.x*width - rainTime*speed*height*.115) % width + width) % width;
    const length=6+drop.z*(8+24*strength);
    ctx.strokeStyle='rgba(217,232,235,' + (.10+drop.z*(.12+.19*strength)) + ')';
    ctx.lineWidth=drop.z>.9 ? 1.4:.8;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-length*.115,y+length); ctx.stroke();

  }
  // Each falling impact streak ends on the same soil point as its splash.
  for (const pot of soil) {
    if (pot.bottom<0 || pot.top>height) continue;
    const impacts=width<=700 ? 7:12;
    for(let i=0;i<impacts;i++) {
      const seed=(i*.61803398875)%1;
      const t=(rainTime*(1.8+strength*1.8)+seed)%1;
      const x=pot.left+pot.width*(.13+seed*.74);
      const y=pot.top+pot.height*(.19+((i*.381966)%1)*.065);
      const intensity=.18+.45*strength;
      ctx.strokeStyle='rgba(221,230,215,'+intensity*.65+')';
      ctx.lineWidth=.8;
      if(t<.48) {
        const distance=(.48-t)*100;
        ctx.globalAlpha=intensity;
        ctx.beginPath();ctx.moveTo(x+distance*.12,y-distance);
        ctx.lineTo(x+(distance+18)*.12,y-distance-18);ctx.stroke();
      } else {
        const age=(t-.48)/.52;
        const radius=(1.5+seed*3)*age;
        ctx.globalAlpha=(1-age)*intensity;
        ctx.fillStyle='rgba(111,87,58,.55)';
        ctx.fillRect(x-radius,y,.9,.7);
        ctx.beginPath();
        ctx.moveTo(x-radius,y-5*Math.sin(age*Math.PI)*(1-seed*.5));
        ctx.lineTo(x-radius*.7,y-3*Math.sin(age*Math.PI));
        ctx.moveTo(x+radius,y-4*Math.sin(age*Math.PI));
        ctx.lineTo(x+radius*.7,y-2*Math.sin(age*Math.PI));ctx.stroke();
      }
    }
  }
  ctx.globalAlpha=1;
}
function paint(delta) {
  const instant=motion.matches;
  if (instant) elapsed=Math.max(elapsed,2000);
  const viewport=beds.getBoundingClientRect();
  for (const plant of plants) {
    const bounds=plant.bed.getBoundingClientRect();
    const visibleWidth=Math.max(0,Math.min(bounds.right,viewport.right)-Math.max(bounds.left,viewport.left));
    const visibleFraction=visibleWidth/Math.min(bounds.width,viewport.width);
    // A small peek stays bare. Once triggered, growth can continue at the edge.
    if (!instant && (visibleWidth<=0 || (plant.age===null && visibleFraction<.65))) continue;
    if (plant.age===null) {
      plant.age=0;
      plant.growthDuration=beds.scrollLeft>5 ? 4200:1300;
      if(!plant.established) elapsed=0;
    }
    plant.age+=delta;
    if (plant.established) continue;
    const progress = instant ? 1 : clamp((plant.age-250)/plant.growthDuration);
    plant.rose.setGrowth(plant.project.completion*ease(progress));
    if (progress === 1 && !plant.reached) {
      plant.reached = true; remember(plant.project); plant.content.inert = false;
    }
    plant.content.style.opacity = String(instant ? 1:ease(clamp((plant.age-250-plant.growthDuration)/650)));
  }
  for (const plant of plants) {
    const wetness=instant ? 1:ease(clamp((plant.age||0)/3200));
    plant.bed.style.setProperty('--soil-wetness',String(wetness));
  }
  const storm = instant ? 0:1-ease(clamp((elapsed-3000)/2000));
  $('#storm').style.opacity = String(storm*.24);
  document.dispatchEvent(new CustomEvent('rain-intensity',{detail:instant ? .15:.28+storm*.72}));
  if (instant) ctx?.clearRect(0,0,width,height);
  else drawRain(storm,delta);
}
function stop() { cancelAnimationFrame(frame); frame=0; last=null; }
function animate(now) {
  frame=0;
  if(document.hidden || motion.matches) return;
  const delta=last==null ? 0:Math.max(0,now-last);
  elapsed+=delta; last=now; paint(delta);
  frame=requestAnimationFrame(animate);
}
function start() {
  stop();
  if (motion.matches) { paint(0); return; }
  if (!document.hidden) frame=requestAnimationFrame(animate);
}

function render() {
  stop();
  cancelDrag();
  const total=Math.ceil(projects.length/3);
  plot=Math.max(0,Math.min(plot,total-1)); elapsed=0;
  beds.classList.toggle('draggable',projects.length>1);
  $('#drag-hint').textContent=projects.length>1 ? 'Drag to explore ↔ · Arrow keys also work' : 'The rooftop collection';
  $('#plot-count').textContent='Plot '+digits(total ? plot+1:0)+' / '+digits(total);
  plants=projects.map((project,i) => buildBed(project,i));
  beds.replaceChildren(...plants.map(plant=>plant.bed));
  locateSoil();
  beds.setAttribute('aria-busy','false');
  $('#notice').replaceChildren();
  if (!total) {
    $('#notice').append(document.createTextNode('The garden is waiting for its first published project. '));
    if (!sampleGarden) { const link=node('a','project-link','Explore the sample garden ↗');link.href=contentUrl('/demo');$('#notice').append(link); }
  }
  if (plants.some(plant => plant.project.sample)) $('.eyebrow').innerHTML='<i></i>The rooftop collection · Sample garden';
  else $('.eyebrow').innerHTML='<i></i>The rooftop collection';
  paint(0); start();
}
async function refresh() {
  const id=++requestId;
  try {
    const response=await fetch(contentUrl(sampleGarden ? '/api/demo-projects':'/api/projects'),{cache:'no-store'});
    if(!response.ok) throw Error('Unavailable');
    const data=await response.json();
    if(id!==requestId) return;
    if(!Array.isArray(data)) throw Error('Unexpected portfolio data');
    if(!loaded || JSON.stringify(projects)!==JSON.stringify(data)) { projects=data; loaded=true; render(); document.dispatchEvent(new CustomEvent("garden-projects",{detail:projects})); }
  } catch {
    if (id!==requestId || loaded) return;
    $('#notice').textContent='The garden couldn’t load. ';
    const retry=node('button','','Try again');retry.onclick=refresh;$('#notice').append(retry);
    beds.setAttribute('aria-busy','false');
  }
}
function cancelDrag() {
  const previous=drag;
  drag=null;
  if(previous && beds.hasPointerCapture(previous.id)) beds.releasePointerCapture(previous.id);
  beds.classList.remove('dragging');
}
beds.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch' || !event.isPrimary || event.button!==0 || event.target.closest('a,button')) return;
  drag={id:event.pointerId,x:event.clientX,left:beds.scrollLeft};
});
beds.addEventListener('pointermove',event=>{
  if(!drag || drag.id!==event.pointerId) return;
  const dx=event.clientX-drag.x;
  if(Math.abs(dx)>4) {
    beds.setPointerCapture(event.pointerId);
    beds.classList.add('dragging');
    beds.scrollLeft=drag.left-dx;
  }
});
beds.addEventListener('pointerup',cancelDrag);
beds.addEventListener('pointercancel',cancelDrag);
beds.addEventListener('lostpointercapture',cancelDrag);
beds.addEventListener('dragstart',event=>event.preventDefault());
beds.addEventListener('scroll',()=>{
  locateSoil();
  const first=plants.findIndex(plant=>plant.bed.getBoundingClientRect().right>beds.getBoundingClientRect().left+50);
  plot=Math.floor(Math.max(0,first)/3);
  $('#plot-count').textContent='Plot '+digits(projects.length?plot+1:0)+' / '+digits(Math.ceil(projects.length/3));
},{passive:true});
beds.addEventListener('keydown',event=>{
  if(event.target!==beds || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  beds.scrollBy({left:(event.key==='ArrowRight'?1:-1)*(plants[0]?.bed.clientWidth||300),behavior:motion.matches?'instant':'smooth'});
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) stop();else {start();void refresh();}
});
window.addEventListener('focus',refresh);
window.setInterval(()=>{if(!document.hidden) void refresh();},30000);
motion.addEventListener('change',start);
window.addEventListener('resize',resizeRain,{passive:true});
window.addEventListener('scroll',locateSoil,{passive:true});
document.querySelectorAll('[data-about]').forEach(button=>button.onclick=()=>$('#about').showModal());
$('#close').onclick=()=>$('#about').close();
$('#about').onclick=event=>{if(event.target===$('#about')) {const r=$('#about').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) $('#about').close();}};
resizeRain(); start(); void refresh();
