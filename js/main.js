import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ORI — museu procedural 3D. Sem modelos externos: materiais e obras são gerados no navegador.
const $ = (id) => document.getElementById(id);
const world = $('world');
const ui = {
  loading: $('loading'), welcome: $('welcome'), enter: $('enterBtn'), hud: $('hud'),
  room: $('roomName'), progress: $('progressText'), fill: $('progressFill'),
  reticle: $('reticle'), hint: $('interactHint'), controls: $('controlsLegend'),
  mobilePad: $('mobilePad'), lookTip: $('lookTip'), exhibit: $('exhibitPanel'),
  exhibitEyebrow: $('exhibitEyebrow'), exhibitTitle: $('exhibitTitle'), exhibitText: $('exhibitText'),
  exhibitCredit: $('exhibitCredit'), closeExhibit: $('closeExhibit'), exhibitImg: $('exhibitImg'), touchInteract: $('touchInteract'), map: $('mapPanel'),
  mapBtn: $('mapBtn'), closeMap: $('closeMap'), help: $('helpOverlay'), helpBtn: $('helpBtn'),
  closeHelp: $('closeHelp'), resume: $('resumeBtn'), qualityBtn: $('qualityBtn'), toast: $('qualityToast')
};
const isTouch = matchMedia('(pointer:coarse)').matches;
const state = { started:false, yaw:0, pitch:-0.025, locked:false, lowQuality:false, target:null, cardOpen:false, mapOpen:false, helpOpen:false, dragging:false, lastX:0, lastY:0, lastToast:0 };
const keys = Object.create(null);
const touchMoves = Object.create(null);
const exhibits = [];
const obstacles = [];
const raycaster = new THREE.Raycaster();
raycaster.far = 8.5;
const center = new THREE.Vector2(0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'low-power', alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = false;
world.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Cena 3D; clique para capturar o mouse e caminhar');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8a6954);
scene.fog = new THREE.FogExp2(0x8a6954, 0.0088);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 95);
camera.position.set(0,1.68,23.3);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xf8d9aa, 0x382015, 1.9));
scene.add(new THREE.AmbientLight(0xf3d3aa, 0.42));
const mainLight = new THREE.DirectionalLight(0xffd6a0, 2.1);
mainLight.position.set(-7,11,10); scene.add(mainLight);
const fillLight = new THREE.DirectionalLight(0x7f6bff, 0.55);
fillLight.position.set(7,6,-12); scene.add(fillLight);
const poolsOfLight = [];
for (const [li,z] of [17,7,-3,-13,-22].entries()) {
  const lamp = new THREE.PointLight(li%2?0x9d86ff:0xffb568, 26, 18, 1.7);
  lamp.position.set(0,6.8,z); scene.add(lamp); poolsOfLight.push(lamp);
}

const C = { plaster:0xb99a78, pale:0xe2c7a0, terracotta:0xa94f32, rust:0x823c2a, bronze:0x9f713d, gold:0xd7ad68, dark:0x291a12, navy:0x253a43, indigo:0x3b405c, green:0x53634c, cream:0xf0dfc3, wood:0x543321 };
function mat(color, roughness=0.78, extra={}) { return new THREE.MeshStandardMaterial({color, roughness, metalness:0.03, ...extra}); }
const plasterMat = mat(C.plaster);
const trimMat = mat(C.terracotta,0.62);
const goldMat = mat(C.gold,0.42,{metalness:0.52});
const darkMat = mat(C.dark,0.9);
const woodMat = mat(C.wood,0.78);
const stoneMat = mat(0x8a6d54,0.9);
const fabricMat = mat(C.navy,0.95);

function canvasTexture(draw, width=768, height=512, repeatX=1, repeatY=1) {
  const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx = canvas.getContext('2d'); draw(ctx,width,height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX,repeatY); texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(),4);
  return texture;
}
function floorPattern(ctx,w,h) {
  ctx.fillStyle='#8b684d'; ctx.fillRect(0,0,w,h);
  const tile=64;
  for(let y=0;y<h;y+=tile) for(let x=0;x<w;x+=tile) {
    const n=((x/tile*3+y/tile*7)%5);
    ctx.fillStyle=['#a07b5a','#956e50','#8e694f','#a7835d','#7f5c45'][n];
    ctx.fillRect(x+1,y+1,tile-2,tile-2);
    ctx.strokeStyle='rgba(42,25,16,.48)';ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,tile-6,tile-6);
    ctx.strokeStyle='rgba(237,201,148,.26)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x+tile/2,y+8);ctx.lineTo(x+tile-8,y+tile/2);ctx.lineTo(x+tile/2,y+tile-8);ctx.lineTo(x+8,y+tile/2);ctx.closePath();ctx.stroke();
    ctx.fillStyle='rgba(220,174,105,.3)';ctx.fillRect(x+tile/2-2,y+tile/2-2,4,4);
  }
  // subtle grain, deterministic enough and cheap
  for(let i=0;i<1500;i++){ctx.fillStyle=i%2?'rgba(255,235,198,.035)':'rgba(31,18,10,.035)';ctx.fillRect((i*67)%w,(i*131)%h,2,2);}
}
const floorTex = canvasTexture(floorPattern,1024,1024,4,8);
const wallTex = canvasTexture((ctx,w,h)=>{
  ctx.fillStyle='#b99a78';ctx.fillRect(0,0,w,h);
  for(let i=0;i<3600;i++){let x=(i*73)%w,y=(i*139)%h;ctx.fillStyle=i%3?'rgba(65,43,29,.045)':'rgba(255,226,182,.065)';ctx.fillRect(x,y,2+(i%4),1+(i%3));}
  ctx.fillStyle='rgba(64,35,23,.07)';for(let y=0;y<h;y+=92){ctx.fillRect(0,y,w,2);}
},512,512,2,2);
const floorMat = new THREE.MeshStandardMaterial({map:floorTex,roughness:0.95});
const wallMat = new THREE.MeshStandardMaterial({map:wallTex,roughness:0.94});

function box(name,w,h,d,material,x,y,z, parent=scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material); mesh.name=name;
  mesh.position.set(x,y,z); mesh.castShadow=false; mesh.receiveShadow=false; parent.add(mesh); return mesh;
}
function cyl(rt,rb,h,material,x,y,z,radial=16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,radial),material); mesh.position.set(x,y,z); scene.add(mesh); return mesh;
}
function addStripeBand(x,z,side) {
  const g=new THREE.Group();g.position.set(x,7.55,z);g.rotation.y=side==='left'?Math.PI/2:-Math.PI/2;scene.add(g);
  const b=box('faixa geométrica',26,.38,.08,trimMat,0,0,0,g);
  const tex=canvasTexture((ctx,w,h)=>{
    ctx.fillStyle='#8f432f';ctx.fillRect(0,0,w,h);
    for(let i=0;i<w;i+=44){ctx.strokeStyle='#e3bc76';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(i+4,4);ctx.lineTo(i+22,h/2);ctx.lineTo(i+4,h-4);ctx.moveTo(i+40,4);ctx.lineTo(i+22,h/2);ctx.lineTo(i+40,h-4);ctx.stroke();ctx.fillStyle='#eed7a6';ctx.fillRect(i+18,h/2-3,6,6);}
  },768,64,1,1);
  b.material=new THREE.MeshStandardMaterial({map:tex,roughness:.82,side:THREE.DoubleSide});
}

// Floor, walls, ceiling and timber grid establish the large, warm gallery.
const floor = new THREE.Mesh(new THREE.PlaneGeometry(27,56),floorMat);floor.rotation.x=-Math.PI/2;floor.position.set(0,0,-1);scene.add(floor);
const ceilingMat=mat(0x352319,0.93);
const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(27,56),ceilingMat);ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,8.7,-1);scene.add(ceiling);
box('parede oeste',.5,8.7,56,wallMat,-13.5,4.35,-1);
box('parede leste',.5,8.7,56,wallMat,13.5,4.35,-1);
box('parede de entrada',27,8.7,.5,wallMat,0,4.35,27);
// A parede posterior é aberta no centro: o visitante atravessa um portal para o jardim.
box('parede final oeste',9.5,8.7,.5,wallMat,-8.75,4.35,-29);
box('parede final leste',9.5,8.7,.5,wallMat,8.75,4.35,-29);
box('lintel do portal externo',8,1.8,.52,trimMat,0,7.85,-29);
box('filete dourado do portal externo',8,.075,.56,goldMat,0,6.94,-29.02);
// Quiet, luminous panels embedded into the roof; wooden ribs make it feel designed rather than empty.
for(let z=24;z>=-27;z-=3.15){
  box('viga de madeira',27,.18,.22,woodMat,0,8.37,z);
  for(const x of [-8,-4,0,4,8]) box('detalhe da viga',.055,.025,.27,goldMat,x,8.27,z);
  const skylight=box('painel de luz',2.7,.035,1.75,mat(0xf4c888,.38,{emissive:0x8a5129,emissiveIntensity:.42}),0,8.25,z-1.55);
}
// Wall moldings and repetitive ornamental columns.
box('friso superior oeste',.12,.24,55,goldMat,-13.22,7.94,-1);
box('friso superior leste',.12,.24,55,goldMat,13.22,7.94,-1);
box('rodapé oeste',.14,.34,55,trimMat,-13.22,.22,-1);
box('rodapé leste',.14,.34,55,trimMat,13.22,.22,-1);
for (let z=24;z>=-25;z-=8) {
  for (const x of [-11.55,11.55]) {
    cyl(.5,.64,7.45,plasterMat,x,3.9,z,12);
    cyl(.7,.7,.3,trimMat,x,.18,z,12);
    cyl(.64,.66,.22,goldMat,x,7.58,z,12);
    cyl(.63,.63,.18,trimMat,x,7.36,z,12);
    cyl(.73,.73,.2,plasterMat,x,.42,z,12);
    for(let ring=0;ring<3;ring++) cyl(.505,.505,.08,ring===1?goldMat:trimMat,x,2.0+ring*.32,z,12);
  }
}
addStripeBand(-13.18,-1,'left');addStripeBand(13.18,-1,'right');

// Arched portal frames, a major visual signature of the museum.
function makeArchGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-9.2,0);shape.lineTo(-9.2,4.0);shape.bezierCurveTo(-9.2,6.0,-5.4,7.55,0,7.55);shape.bezierCurveTo(5.4,7.55,9.2,6.0,9.2,4.0);shape.lineTo(9.2,0);shape.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-8.08,0);opening.lineTo(-8.08,4.0);opening.bezierCurveTo(-8.08,5.55,-4.6,6.48,0,6.48);opening.bezierCurveTo(4.6,6.48,8.08,5.55,8.08,4.0);opening.lineTo(8.08,0);opening.closePath();
  shape.holes.push(opening);
  return new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:true,bevelThickness:.08,bevelSize:.07,bevelSegments:2,curveSegments:12});
}
const archGeo=makeArchGeometry();
const archMat=mat(0xc6a77d,.72,{metalness:.04,side:THREE.DoubleSide});
for(const z of [15,5,-5,-15]){
  const arch=new THREE.Mesh(archGeo,archMat);arch.position.set(0,.03,z);arch.castShadow=false;scene.add(arch);
  // fine copper inlay following the portal's visual rhythm
  for(const x of [-8.63,8.63]) box('filete do portal',.065,3.75,.53,goldMat,x,2.03,z+.27);
  const medallion=new THREE.Mesh(new THREE.TorusGeometry(.43,.055,8,32),goldMat);medallion.position.set(0,7.05,z+.27);scene.add(medallion);
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.25,0),mat(C.terracotta,.65));core.position.set(0,7.05,z+.25);core.rotation.set(.2,.35,.2);scene.add(core);
}

function seeded(n){let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
const ARTS={
 arquitetos:{s:['#1b1f4b','#8a3f7f','#f2a65a'],t:'#2a2350',a:'#f4d28a',g:'#ffe3a3',shape:'arch'},
 personagens:{s:['#120d2e','#4b2a86','#e0709a'],t:'#241d52',a:'#ffd166',g:'#fff1c2',shape:'dome'},
 fe:{s:['#07253a','#1f6f8b','#9fe0d4'],t:'#0f3b52',a:'#f6e7b4',g:'#ffffff',shape:'step'},
 arte:{s:['#3a1c12','#b8532f','#f0c36d'],t:'#25305a',a:'#f6e2b3',g:'#fff4d1',shape:'tri'},
 movimentos:{s:['#0e0e0e','#8c1f2b','#2a8a54'],t:'#171717',a:'#f2c230',g:'#ffe9a0',shape:'bar'},
 subculturas:{s:['#150a2e','#0e7490','#f43f8e'],t:'#221a48',a:'#38e1c6',g:'#ffd1f0',shape:'slant'}
};
// Cada tema vira uma cidade afrofuturista: céu em degradê, astro com órbitas e três camadas de torres.
function artTexture(kind){return canvasTexture((ctx,w,h)=>{
 const P=ARTS[kind]||ARTS.arquitetos,ki=Math.max(0,Object.keys(ARTS).indexOf(kind));
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,P.s[0]);sky.addColorStop(.55,P.s[1]);sky.addColorStop(1,P.s[2]);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='rgba(255,255,255,.85)';for(let i=0;i<80;i++){const r=1+seeded(i+9)*1.7;ctx.fillRect(seeded(i)*w,seeded(i+50)*h*.55,r,r);}
 const sx=w*(.24+seeded(ki+3)*.52),sy=h*.28;
 ctx.fillStyle=P.g;ctx.beginPath();ctx.arc(sx,sy,h*.085,0,7);ctx.fill();
 ctx.strokeStyle=P.a;ctx.lineWidth=2;for(let i=1;i<=3;i++){ctx.beginPath();ctx.ellipse(sx,sy,h*(.09+i*.07),h*(.028+i*.02),-.35,0,7);ctx.stroke();}
 for(let L=0;L<3;L++){
  const n=6+L*2,bw=w/n,base=h*(.46+L*.13);ctx.globalAlpha=[.5,.78,1][L];
  for(let i=0;i<n;i++){
   const x=i*bw+bw*.08,ww=bw*.84,y=base+(seeded(i+L*17+ki*5)-.5)*h*.2-(i%3)*h*.02,cx=x+ww/2;
   ctx.fillStyle=P.t;ctx.fillRect(x,y,ww,h-y);ctx.beginPath();
   if(P.shape==='arch')ctx.arc(cx,y,ww/2,Math.PI,0);
   else if(P.shape==='dome'){ctx.arc(cx,y,ww/2,Math.PI,0);ctx.rect(cx-1.5,y-ww/2-h*.06,3,h*.06);}
   else if(P.shape==='step'){ctx.rect(x+ww*.15,y-h*.04,ww*.7,h*.04);ctx.rect(x+ww*.3,y-h*.08,ww*.4,h*.04);}
   else if(P.shape==='tri'){ctx.moveTo(x,y);ctx.lineTo(cx,y-ww*.55);ctx.lineTo(x+ww,y);}
   else if(P.shape==='bar'){ctx.rect(cx-1.5,y-h*.09,3,h*.09);ctx.rect(cx+1.5,y-h*.09,ww*.28,h*.03);}
   else{ctx.moveTo(x,y);ctx.lineTo(x+ww,y-h*.06);ctx.lineTo(x+ww,y);}
   ctx.fill();ctx.fillStyle=P.a;
   for(let r=0;r<9;r++)for(let c=0;c<3;c++)if(seeded(i*31+r*7+c+L*13)>.58)ctx.fillRect(x+ww*(.16+c*.28),y+h*.03+r*h*.055,ww*.14,h*.026);
  }
 }
 ctx.globalAlpha=1;ctx.fillStyle=P.s[0];ctx.fillRect(0,h*.9,w,h*.1);
 ctx.strokeStyle=P.a;ctx.lineWidth=3;ctx.beginPath();for(let x=0;x<=w;x+=20)ctx.lineTo(x,h*.95+((x/20)%2?-7:7));ctx.stroke();
 ctx.strokeStyle='rgba(244,220,180,.74)';ctx.lineWidth=5;ctx.strokeRect(16,16,w-32,h-32);
 },640,480,1,1);}
function plaqueTexture(title, tag) {
 return canvasTexture((ctx,w,h)=>{
  ctx.fillStyle='#302016';ctx.fillRect(0,0,w,h);ctx.fillStyle='#d6ac69';ctx.fillRect(0,0,8,h);ctx.fillStyle='#e6d6bc';ctx.font='600 34px sans-serif';ctx.fillText(title.toUpperCase().slice(0,28),28,49);ctx.fillStyle='#bf9f7b';ctx.font='18px monospace';ctx.fillText(tag.toUpperCase().slice(0,38),28,79);ctx.strokeStyle='#9f6a45';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(28,95);ctx.lineTo(w-20,95);ctx.stroke();
 },512,120,1,1);
}
const stories = [
 {id:'001',kind:'arquitetos',title:'Arquitetos que desenham futuros',tag:'ARQUITETOS AFRO',credit:'KÉRÉ · ADJAYE · KAMARA · LOKKO · BERTH',text:'Francis Kéré, de Burkina Faso, ganhou o Pritzker em 2022 com escolas e centros comunitários de argila, construídos junto com as comunidades. David Adjaye liderou o projeto do Museu Nacional de História e Cultura Afro-Americana, em Washington. Mariam Kamara, do Níger, reinventa a arquitetura do Sahel, e Lesley Lokko curou a Bienal de Veneza de 2023, dedicada aos futuros africanos. No Brasil, a urbanista Joice Berth defende cidades pensadas com quem as vive.'},
 {id:'002',kind:'personagens',title:'Personagens do amanhã',tag:'PERSONAGENS NEGROS',credit:'SUN RA · BUTLER · MONÁE · KABRAL · CAROLINA',text:'O afrofuturismo coloca pessoas negras no centro de futuros possíveis. Sun Ra levou o jazz ao espaço com sua Arkestra. Octavia Butler criou Lauren Olamina, de “A Parábola do Semeador”. Janelle Monáe deu vida à androide Cindi Mayweather. No Brasil, Fábio Kabral escreve ficção científica com orixás e tecnologia ancestral, e Carolina Maria de Jesus transformou o diário “Quarto de Despejo” em retrato da cidade que exclui.'},
 {id:'003',kind:'fe',title:'Fé que molda a cidade',tag:'RELIGIOSIDADE E INFLUÊNCIAS',credit:'CANDOMBLÉ · UMBANDA · CONGADO · ORIXÁS',text:'Terreiros de candomblé e de umbanda são espaços de fé, cuidado e resistência dentro das cidades. O Terreiro da Casa Branca, em Salvador, foi o primeiro tombado pelo Iphan, em 1986. Essas religiões influenciam a música, a língua, as festas e a culinária, como o acarajé das baianas, e inspiram o afrofuturismo: para ele, ancestralidade e tecnologia são saberes que se encontram.'},
 {id:'004',kind:'arte',title:'Arte que atravessa o tempo',tag:'ARTE AFRO',credit:'MESTRE DIDI · VALENTIM · EL ANATSUI · MUSEU AFRO BRASIL',text:'Mestre Didi uniu escultura e sacerdócio ao criar objetos rituais com nervuras de palmeira, couro e búzios. Rubem Valentim transformou símbolos dos orixás em arte geométrica moderna. O ganense El Anatsui tece tapeçarias monumentais com tampinhas de garrafa. Em São Paulo, o Museu Afro Brasil, idealizado por Emanoel Araújo, reúne milhares de obras sobre a presença africana no país.'},
 {id:'005',kind:'movimentos',title:'Movimentos que reorganizam o mundo',tag:'MOVIMENTOS DA CULTURA AFRO',credit:'NEGRITUDE · HARLEM · MNU · BLOCOS AFRO',text:'A Negritude, de Aimé Césaire e Léopold Senghor, afirmou o orgulho negro a partir dos anos 1930. O Renascimento do Harlem fez de Nova York um laboratório de arte negra nos anos 1920. No Brasil, Abdias Nascimento criou o Teatro Experimental do Negro em 1944, o Movimento Negro Unificado nasceu em 1978 e blocos afro como Ilê Aiyê e Olodum levaram identidade e estética às ruas de Salvador. O termo “afrofuturismo” surgiu em 1993, com Mark Dery.'},
 {id:'006',kind:'subculturas',title:'Subculturas que viram cidade',tag:'SUBCULTURAS E MOVIMENTO AFRO',credit:'HIP-HOP · BLACK RIO · SLAM · SAPEURS · AMAPIANO',text:'O hip-hop nasceu no Bronx, em 1973, e hoje reúne DJs, MCs, breaking e grafite em periferias do mundo todo. O Black Rio, nos anos 1970, levou milhares de jovens a bailes de soul e funk. Saraus como o da Cooperifa, em São Paulo, e batalhas de slam ocupam bares e praças. Dos sapeurs do Congo ao kuduro angolano e ao amapiano sul-africano, cada cena transforma a rua em palco e o futuro em estilo.'}
];
function addArtwork(story,index,side,z) {
 const group=new THREE.Group();group.position.set(side==='left'?-13.15:13.15,4.37,z);group.rotation.y=side==='left'?Math.PI/2:-Math.PI/2;scene.add(group);
 const w=3.45,h=2.62;
 const backing=new THREE.Mesh(new THREE.BoxGeometry(w+.26,h+.26,.22),mat(0x342016,.7,{metalness:.14}));group.add(backing);
 const matArt=new THREE.MeshStandardMaterial({map:artTexture(story.kind),roughness:.85,side:THREE.DoubleSide});story.tex=matArt.map;
 if(story.photo)new THREE.TextureLoader().load(story.photo,(t)=>{t.colorSpace=THREE.SRGBColorSpace;matArt.map=t;matArt.needsUpdate=true;story.tex=t;});
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),matArt);plane.position.z=.124;plane.userData.exhibit=story;plane.userData.kind='art';group.add(plane);exhibits.push(plane);
 const border=.075, zf=.17;
 box('moldura superior',w+.17,border,.10,goldMat,0,h/2+.06,zf,group);
 box('moldura inferior',w+.17,border,.10,goldMat,0,-h/2-.06,zf,group);
 box('moldura esquerda',border,h+.16,.10,goldMat,-w/2-.05,0,zf,group);
 box('moldura direita',border,h+.16,.10,goldMat,w/2+.05,0,zf,group);
 // Plaque below, on the same vertical plane. Its subtle glow supports readability in the warm room.
 const plaque=new THREE.Mesh(new THREE.PlaneGeometry(w,.67),new THREE.MeshStandardMaterial({map:plaqueTexture(story.title,story.tag),roughness:.75,side:THREE.DoubleSide,emissive:0x382213,emissiveIntensity:.18}));
 plaque.position.set(0,-1.83,.13);group.add(plaque);
 const pin=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),goldMat);pin.position.set(-w/2+.14,-1.83,.2);group.add(pin);
 return group;
}
const placements=[['left',18.3],['right',11.0],['left',3.1],['right',-4.8],['left',-12.8],['right',-21.0]];
stories.forEach((s,i)=>addArtwork(s,i,placements[i][0],placements[i][1]));

// Display plinths and abstract, low-poly forms give the galleries an object-scale rhythm.
function addSculpture(x,z,kind=0) {
  obstacles.push({x,z,r:1.02});
  const baseMat=mat(0x7b5a3e,.8), pedestalMat=mat(kind%2?0x383b3b:0x563528,.7);
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.08,1.1),pedestalMat);plinth.position.set(x,.54,z);scene.add(plinth);
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.22,.09,1.22),goldMat);top.position.set(x,1.1,z);scene.add(top);
  const foot=cyl(.25,.35,.27,baseMat,x,1.28,z,12);
  if(kind%3===0){
    const torso=new THREE.Mesh(new THREE.IcosahedronGeometry(.47,1),mat(0x9e5a37,.66,{metalness:.13}));torso.position.set(x,1.95,z);torso.scale.set(.68,1.4,.62);torso.rotation.z=.12;scene.add(torso);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.055,8,28),goldMat);ring.position.set(x,2.03,z);ring.rotation.x=Math.PI/2.7;ring.rotation.y=.4;scene.add(ring);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.19,12,8),mat(0xd6b579,.42,{metalness:.4}));orb.position.set(x+.06,2.78,z);scene.add(orb);
  }else if(kind%3===1){
    const ring1=new THREE.Mesh(new THREE.TorusGeometry(.4,.12,8,24),mat(0x405b59,.5,{metalness:.12}));ring1.position.set(x,1.72,z);ring1.rotation.x=.35;ring1.rotation.y=.5;scene.add(ring1);
    const ring2=new THREE.Mesh(new THREE.TorusGeometry(.3,.095,8,24),mat(0xb86642,.56,{metalness:.12}));ring2.position.set(x,2.25,z);ring2.rotation.x=1.25;ring2.rotation.y=-.5;scene.add(ring2);
    const orb=new THREE.Mesh(new THREE.OctahedronGeometry(.34,0),goldMat);orb.position.set(x,2.78,z);orb.rotation.set(.3,.8,.2);scene.add(orb);
  }else{
    const tall=new THREE.Mesh(new THREE.CylinderGeometry(.13,.31,1.62,7),mat(0x35504e,.67));tall.position.set(x,2.0,z);tall.rotation.z=.08;scene.add(tall);
    const disc=new THREE.Mesh(new THREE.TorusGeometry(.37,.07,8,22),goldMat);disc.position.set(x,2.8,z);scene.add(disc);
    const small=new THREE.Mesh(new THREE.DodecahedronGeometry(.23,0),mat(0xb65e3c,.55));small.position.set(x+.14,3.18,z);small.rotation.set(.3,.3,.5);scene.add(small);
  }
}
addSculpture(-4.9,8.0,0);addSculpture(4.8,-1.5,1);addSculpture(-4.7,-12.0,2);

// Low planters with broad-leaf silhouettes, built from inexpensive primitives.
function addPlant(x,z,variant=0){
 obstacles.push({x,z,r:.72});
 const potMat=mat(variant?0x944a32:0x5b3926,.9);
 const pot=cyl(.46,.57,.68,potMat,x,.34,z,12);pot.scale.z=1.0;
 cyl(.49,.49,.09,goldMat,x,.67,z,12);
 const trunk=cyl(.055,.085,1.35,mat(0x67472c,.95),x,1.33,z,7);trunk.rotation.z=(variant?.12:-.1);
 for(let i=0;i<7;i++){
  const leaf=new THREE.Mesh(new THREE.SphereGeometry(.18,7,5),mat(i%2?0x4d674a:0x69794f,.9));
  leaf.position.set(x+Math.cos(i*2.4)*(.35+((i%2)*.1)),1.75+(i%3)*.25,z+Math.sin(i*2.4)*(.32+((i%2)*.1)));
  leaf.scale.set(.55,1.8,.38);leaf.rotation.z=Math.cos(i*2.4)*.55;scene.add(leaf);
 }
}
addPlant(-9.4,21,0);addPlant(9.3,17,1);addPlant(-9.4,-4,1);addPlant(9.3,-9,0);addPlant(-9.4,-23,0);addPlant(9.3,-23,1);

// Small niches and warm light fittings along the walls.
for(const z of [20,12,4,-4,-12,-20]){
  for(const side of [-1,1]){
    box('nicho escuro',.06,1.35,1.05,darkMat,side*13.18,5.15,z);
    box('luz de parede',.07,.76,.22,mat(0xf2c17f,.4,{emissive:0xff9842,emissiveIntensity:1.15}),side*13.08,5.17,z);
    box('filete do nicho',.08,1.48,.055,goldMat,side*13.08,5.15,z-.53);
    box('filete do nicho',.08,1.48,.055,goldMat,side*13.08,5.15,z+.53);
  }
}
// Intro sign, readable when visitors turn toward the entrance.
const signTex=canvasTexture((ctx,w,h)=>{
 ctx.fillStyle='#281a12';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d5ae6d';ctx.lineWidth=5;ctx.strokeRect(14,14,w-28,h-28);ctx.fillStyle='#ddc6a4';ctx.textAlign='center';ctx.font='600 65px Georgia';ctx.fillText('ORI',w/2,95);ctx.font='19px monospace';ctx.fillStyle='#c79b66';ctx.fillText('AFROFUTURISMO · CIDADES',w/2,132);ctx.strokeStyle='#9a5a3d';ctx.beginPath();ctx.moveTo(w*.2,h-30);ctx.lineTo(w*.8,h-30);ctx.stroke();
},512,170,1,1);
const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.2,1.4),new THREE.MeshStandardMaterial({map:signTex,roughness:.8,side:THREE.DoubleSide,emissive:0x28160d,emissiveIntensity:.18}));sign.position.set(0,6.4,26.72);sign.rotation.y=Math.PI;scene.add(sign);

// JARDIM DA MEMÓRIA — um pátio a céu aberto, ligado organicamente à galeria.
// Formas geométricas, terra, vegetação e água são criadas com primitivas leves.
const skyTexture = canvasTexture((ctx,w,h)=>{
 const grad=ctx.createLinearGradient(0,0,0,h);
 grad.addColorStop(0,'#1d1448'); grad.addColorStop(.44,'#b04a7d'); grad.addColorStop(1,'#f0a35e');
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);ctx.fillStyle="#fff";for(let i=0;i<170;i++)ctx.fillRect(seeded(i+200)*w,seeded(i+400)*h*.5,1.6,1.6);
 for(let i=0;i<9;i++){
  const y=h*(.16+i*.06), x=w*(.06+seeded(i+3)*.84);
  ctx.globalAlpha=.05+seeded(i+19)*.08;ctx.fillStyle='#fff0d2';
  ctx.beginPath();ctx.ellipse(x,y,w*(.05+seeded(i+27)*.05),h*(.012+seeded(i+41)*.012),0,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
},1024,512,1,1);
const sky = new THREE.Mesh(new THREE.SphereGeometry(100,24,16),new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,depthWrite:false,fog:false}));
sky.position.set(0,8,-48);scene.add(sky);
// Ground and geometric path outside the museum.
const gardenGroundTex=canvasTexture((ctx,w,h)=>{
 ctx.fillStyle='#9c7958';ctx.fillRect(0,0,w,h);
 for(let i=0;i<4200;i++){
  const x=(i*97)%w,y=(i*193)%h;
  ctx.fillStyle=i%3?'rgba(52,34,20,.055)':'rgba(245,213,162,.10)';ctx.fillRect(x,y,1+i%3,1+i%2);
 }
 for(let x=0;x<w;x+=96){ctx.strokeStyle='rgba(58,35,20,.11)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
},768,768,4,6);
const gardenGround = new THREE.Mesh(new THREE.PlaneGeometry(72,72),new THREE.MeshStandardMaterial({map:gardenGroundTex,roughness:1}));
gardenGround.rotation.x=-Math.PI/2;gardenGround.position.set(0,-.035,-58);scene.add(gardenGround);
// A long stone promenade leads from the portal towards a shallow reflecting pool.
const pathMat = new THREE.MeshStandardMaterial({map:floorTex,roughness:.91});
const gardenPath = new THREE.Mesh(new THREE.PlaneGeometry(7.6,53),pathMat);gardenPath.rotation.x=-Math.PI/2;gardenPath.position.set(0,.006,-56.3);scene.add(gardenPath);
for(let x of [-3.92,3.92]){
 box('bordadura do caminho',.12,.08,53,goldMat,x,.035,-56.3);
}
// Geometric reflecting pool, with a quiet blue-green surface and a stone edge.
const poolX=0,poolZ=-49.2,poolW=6.0,poolL=11.0;
box('base da piscina',poolW+.55,.28,poolL+.55,stoneMat,poolX,.02,poolZ);
const waterMat=mat(0x456b6a,.24,{metalness:.22,transparent:true,opacity:.9,emissive:0x163b38,emissiveIntensity:.16});
const water=new THREE.Mesh(new THREE.PlaneGeometry(poolW,poolL),waterMat);water.rotation.x=-Math.PI/2;water.position.set(poolX,.18,poolZ);scene.add(water);
for(const x of [-poolW/2-.2,poolW/2+.2]) box('borda lateral da piscina',.28,.28,poolL+.6,goldMat,x,.14,poolZ);
for(const z of [poolZ-poolL/2-.2,poolZ+poolL/2+.2]) box('borda transversal da piscina',poolW+.6,.28,.28,goldMat,0,.14,z);
obstacles.push({x:0,z:poolZ,hx:3.3,hz:5.8});
// Two open colonnades frame the garden without fencing in the visitor.
for(const side of [-1,1]){
 for(const z of [-35,-44,-54,-64,-73]){
  const x=side*13.3;
  cyl(.26,.31,4.6,plasterMat,x,2.3,z,12);
  cyl(.38,.38,.18,trimMat,x,.14,z,12);
  cyl(.34,.35,.15,goldMat,x,4.55,z,12);
  box('viga da colunata',.34,.26,9.15,woodMat,side*13.3,4.77,(z+Math.max(-80,z-9))/2);
 }
}
// Sculptural canopy tree: stylized, contemporary and deliberately not tied to a single people.
function addMemoryTree(x,z,scale=1){
 const bark=mat(0x5a3927,.94),leafA=mat(0x445b42,.95),leafB=mat(0x65734b,.93),leafC=mat(0x827b4c,.96);
 obstacles.push({x,z,r:2.2*scale});
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.48*scale,.82*scale,5.2*scale,9),bark);trunk.position.set(x,2.6*scale,z);trunk.rotation.z=-.07;scene.add(trunk);
 for(let i=0;i<5;i++){
  const root=new THREE.Mesh(new THREE.ConeGeometry(.48*scale,2.05*scale,5),bark);
  root.position.set(x+Math.cos(i*1.256)*.75*scale,.58*scale,z+Math.sin(i*1.256)*.75*scale);root.rotation.z=Math.cos(i*1.256)*.43;root.rotation.x=Math.sin(i*1.256)*.25;scene.add(root);
 }
 for(let i=0;i<9;i++){
  const a=i*Math.PI*2/9,r=(1.0+seeded(i+7)*.45)*scale;
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry((1.45+seeded(i+20)*.5)*scale,1),i%3===0?leafC:(i%2?leafA:leafB));
  crown.position.set(x+Math.cos(a)*r,4.65*scale+seeded(i+40)*1.5*scale,z+Math.sin(a)*r);crown.scale.set(1.12,0.78,1.0);scene.add(crown);
 }
}
addMemoryTree(-9,-43,1.0);addMemoryTree(10,-63,.86);addMemoryTree(0,-75,1.08);
// Large abstract memorial rings and a basalt-toned monolith create a final destination.
const memorialBase=mat(0x4b3326,.85),memorialDark=mat(0x2d3634,.7,{metalness:.12});
const memorial=new THREE.Mesh(new THREE.BoxGeometry(1.65,3.9,1.05),memorialDark);memorial.position.set(0,1.95,-78);memorial.rotation.y=.12;scene.add(memorial);obstacles.push({x:0,z:-78,r:1.6});
for(let i=0;i<3;i++){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05+i*.38,.085,10,40),i===1?goldMat:mat(i===0?0xb85f3c:0x65746a,.46,{metalness:.18}));
 ring.position.set(0,2.05+i*.55,-77.45);ring.rotation.y=(i-1)*.22;ring.rotation.x=.14+i*.25;scene.add(ring);
}
// Low garden lanterns cast small warm pools of light at the edges of the route.
for(const side of [-1,1]) for(const z of [-36,-47,-59,-71]){
 const x=side*6.3;
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,.68,8),woodMat);stem.position.set(x,.34,z);scene.add(stem);
 const lantern=new THREE.Mesh(new THREE.BoxGeometry(.3,.22,.3),mat(0xffd29a,.38,{emissive:0xff9c4b,emissiveIntensity:1.25}));lantern.position.set(x,.79,z);scene.add(lantern);
 const halo=new THREE.Mesh(new THREE.TorusGeometry(.23,.025,6,18),goldMat);halo.position.set(x,.79,z);halo.rotation.x=Math.PI/2;scene.add(halo);
 const glow=new THREE.PointLight(0xffb46c,3.8,4,2);glow.position.set(x,.95,z);scene.add(glow);
}
// Entry marker for the outdoor chapter.
const gardenSignTex=canvasTexture((ctx,w,h)=>{
 ctx.fillStyle='#2a1a12';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d6af70';ctx.lineWidth=4;ctx.strokeRect(12,12,w-24,h-24);
 ctx.textAlign='center';ctx.fillStyle='#f0d8b1';ctx.font='600 39px Georgia';ctx.fillText('JARDIM DA MEMÓRIA',w/2,57);
 ctx.fillStyle='#caa170';ctx.font='16px monospace';ctx.fillText('TERRITÓRIO · PRESENÇA · FUTURO',w/2,91);
},640,120,1,1);
const gardenSign=new THREE.Mesh(new THREE.PlaneGeometry(5.3,1.0),new THREE.MeshStandardMaterial({map:gardenSignTex,roughness:.8,side:THREE.DoubleSide,emissive:0x24170d,emissiveIntensity:.12}));gardenSign.position.set(0,5.6,-30.2);scene.add(gardenSign);

const ROOMS=['ATELIÊ DOS ARQUITETOS','GALERIA DOS PERSONAGENS','SALÃO DA RELIGIOSIDADE','OFICINA DA ARTE AFRO','PRAÇA DOS MOVIMENTOS','QUEBRADA FUTURA'];
let lastRoom=0,lastGarden=null;
function updateRoom() {
 const z=camera.position.z,n=z>14.8?1:z>7.2?2:z>-0.8?3:z>-8.9?4:z>-16.9?5:6,garden=z<-29;
 if(n===lastRoom&&garden===lastGarden)return;lastRoom=n;lastGarden=garden;
 ui.room.textContent=garden?'JARDIM DA MEMÓRIA':ROOMS[n-1];ui.progress.textContent=`${String(n).padStart(2,'0')} / 06`;ui.fill.style.width=`${n/6*100}%`;
 document.querySelectorAll('.map-stop').forEach((el,i)=>el.classList.toggle('active',i===n-1));
}
function openExhibit(story){
 if(!story)return;state.cardOpen=true;ui.exhibitEyebrow.textContent=`TEMA ${+story.id} DE 6 · ${story.tag}`;ui.exhibitTitle.textContent=story.title;ui.exhibitText.textContent=story.text;{const im=story.tex?.image;ui.exhibitImg.src=im?.toDataURL?im.toDataURL('image/jpeg',.86):(im?.src||'');ui.exhibitImg.alt='Ilustração do tema: '+story.title;}ui.exhibitCredit.textContent=story.credit;ui.exhibit.classList.add('visible');ui.hint.classList.remove('visible');document.exitPointerLock?.();
}
function closeExhibit(){state.cardOpen=false;ui.exhibit.classList.remove('visible');}
function openMap(){state.mapOpen=true;ui.map.classList.add('visible');document.exitPointerLock?.();}
function closeMap(){state.mapOpen=false;ui.map.classList.remove('visible');}
function openHelp(){state.helpOpen=true;ui.help.classList.add('visible');document.exitPointerLock?.();}
function closeHelp(){state.helpOpen=false;ui.help.classList.remove('visible');}
function startVisit(){
 state.started=true;ui.welcome.classList.add('hidden');ui.hud.classList.add('visible');ui.reticle.classList.add('visible');
 if(isTouch){ui.mobilePad.classList.add('visible');ui.lookTip.style.display='block';ui.controls.classList.add('hidden');}
 else{ui.controls.classList.remove('hidden');try{renderer.domElement.requestPointerLock?.();}catch(_){}}
 setTimeout(()=>ui.loading.classList.add('done'),180);
}
function maybeLock(){if(state.started&&!isTouch&&!state.cardOpen&&!state.mapOpen&&!state.helpOpen)try{renderer.domElement.requestPointerLock?.();}catch(_){}}
function updateTarget(){
 if(!state.started||state.cardOpen||state.mapOpen||state.helpOpen){ui.hint.classList.remove('visible');ui.touchInteract.classList.remove('visible');state.target=null;return;}
 raycaster.setFromCamera(center,camera);
 const hits=raycaster.intersectObjects(exhibits,false);const hit=hits.find(h=>h.distance<8.5);
 state.target=hit?.object?.userData?.exhibit||null;
 ui.hint.classList.toggle('visible',!!state.target&&!isTouch);
 ui.touchInteract.classList.toggle('visible',!!state.target&&isTouch);
 if(state.target)ui.exhibitTitle.dataset.peek=state.target.title;
}

$('mapBtn').addEventListener('click',openMap);ui.closeMap.addEventListener('click',closeMap);
ui.closeExhibit.addEventListener('click',closeExhibit);ui.helpBtn.addEventListener('click',openHelp);ui.closeHelp.addEventListener('click',closeHelp);ui.resume.addEventListener('click',closeHelp);
ui.enter.addEventListener('click',startVisit);ui.touchInteract.addEventListener('click',()=>{if(state.target)openExhibit(state.target);});
ui.qualityBtn.addEventListener('click',()=>{
 state.lowQuality=!state.lowQuality;renderer.setPixelRatio(state.lowQuality?Math.min(window.devicePixelRatio||1,0.85):Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(window.innerWidth,window.innerHeight);
 ui.toast.innerHTML=`QUALIDADE GRÁFICA: <b>${state.lowQuality?'ECONÔMICA':'ALTA'}</b>`;ui.toast.classList.add('visible');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>ui.toast.classList.remove('visible'),1800);
});
renderer.domElement.addEventListener('click',()=>{if(state.started&&!isTouch&&!state.cardOpen&&!state.mapOpen&&!state.helpOpen&&!state.locked)maybeLock();});
document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===renderer.domElement;});
document.addEventListener('mousemove',(e)=>{if(state.locked&&state.started){state.yaw-=e.movementX*.0022;state.pitch-=e.movementY*.0018;state.pitch=THREE.MathUtils.clamp(state.pitch,-1.13,1.13);}});

window.addEventListener('keydown',(e)=>{
 const k=e.key.toLowerCase();keys[e.code]=true;
 if(e.code.startsWith('Arrow')||k===' ')e.preventDefault();
 const free=state.started&&!state.cardOpen&&!state.mapOpen&&!state.helpOpen;
 if(!e.repeat&&(k==='e'||k==='f')&&free&&state.target)openExhibit(state.target);
 if(k==='escape'){if(state.cardOpen)closeExhibit();else if(state.mapOpen)closeMap();else if(state.helpOpen)closeHelp();}
 if(!e.repeat&&k==='m'&&state.started){state.mapOpen?closeMap():openMap();}
});
window.addEventListener('keyup',(e)=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;for(const k in touchMoves)touchMoves[k]=false;});

// Arrastar para olhar: toque na tela ou mouse quando o cursor não está travado (alternativa ao pointer lock).
renderer.domElement.addEventListener('pointerdown',(e)=>{
 if(!state.started||state.locked||state.cardOpen||state.mapOpen||state.helpOpen)return;
 state.dragging=true;state.lastX=e.clientX;state.lastY=e.clientY;
});
window.addEventListener('pointermove',(e)=>{
 if(!state.dragging||state.locked)return;
 const k=isTouch?.004:.0032;
 state.yaw-=(e.clientX-state.lastX)*k;state.pitch-=(e.clientY-state.lastY)*k*.75;
 state.lastX=e.clientX;state.lastY=e.clientY;state.pitch=THREE.MathUtils.clamp(state.pitch,-1.1,1.1);
});
for(const ev of ['pointerup','pointercancel'])window.addEventListener(ev,()=>{state.dragging=false;});
for(const button of ui.mobilePad.querySelectorAll('button[data-move]')){
 const name=button.dataset.move;
 button.addEventListener('pointerdown',(e)=>{e.preventDefault();touchMoves[name]=true;button.setPointerCapture?.(e.pointerId);});
 const stop=(e)=>{e.preventDefault();touchMoves[name]=false;};button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',()=>{touchMoves[name]=false;});
}

// MOVIMENTO: frente = (-sen yaw, -cos yaw); direita = (cos yaw, -sen yaw). Aceleração suave e colisão com deslizamento.
const vel={x:0,z:0};
function blocked(x,z){
 const lim=z<-29.6?22:10;
 if(Math.abs(x)>lim||z>25.2||z<-81)return true;
 return z<-28.4&&z>-29.6&&Math.abs(x)>3.5; // parede do fundo: só o portal central passa
}
function stepPlayer(dt){
 const K=keys,T=touchMoves;
 const f=(K.KeyW||K.ArrowUp||T.forward?1:0)-(K.KeyS||K.ArrowDown||T.back?1:0);
 const s=(K.KeyD||T.right?1:0)-(K.KeyA||T.left?1:0);
 state.yaw+=((K.ArrowLeft?1:0)-(K.ArrowRight?1:0))*1.9*dt;
 const n=Math.hypot(f,s)||1,speed=K.ShiftLeft||K.ShiftRight?6.2:3.8,sy=Math.sin(state.yaw),cy=Math.cos(state.yaw),ease=1-Math.exp(-11*dt);
 vel.x+=((-sy*f+cy*s)/n*speed-vel.x)*ease;vel.z+=((-cy*f-sy*s)/n*speed-vel.z)*ease;
 const p=camera.position;let x=p.x+vel.x*dt,z=p.z+vel.z*dt;
 if(blocked(x,p.z)){x=p.x;vel.x=0;}
 if(blocked(x,z)){z=p.z;vel.z=0;}
 for(const o of obstacles){
  const dx=x-o.x,dz=z-o.z;
  if(o.hx){const px=o.hx+.35-Math.abs(dx),pz=o.hz+.35-Math.abs(dz);if(px>0&&pz>0){if(px<pz)x+=Math.sign(dx||1)*px;else z+=Math.sign(dz||1)*pz;}}
  else{const d=Math.hypot(dx,dz),r=o.r+.25;if(d<r){const k=d>1e-4?r/d:0;x=o.x+(d>1e-4?dx*k:r);z=o.z+(d>1e-4?dz*k:0);}}
 }
 p.x=x;p.z=z;p.y=1.68+Math.sin(performance.now()*.0065)*.02*Math.min(1,Math.hypot(vel.x,vel.z)/3.8);
 camera.rotation.set(state.pitch,state.yaw,0);
}
const clock=new THREE.Clock();
function animate(){
 requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.035);
 if(state.started&&!state.cardOpen&&!state.mapOpen&&!state.helpOpen){
  stepPlayer(dt);
  updateTarget();updateRoom();
 }
 const t=performance.now()*.001;
 poolsOfLight.forEach((l,i)=>{l.intensity=25+Math.sin(t*.75+i*.8)*1.5;});
 renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});

updateRoom();animate();
// Avoid showing a frozen splash if a low-end device takes an extra moment to compile shaders.
setTimeout(()=>ui.loading.classList.add('done'),1300);
