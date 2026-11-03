// Each plant owns its gradients so a dashboard preview can share a page with the garden.
let nextRose = 0;
const clamp = value => Math.max(0, Math.min(1, value));
const phase = (growth, start, end) => clamp((growth - start) / (end - start));
const smooth = value => value * value * (3 - 2 * value);
const svgNS = "http://www.w3.org/2000/svg";

// Six overlapping regions carry the wet petal texture. Each unfolds around
// its own axis so the outer petals can peel back while the heart stays tight.
function photographPetals(flower, defs, id, onReady) {
  const artwork=document.createElementNS(svgNS,'image');
  let available=false;
  artwork.addEventListener('load',()=>{available=true;onReady();},{once:true});
  artwork.id=id+'-photograph';
  artwork.setAttribute('href','/assets/bloom.webp');
  artwork.setAttribute('x','-83'); artwork.setAttribute('y','-94');
  artwork.setAttribute('width','166'); artwork.setAttribute('height','102');
  artwork.setAttribute('preserveAspectRatio','none');
  defs.append(artwork);
  const sectors=[];
  const center=-43;
  for (let index=0;index<6;index++) {
    const angle=(index+.5)*Math.PI/3;
    const clip=document.createElementNS(svgNS,'clipPath');
    clip.id=id+'-petal-clip-'+index;
    const polygon=document.createElementNS(svgNS,'polygon');
    const point=a=>[130*Math.cos(a),center+130*Math.sin(a)].join(',');
    polygon.setAttribute('points','0,'+(center-0.3)+' '+point(angle-Math.PI/6-.012)+' '+point(angle)+' '+point(angle+Math.PI/6+.012));
    clip.append(polygon); defs.append(clip);
    const layer=document.createElementNS(svgNS,'g'), petal=document.createElementNS(svgNS,'use');
    petal.setAttribute('href','#'+artwork.id);
    petal.setAttribute('clip-path','url(#'+clip.id+')');
    layer.append(petal);flower.append(layer);sectors.push({layer,angle});
  }
  return growth=>{
    const reveal=available ? smooth(phase(growth,67,90)) : 0;
    sectors.forEach(({layer,angle},index)=>{
      const open=smooth(phase(growth,53+index%3*3,100));
      const fold=1-open;
      layer.setAttribute('opacity',String(reveal));
      layer.setAttribute('transform','translate('+(-Math.cos(angle)*fold*5)+' '+(center+22*fold)+') rotate('+(fold*(index%2===0?13:-10))+') scale('+(0.26+0.74*open)+' '+(0.44+0.56*open)+') translate(0 '+(-center)+')');
    });
    return reveal;
  };
}

export function createRose() {
  const id = "rose-" + ++nextRose;
  const element = document.createElementNS(svgNS, "svg");
  element.setAttribute("viewBox", "0 0 260 240");
  element.setAttribute("role", "img");
  element.setAttribute("preserveAspectRatio", "xMidYMax meet");
  const grad = name => "url(#" + id + "-" + name + ")";
  const gradient = (name, colors, diagonal = false) => '<linearGradient id="' + id + '-' + name + '" x2="' + (diagonal ? '0.8' : '0') + '" y2="1">' +
    colors.map(([offset, color]) => '<stop offset="' + offset + '" stop-color="' + color + '"/>').join('') + '</linearGradient>';
  element.innerHTML = '<defs>' +
    gradient('leaf', [[0,'#889b4b'],[0.22,'#536f3e'],[0.49,'#365732'],[0.52,'#64763a'],[0.79,'#334827'],[1,'#182e21']],true) +
    gradient('petal', [[0,'#ff9a8e'],[0.06,'#dc535b'],[0.19,'#bc243a'],[0.5,'#911329'],[0.81,'#650d26'],[1,'#3e0b1b']],true) +
    gradient('bud', [[0,'#f6817a'],[0.16,'#d3354b'],[0.46,'#9b1933'],[0.84,'#5e1023'],[1,'#3b141d']],true) +
    '<g id="' + id + '-leaf-blade"><path d="M0 0 Q6 -10 17 -13 L16 -15 22 -14 25 -17 28 -16 34 -18 36 -16 Q45 -19 56 -17 Q46 -12 44 -9 L42 -9 39 -5 36 -5 34 -1 31 -2 27 2 24 1 19 4 Q10 5 0 0Z" fill="' + grad('leaf') + '" stroke="#82905d" stroke-width=".6"/>' +
    '<path d="M1 0Q24 -6 54 -16 M12 -3l5 -9m4 7 5 -9m3 6 6 -8m-18 13 8 2m-1 -4 7 1m1 -4 7 0" fill="none" stroke="#a8ac73" stroke-opacity=".66" stroke-width=".65"/></g>' +
    '</defs><g data-plant><path data-stem fill="none" stroke="#435233" stroke-width="5.6" stroke-linecap="round"/><path data-glint fill="none" stroke="#a7ab65" stroke-width="1.1"/><g data-leaves></g><g data-flower><g data-petals></g><g data-heart><path d="M0 5 C-15 2 -17 -15 -8 -28 Q-4 -37 1 -42 C2 -35 16 -26 14 -15 Q13 1 0 5Z" fill="' + grad('bud') + '" stroke="#a6454c" stroke-width=".8"/><path d="M-8 -26 Q3 -36 9 -24 Q11 -15 5 -9 Q6 -24 -8 -26Z" fill="#d24654"/><path d="M-3 -31 Q2 -36 6 -30 Q1 -31 0 -26Z" fill="#f1827b"/></g><g data-sepal fill="' + grad('leaf') + '"><path d="M0 7 Q-12 4 -17 -14 Q-8 -9 -5 -3 Q-8 -17 -4 -23 Q0 -12 1 -4 Q5 -11 15 -16 Q10 -1 3 5Z"/></g></g></g>';
  const el = key => element.querySelector('[data-' + key + ']');
  const plant = el('plant'), stem = el('stem'), glint = el('glint'), flower = el('flower'), heart = el('heart');
  const blade=element.querySelector('#'+id+'-leaf-blade');
  const leafImage=document.createElementNS(svgNS,'image');
  leafImage.setAttribute('href','/assets/leaf.webp');
  leafImage.setAttribute('x','-1');leafImage.setAttribute('y','-13');
  leafImage.setAttribute('width','68');leafImage.setAttribute('height','27');
  leafImage.setAttribute('transform','rotate(-14)');
  leafImage.addEventListener('load',()=>blade.querySelectorAll('path').forEach(path=>path.style.display='none'),{once:true});
  blade.append(leafImage);
  const leafSpecs = [[0.14,-1,9,0.96],[0.26,1,15,1.16],[0.4,-1,22,1.02],[0.57,1,32,0.89],[0.73,-1,39,0.72]];
  const leaves = leafSpecs.map(() => {
    const use = document.createElementNS(svgNS, 'use');
    use.setAttribute('href','#' + id + '-leaf-blade');
    el('leaves').append(use);
    return use;
  });
  const petals = [];
  for (let ring = 0; ring < 3; ring++) {
    const count = [8,7,5][ring];
    for (let j = 0; j < count; j++) {
      const angle = 2 * Math.PI * (j + ring * 0.37) / count;
      const petal = document.createElementNS(svgNS,'g');
      petal.innerHTML = '<path d="M0 4 C-8 -1 -19 -10 -22 -24 Q-25 -35 -17 -35 Q-13 -39 -7 -37 Q0 -42 6 -37 Q13 -39 17 -33 Q24 -32 21 -22 C18 -11 8 -1 0 4Z" fill="' + grad('petal') + '" stroke="#df6b6b" stroke-width=".8"/><path d="M-17 -34 Q-9 -38 -5 -35 Q1 -39 6 -35 M-15 -28 Q-13 -17 -4 -7 M15 -29 Q13 -16 4 -5" fill="none" stroke="#ef9590" stroke-opacity=".37" stroke-width=".75"/>';
      petals.push({petal, ring, angle});
    }
  }
  petals.sort((a,b) => a.ring - b.ring || Math.cos(b.angle) - Math.cos(a.angle));
  petals.forEach(({petal}) => el('petals').append(petal));
  let lastGrowth, budReady=false;
  const refreshGrowth=()=>{
    const current=lastGrowth;
    lastGrowth=undefined;
    setGrowth(current);
  };
  const cup=document.createElementNS(svgNS,'image');
  cup.setAttribute('href','/assets/bud.webp');
  cup.setAttribute('x','-40');cup.setAttribute('y','-78');
  cup.setAttribute('width','80');cup.setAttribute('height','83');
  cup.addEventListener('load',()=>{budReady=true;refreshGrowth();},{once:true});
  flower.append(cup);
  const photograph=photographPetals(flower,element.querySelector('defs'),id,refreshGrowth);
  const bend = t => 128 + 11 * Math.sin(t * 4.8) - 4 * t;
  function setGrowth(value) {
    const growth = Math.min(100,Math.max(0, Number(value) || 0));
    if (growth === lastGrowth) return;
    lastGrowth = growth;
    element.dataset.growth = growth.toFixed(2);
    element.setAttribute('aria-label', 'Rose at ' + Math.round(growth) + '% completion');
    plant.style.display = growth === 0 ? 'none' : '';
    const length = 182 * (0.76 * phase(growth,0,56) + 0.24 * phase(growth,56,100));
    const stage = length / 182;
    const y = 236 - length, x = bend(stage);
    const points = Array.from({length:13},(_,i) => [bend(stage*i/12),236-length*i/12]);
    const line = points.map(([a,b],i) => (i ? 'L':'M') + a.toFixed(1) + ' ' + b.toFixed(1)).join(' ');
    stem.setAttribute('d',line); glint.setAttribute('d',line); glint.setAttribute('transform','translate(-1.5 0)');
    leaves.forEach((use,i) => {
      const [height,dir,start,size] = leafSpecs[i];
      const extent = smooth(phase(growth,start,start+23)) * size;
      const t = height * stage;
      use.setAttribute('transform', 'translate(' + bend(t) + ' ' + (236-height*length) + ') scale(' + dir*extent + ' ' + extent + ') rotate(' + (-35+phase(growth,start,100)*39) + ')');
    });
    const bud = smooth(phase(growth,35,51));
    const opened = phase(growth,50,100);
    el('sepal').setAttribute('transform','translate(0 '+ (opened*3) +') scale('+ (1-opened*.52) +' '+ (1-opened*.78) +')');
    flower.setAttribute('transform','translate(' + x + ' ' + y + ') rotate(-9) scale(' + bud + ')');
    petals.forEach(({petal,ring,angle}) => {
      const spread = opened * [1,.76,.51][ring];
      const sx = .24 + .8*spread;
      const sy = .59 + .42*spread;
      const cx = Math.sin(angle) * (25+3*Math.cos(angle*3.4)) * spread;
      const cy = -17 - Math.cos(angle) * 11 * spread;
      petal.setAttribute('opacity', String(smooth(phase(growth,50+ring*1.5,61+ring*1.5))));
      // The outer whorl opens first. The front petals curl down around the heart.
      const turn = Math.atan2(Math.sin(angle),Math.cos(angle)) * 180/Math.PI;
      petal.setAttribute('transform','translate('+ cx +' '+ cy +') rotate('+(turn*spread+spread*(17+ring*5))+') scale('+sx+' '+sy+')');
    });
    heart.setAttribute('transform','translate(0 '+(-21*opened)+') scale('+(1-.48*opened)+' '+(1-.72*opened)+')');
    const texture=photograph(growth);
    const cupped=budReady ? smooth(phase(growth,51,64)) : 0;
    cup.setAttribute('opacity',String(cupped*(1-texture)));
    cup.setAttribute('transform','scale('+(0.49+0.51*smooth(phase(growth,50,73)))+' 1)');
    el('petals').setAttribute('opacity',String((1-texture)*(1-cupped)));
    heart.setAttribute('opacity',String((1-texture)*(1-cupped)));
  }
  setGrowth(0);
  return {element, setGrowth};
}
