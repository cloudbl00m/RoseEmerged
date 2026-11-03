const vessel=document.querySelector('.rain-vessel');
const panel=document.querySelector('.contact-garden');
const rain=vessel.querySelector('.vessel-rain');
const water=vessel.querySelector('.vessel-water');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const svgNS='http://www.w3.org/2000/svg';
for(let i=0;i<64;i++) {
  const drop=document.createElementNS(svgNS,'line');
  const x=52+((i*.618034)%1)*456;
  drop.setAttribute('x1',x);
  drop.setAttribute('x2',x-6);
  drop.setAttribute('y1',160+(i%4)*3);
  drop.setAttribute('y2',174+(i%4)*4);
  drop.setAttribute('stroke-width',i%5===0?'2':'1.1');
  drop.style.setProperty('--delay',(-i*.137)+'s');
  drop.style.setProperty('--speed',(.55+(i%5)*.07)+'s');
  rain.append(drop);
}
let visible=false,elapsed=0,last=null,frame=0,finished=false;
function finish() {
  finished=true;
  vessel.classList.remove('is-raining');
  panel.classList.remove('is-starting');
  water.style.transform='translateY(0)';
  vessel.classList.add('is-full');
}
function tick(now) {
  frame=0;
  if(!visible || document.hidden || finished) {last=null;return;}
  if(reduced.matches) {finish();return;}
  if(last!==null) elapsed+=Math.min(now-last,100);
  last=now;
  panel.classList.toggle('is-starting',elapsed<700);
  vessel.classList.toggle('is-raining',elapsed>=550 && elapsed<9500);
  const fill=Math.max(0,Math.min(1,(elapsed-650)/8850));
  water.style.transform='translateY('+(175*(1-fill))+'px)';
  if(fill===1) {finish();return;}
  frame=requestAnimationFrame(tick);
}
function resume() {
  cancelAnimationFrame(frame);
  last=null;
  if(visible && !document.hidden && !finished) frame=requestAnimationFrame(tick);
}
new IntersectionObserver(entries=>{
  visible=entries.some(entry=>entry.isIntersecting);
  if(!visible) {
    vessel.classList.remove('is-raining');
    panel.classList.remove('is-starting');
  }
  resume();
},{threshold:.3}).observe(vessel);
document.addEventListener('visibilitychange',()=>{
  vessel.classList.toggle('tab-hidden',document.hidden);
  resume();
});
reduced.addEventListener('change',()=>{if(reduced.matches && visible) finish();else resume();});
