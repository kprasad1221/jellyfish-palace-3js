import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { Reflector } from '../vendor/Reflector.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { palaceFloorShader, pearlMembrane, strandMaterial, mineralTexture, grownStone, dropletTexture } from './palace-materials.js';
import { PalaceAtmosphere } from './palace-atmosphere.js';

const TAU=Math.PI*2, V=(x,y,z)=>new THREE.Vector3(x,y,z);
let seed=470; const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const pearl = new THREE.Color('#dfdce0');
const softGold = new THREE.Color('#edcea0');
const amber = new THREE.Color('#ff9e3e');
const coolPearl = new THREE.Color('#b8cad9');
const jellyGold = new THREE.Color('#ffac78');
const tide = new THREE.Color('#3ee8d8');
const silver = new THREE.Color('#eadfff');
const membrane = pearlMembrane;
function tube(points,radius,material,segments=32){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,radius,5,false),material);}
// Taper the supporting branches into the canopy so their ends disappear in its rim.
function branch(points, rootRadius, tipRadius, material, segments = 32) {
  const curve = new THREE.CatmullRomCurve3(points);
  const sides = 7;
  const geometry = new THREE.TubeGeometry(curve, segments, rootRadius, sides, false);
  const positions = geometry.getAttribute('position');
  const center = new THREE.Vector3(), vertex = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments;
    curve.getPointAt(t,center);
    const scale = THREE.MathUtils.lerp(1, tipRadius/rootRadius, t*t*(3-2*t));
    for (let j = 0; j <= sides; j++) {
      const index = ring*(sides+1)+j;
      vertex.fromBufferAttribute(positions,index).sub(center).multiplyScalar(scale).add(center);
      positions.setXYZ(index,vertex.x,vertex.y,vertex.z);
    }
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
function lathe(profile,segments=64){return new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),segments);}
// Merge the static siblings that share a material, preserving independently animated groups.
function batchGroup(group){
  const batches=new Map();
  for(const obj of [...group.children]){
    if(!obj.isMesh&&!obj.isLine)continue;
    const key=obj.type+':'+obj.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(obj);
  }
  for(const objects of batches.values()){
    if(objects.length<2)continue;const first=objects[0],geometries=[];
    for(const obj of objects){obj.updateMatrix();let geo=obj.geometry.clone();geo.applyMatrix4(obj.matrix);
      if(obj.isLine&&!obj.isLineSegments){const a=geo.getAttribute('position'),p=[];for(let i=0;i<a.count-1;i++)p.push(a.getX(i),a.getY(i),a.getZ(i),a.getX(i+1),a.getY(i+1),a.getZ(i+1));geo.dispose();geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));}
      geometries.push(geo);
    }
    const merged=mergeGeometries(geometries);if(!merged)continue;const obj=first.isMesh?new THREE.Mesh(merged,first.material):new THREE.LineSegments(merged,first.material);group.add(obj);objects.forEach(o=>group.remove(o));geometries.forEach(g=>g.dispose());
  }
}

export class Palace{
  constructor(container){
    this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#031017');this.scene.fog=new THREE.FogExp2('#03171e',.0185);
    this.mobile=innerWidth<700;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.3:1.65));this.renderer.setSize(innerWidth,innerHeight);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    container.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Drag to look around the palace; use WASD to move');this.renderer.domElement.tabIndex=0;
    this.camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.08,130);this.camera.position.set(0,3.6,14);this.yaw=0;this.pitch=.045;this.targetYaw=0;this.targetPitch=.045;
    this.scene.add(new THREE.HemisphereLight('#7ab4c0','#102124',1.25));const sun=new THREE.DirectionalLight('#f4cf9d',2.5);this.keyLight=sun;sun.position.set(-3,12,5);this.scene.add(sun);
    const cool=new THREE.DirectionalLight('#3a9eac',1.6);cool.position.set(8,4,-20);this.scene.add(cool);
    this.bays=[];this.jellies=[];this.filaments=[];this.lights=[];this.ambientTime=0;this.elapsed=0;this.drifts=true;this.mood=0;this.moodTarget=0;this.pointer=new THREE.Vector2();this.hoverPointer=new THREE.Vector2();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.makeFloor();this.makeArchitecture();this.makeDetails();this.makeJellies();this.makeParticles();
    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.29,0,1.04);
    // Keep halos close to the beads and ribs, leaving dark water between them.
    this.bloom.compositeMaterial.uniforms.bloomFactors.value=[1,.56,.20,.045,.008];
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.keys=new Set();this.bindControls();this.resize();
    addEventListener('resize',()=>this.resize());
  }
  makeFloor(){
    const floor=new Reflector(new THREE.PlaneGeometry(43,105),{clipBias:.003,textureWidth:1024,textureHeight:1024,multisample:4,color:0x173b3e,shader:palaceFloorShader});
    floor.rotation.x=-Math.PI/2;floor.position.set(0,-.07,-31);this.scene.add(floor);this.reflector=floor;this.floorMaterial=floor.material;
    const sideMat=new THREE.MeshStandardMaterial({color:'#29403f',roughness:.69,metalness:.17});
    for(const side of [-1,1]){
      const plinth=new THREE.Mesh(new THREE.BoxGeometry(.17,.055,90),sideMat);plinth.position.set(side*7.7,-.052,-30);this.scene.add(plinth);
      const lip=new THREE.Mesh(new THREE.BoxGeometry(.018,.012,90),new THREE.MeshBasicMaterial({color:'#8b9d80',transparent:true,opacity:.35}));lip.position.set(side*7.7,-.021,-30);this.scene.add(lip);
    }
  }
  makeArchitecture(){
    this.stoneLight = { tide: { value: 0 }, crown: { value: 0 } };
    const stone = grownStone(mineralTexture(), this.stoneLight);
    this.stoneMaterial = stone;
    this.dropletMap = dropletTexture();
    const ribMat=new THREE.MeshStandardMaterial({color:'#bca581',roughness:.34,metalness:.55,emissive:'#395458',emissiveIntensity:.28});
    const crownMetal = new THREE.MeshStandardMaterial({color:'#ae864b',metalness:.43,roughness:.36,emissive:'#ffb258',emissiveIntensity:.19});
    this.crownMetal = crownMetal;
    const capGeometry=lathe([[0,2.45],[.4,2.42],[.95,2.26],[1.65,1.95],[2.35,1.47],[2.95,.91],[3.4,.37],[3.55,0],[3.48,-.08]],80);
    const trunkGeometry=lathe([[1.12,0],[.82,.18],[.44,.6],[.29,1.4],[.235,3],[.25,5.8],[.41,6.85],[.56,7.28],[.35,7.57],[.04,7.88]],34);
    for(let n=0;n<9;n++){
      const z=6-n*8.3, group=new THREE.Group(), emission=new THREE.MeshStandardMaterial({color:'#7e9c8a',metalness:.25,roughness:.38,emissive:'#90ddd0',emissiveIntensity:.18});
      const gold=new THREE.LineBasicMaterial({color:softGold,transparent:true,opacity:.4});
      const capmat=membrane(true),bay={group,z,emission,gold,capmat,lines:[],light:null};
      for(const s of [-1,1]){
        const x=s*5.6;const stem=new THREE.Mesh(trunkGeometry,stone);stem.position.set(x,0,z);group.add(stem);
        for(let j=0;j<9;j++){
          const a=j*TAU/9,rad=1.3+.4*rnd();
          const pts=[V(x+Math.cos(a)*rad,.02,z+Math.sin(a)*rad),V(x+Math.cos(a)*.75,.35,z+Math.sin(a)*.75),V(x+Math.cos(a)*.29,1.4,z+Math.sin(a)*.29),V(x+Math.cos(a)*.22,4.1,z+Math.sin(a)*.22),V(x+Math.cos(a)*.45,6.7,z+Math.sin(a)*.45),V(x+Math.cos(a)*1.65,7.5,z+Math.sin(a)*1.65),V(x+Math.cos(a)*3.49,7.79,z+Math.sin(a)*3.49)];
          group.add(branch(pts,.05,.012,j%3===0?emission:ribMat,26));
        }
        const bell=new THREE.Mesh(capGeometry,capmat);bell.position.set(x,7.8,z);group.add(bell);
        for(let j=0;j<40;j++){
          const a=j*TAU/40,pts=[];
          for(let k=0;k<=22;k++){const u=k/22,r=3.5*Math.sin(u*Math.PI/2),y=7.8+2.45*Math.pow(Math.cos(u*Math.PI/2),1.1);pts.push(V(x+Math.cos(a)*r,y,z+Math.sin(a)*r));}
          const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gold);group.add(l);
        }
        const rim=new THREE.Mesh(new THREE.TorusGeometry(3.5,.026,5,80),emission);rim.rotation.x=Math.PI/2;rim.position.set(x,7.8,z);group.add(rim);
        const core=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),emission);core.position.set(x,9.75,z);core.scale.y=2;group.add(core);
        // Broad shoulders support the rim. The smaller central branch grows into
        // the split-lobed crown silhouetted against the illuminated membrane.
        for (const fork of [-1, 1]) {
          const shoulder = [V(x,5.5,z), V(x+fork*.23,6.74,z+.06),
            V(x+fork*.77,7.41,z+.13), V(x+fork*1.92,7.64,z+.18), V(x+fork*3.49,7.79,z+.02)];
          group.add(branch(shoulder,.175,.023,stone,32));
          group.add(branch(shoulder.map((p,i) => V(p.x,p.y+.08*(1-i/4),p.z+.047*(1-i/4))),.043,.009,emission,28));
          // The crest lies on the front of each membrane, following its curved skin.
          const crestProfile = [[0,7.80,3.50],[.45,8.05,3.45],[.49,8.62,3.05],
            [.34,8.91,2.78],[.71,9.07,2.61],[.60,9.31,2.30],[.18,9.50,2.02],[0,9.52,2.0]];
          const crest = crestProfile.map(([dx,y,r]) => V(x+fork*dx,y,z+Math.sqrt(r*r-dx*dx)+.105));
          group.add(branch(crest,.104,.054,crownMetal,48));
          group.add(branch(crest.map(p => V(p.x,p.y+.016,p.z+.059)),.026,.015,ribMat,44));
        }
        // Lengthwise arches enclose the side aisles without closing off the sea.
        if(n<8){const pts=[V(x,4.7,z),V(x,8.2,z-1.2),V(x,10.3,z-4.15),V(x,8.2,z-7.1),V(x,4.7,z-8.3)];group.add(tube(pts,.105,stone,32));for(const offset of [-.16,.16])group.add(tube(pts.map(p=>V(p.x+offset,p.y,p.z)),.017,emission,32));}
      }
      const archPoints=[V(-5.6,2,z),V(-5.6,6.7,z),V(-4.9,9.2,z),V(-2.6,10.8,z),V(0,11.8,z),V(2.6,10.8,z),V(4.9,9.2,z),V(5.6,6.7,z),V(5.6,2,z)];
      group.add(tube(archPoints,.17,stone,56));
      for(let j=-2;j<=2;j++)group.add(tube(archPoints.map(p=>V(p.x*(1+j*.012),p.y+j*.06,p.z+j*.085)),.023,j===0?emission:ribMat,48));
      // Fine arch tracery: lace in the corners and crown.
      for(const s of [-1,1])for(let j=0;j<5;j++){
        const u=j/4,pts=[V(s*5.55,4.7+u,z),V(s*(5.1-u*.8),8.6,z+.12),V(s*(3.5-u*1.3),10.1+u*.6,z)];group.add(tube(pts,.018,ribMat,24));
      }
      if(n<5){const light=new THREE.PointLight('#e6c08d',25,17,1.4);light.position.set(0,8.8,z);group.add(light);bay.light=light;}
      this.makeCurtain(group,z,n);batchGroup(group);this.scene.add(group);this.bays.push(bay);
    }
    // Receding ribs keep the roof connected between the bays.
    for(let j=-3;j<=3;j++){const p=[];for(let n=0;n<=72;n++){const z=9-n*1.1;p.push(V(j*1.5,11.7-Math.abs(j)*.33+.08*Math.sin(n*.8),z));}this.scene.add(tube(p,.035,ribMat,80));}
    // Dark, softly lit end wall gives the central axis a destination.
    const end=new THREE.Mesh(new THREE.PlaneGeometry(34,30),new THREE.MeshBasicMaterial({color:'#05161d'}));end.position.set(0,10,-73);this.scene.add(end);
    const portalMat=new THREE.MeshBasicMaterial({color:'#8dc3bd',transparent:true,opacity:.45});
    this.scene.add(tube([V(-3,0,-71),V(-3,5,-71),V(-2,8,-71),V(0,9,-71),V(2,8,-71),V(3,5,-71),V(3,0,-71)],.07,portalMat,48));
  }
  makeDetails(){
    const group=new THREE.Group();
    const bronze=new THREE.MeshStandardMaterial({color:'#b4a17c',metalness:.62,roughness:.32});
    const rimPearl = new THREE.MeshStandardMaterial({color:'#f5dcc4',emissive:'#ffe0ac',emissiveIntensity:.46,roughness:.23,metalness:.24});
    const branchPearl = new THREE.MeshStandardMaterial({color:'#cce9e0',emissive:'#64fce4',emissiveIntensity:.35,roughness:.22,metalness:.19});
    this.rimPearl = rimPearl;
    this.branchPearl = branchPearl;
    const gem = new THREE.SphereGeometry(.052, 7, 5);
    const beads = new THREE.InstancedMesh(gem, rimPearl, 9*2*32);
    const branchBeads = new THREE.InstancedMesh(gem, branchPearl, 9*2*36);
    const transform = new THREE.Object3D();
    let index=0, branchIndex=0;
    for(let n=0;n<9;n++)for(const side of [-1,1]){
      const x=side*5.6,z=6-n*8.3;
      // A rooted, grown transition from the pillar to the reflective stone.
      for(let k=0;k<8;k++){
        const a=k*TAU/8,reach=1.6+.4*rnd();
        const pts=[V(x+Math.cos(a)*reach,.015,z+Math.sin(a)*reach),V(x+Math.cos(a)*.9,.14,z+Math.sin(a)*.9),V(x+Math.cos(a)*.42,.66,z+Math.sin(a)*.42),V(x+Math.cos(a)*.24,2.2,z+Math.sin(a)*.24)];
        group.add(tube(pts,.065,this.stoneMaterial,20));
        group.add(tube(pts.map(p=>V(p.x+.03,.025+p.y,p.z+.025)),.012,bronze,18));
      }
      for(let k=0;k<32;k++){
        const a=k*TAU/32;transform.position.set(x+Math.cos(a)*3.49,7.77,z+Math.sin(a)*3.49);transform.scale.set(1,1.4+(k%3)*.4,1);transform.updateMatrix();beads.setMatrixAt(index++,transform.matrix);
      }
      // Three strands of embedded pearls follow the trunk into its branches. The
      // two sides use the same locations, including the gaps between clusters.
      for (let strand = 0; strand < 3; strand++) {
        for (let bead = 0; bead < 12; bead++) {
          const u = (bead + .5) / 12;
          const y = .38 + 7.19*u + .16*Math.sin(2.1*bead + strand);
          const angle = strand*2.09 + .58*Math.sin(u*5.8 + strand) + .72;
          const radius = .263 + .56*Math.exp(-y*1.5) + .48*Math.max(0, (y-5.9)/1.7);
          transform.position.set(x+side*Math.cos(angle)*radius,y,z+Math.sin(angle)*radius);
          const size = .54 + .61*Math.pow(.5+.5*Math.sin(bead*1.81+strand),2);
          transform.scale.set(size,size*1.5,size);
          transform.updateMatrix();
          branchBeads.setMatrixAt(branchIndex++,transform.matrix);
        }
      }
      // Small scallops join the radial ribs at the canopy's edge.
      for(let k=0;k<16;k++){
        const pts=[];for(let j=0;j<=8;j++){const u=j/8,a=(k+u)*TAU/16,r=3.49+.055*Math.sin(u*Math.PI);pts.push(V(x+Math.cos(a)*r,7.77-.11*Math.sin(u*Math.PI),z+Math.sin(a)*r));}
        group.add(tube(pts,.012,bronze,10));
      }
      const collar=new THREE.Mesh(new THREE.TorusGeometry(.31,.024,6,24),bronze);collar.rotation.x=Math.PI/2;collar.position.set(x,1.7,z);group.add(collar);
    }
    // Three nested arches turn the far threshold into a distinct destination.
    for(let i=0;i<3;i++){
      const z=-68-i*1.35,wide=3.4+i*.32;
      const pts=[V(-wide,0,z),V(-wide,4,z),V(-wide*.74,7,z),V(0,9.1+i*.2,z),V(wide*.74,7,z),V(wide,4,z),V(wide,0,z)];
      group.add(tube(pts,.1,this.stoneMaterial,36));group.add(tube(pts.map(p=>V(p.x,p.y+.1,p.z+.13)),.025,rimPearl,36));
    }
    batchGroup(group);this.scene.add(group,beads,branchBeads);
    // Recessed terraces and distant silhouettes give the open sides a world.
    const seaStone=new THREE.MeshStandardMaterial({color:'#0b292f',roughness:.95,metalness:.05});
    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),seaStone,70);
    for(let i=0;i<70;i++){const side=i%2?1:-1;transform.position.set(side*(12+rnd()*9),-.7+rnd()*.5,15-rnd()*94);transform.scale.set(1+rnd()*2,.6+rnd()*1.7,1.2+rnd()*2.8);transform.rotation.set(rnd(),rnd()*3,rnd());transform.updateMatrix();rocks.setMatrixAt(i,transform.matrix);}this.scene.add(rocks);
  }
  makeCurtain(group,z,bay){
    const sets=[[],[],[]],tips=[[],[],[]];
    const hang = (x,y,depth,length,lean,voice) => {
      const middle = [x+lean*.22,y-length*.54,depth+.018];
      const tip = [x+lean,y-length,depth+.04];
      sets[voice].push(x,y,depth,...middle,...middle,...tip);
      tips[voice].push(...tip);
    };
    // Pairs of filaments have the same root height and length on both sides.
    for (let k=0; k<41; k++) {
      const angle = (k+.5)*TAU/41;
      const length = .46 + 1.35*Math.pow(.5+.5*Math.cos(angle*3.),2) + rnd()*.38;
      for (const side of [-1,1]) hang(side*(5.6+3.49*Math.cos(angle)),7.76,z+3.49*Math.sin(angle),length,side*.06,k%3);
    }
    for (let k=0; k<24; k++) {
      const x = .36 + k*.246;
      const y = 11.73 - .31*x - .057*x*x;
      const length = .42 + (.48 + .75*(.5+.5*Math.sin(k*.76))) + rnd()*.42;
      for (const side of [-1,1]) hang(side*x,y,z,length,side*.045,k%3);
    }
    for(let v=0;v<3;v++){
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(sets[v],3));
      const mat=new THREE.LineBasicMaterial({color:silver,transparent:true,opacity:.26,depthWrite:false});const l=new THREE.LineSegments(geo,mat);group.add(l);
      const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(tips[v],3));
      const tm=new THREE.PointsMaterial({color:silver,map:this.dropletMap,size:.10,transparent:true,opacity:.65,depthWrite:false,sizeAttenuation:true});const tipMesh=new THREE.Points(tg,tm);group.add(tipMesh);this.filaments.push({mat,tm,mesh:l,tipMesh,voice:v,bay});
    }
  }
  makeJellies(){
    const capgeo=lathe([[0,.66],[.2,.65],[.48,.56],[.72,.4],[.88,.17],[.9,.04],[.79,-.03],[.66,.03]],40);
    const ringgeo=new THREE.TorusGeometry(.85,.018,4,48);
    // Small schools occupy the openings between pillars at several depths. A
    // few larger bells sit near the edges of the Threshold view as in the film.
    const schools = [[7.55,5.72,1.48,1.06],[9.1,2.22,-2.65,.82],
      [7.35,3.75,-4.82,.71],[10.15,1.43,-1.34,.90]];
    const positions = [];
    for (let bay=0; bay<9; bay++) {
      for (let member=0; member<(bay<3 ? 4 : 3); member++) {
        const [offset,height,depth,size] = schools[member];
        for (const side of [-1,1]) {
          const wave = Math.sin(bay*1.87 + member*1.7 + (side>0 ? .93 : 0));
          positions.push({side,x:side*(offset+wave*.55),y:height+wave*.71,
            z:6-bay*8.3+depth+wave*.78,scale:size*(.94+.15*wave)});
        }
      }
    }
    for (const [n, placement] of positions.entries()) {
      const {side,x,y,z,scale}=placement;
      const phase = rnd()*TAU;
      const g=new THREE.Group(),mat=membrane(false);
      mat.uniforms.uColor.value.copy(pearl);mat.uniforms.uAlpha.value=.31;
      mat.uniforms.uPhase.value=phase;
      g.add(new THREE.Mesh(capgeo,mat));
      const glow=new THREE.MeshBasicMaterial({color:pearl,transparent:true,opacity:.42,depthWrite:false});
      const rim=new THREE.Mesh(ringgeo,glow);rim.rotation.x=Math.PI/2;rim.position.y=.05;g.add(rim);
      const organMat=new THREE.LineBasicMaterial({color:'#edd8b5',transparent:true,opacity:.5,depthWrite:false});
      for(let k=0;k<4;k++){const pts=[];for(let j=0;j<=24;j++){const a=j*TAU/24;pts.push(V(Math.cos(k*Math.PI/2)*.23+Math.cos(a)*.16,.29,Math.sin(k*Math.PI/2)*.23+Math.sin(a)*.16));}g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),organMat));}
      const threads=[],threadPositions=[];
      for(let k=0;k<9;k++){
        const a=k*TAU/9,length=.8+rnd()*1.6,pts=[];
        for(let j=0;j<=22;j++){const t=j/22;pts.push(V(Math.cos(a)*(.55-t*.22)+Math.sin(t*8+a)*t*.18+side*.63*t*t,-t*length,Math.sin(a)*(.55-t*.22)+Math.cos(t*7+a)*t*.15));}
        for(let i=0;i<pts.length-1;i++)threadPositions.push(...pts[i].toArray(),...pts[i+1].toArray());
      }
      const threadGeo=new THREE.BufferGeometry();threadGeo.setAttribute('position',new THREE.Float32BufferAttribute(threadPositions,3));const threadMesh=new THREE.LineSegments(threadGeo,strandMaterial(phase));g.add(threadMesh);threads.push(threadMesh);
      const silk = new THREE.MeshBasicMaterial({color:'#d4c9da',transparent:true,opacity:.27,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
      for (let arm=0; arm<3; arm++) {
        const vertices=[], indices=[];
        for (let segment=0; segment<=24; segment++) {
          const u=segment/24;
          const curl=u*8.2+arm*2.1+phase*.22;
          const centerX=Math.sin(curl)*(.085+.20*u)+side*.63*u*u;
          const centerZ=Math.cos(curl)*(.10+.18*u);
          const halfWidth=(.035+.095*Math.sin(Math.PI*u)**.8)*(1.-.95*u*u);
          const dx=Math.cos(curl*.72)*halfWidth, dz=Math.sin(curl*.72)*halfWidth;
          const y=-.08-u*(1.74+.22*arm);
          vertices.push(centerX-dx,y,centerZ-dz,centerX+dx,y,centerZ+dz);
          if(segment){const i=2*segment;indices.push(i-2,i-1,i,i-1,i+1,i);}
        }
        const ribbon=new THREE.BufferGeometry();
        ribbon.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        ribbon.setIndex(indices);
        g.add(new THREE.Mesh(ribbon,silk));
      }
      batchGroup(g);g.scale.setScalar(scale);g.position.set(x,y,z);g.rotation.z=side*(.08+rnd()*.2);g.rotation.x=(rnd()-.5)*.2;this.scene.add(g);
      this.jellies.push({g,mat,glow,organMat,silk,threads,x,y,z,scale,phase,voice:2+n%3,baseRot:g.rotation.z});
    }
  }
  makeParticles(){this.atmosphere=new PalaceAtmosphere(this.scene,rnd);this.dust=this.atmosphere.particles;}
  setMood(mood){this.moodTarget=mood==='amber'?1:0;}
  projectLandmarks(){
    const points=[['bells',V(-5.6,8.1,-2.3)],['jellies',this.jellies[1].g.position.clone()],['floor',V(1,.1,-9)]];
    return points.map(([id,point])=>{point.project(this.camera);return {id,x:(point.x*.5+.5)*innerWidth,y:(-.5*point.y+.5)*innerHeight,visible:point.z>-1&&point.z<1&&Math.abs(point.x)<.9&&Math.abs(point.y)<.82};});
  }
  bindControls(){
    let dragging=false,lastX=0,lastY=0;const el=this.renderer.domElement;
    el.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;el.setPointerCapture(e.pointerId);this.transition=null;el.focus({preventScroll:true});});
    el.addEventListener('pointermove',e=>{this.hoverPointer.set(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1);if(!dragging)return;this.targetYaw-=(e.clientX-lastX)*.003;this.targetPitch=Math.max(-.75,Math.min(.9,this.targetPitch+(e.clientY-lastY)*.003));lastX=e.clientX;lastY=e.clientY;});
    el.addEventListener('pointerleave',()=>this.hoverPointer.set(0,0));el.addEventListener('pointerup',()=>dragging=false);el.addEventListener('pointercancel',()=>dragging=false);
    el.addEventListener('wheel',e=>{e.preventDefault();this.transition=null;const d=Math.max(-2,Math.min(2,e.deltaY*.008));this.camera.position.x-=Math.sin(this.yaw)*d;this.camera.position.z-=Math.cos(this.yaw)*d;this.clampPosition();},{passive:false});
    addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){this.keys.add(e.key.toLowerCase());this.transition=null;e.preventDefault();}});
    addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>this.keys.clear());
  }
  clampPosition(){this.camera.position.x=THREE.MathUtils.clamp(this.camera.position.x,-12,12);this.camera.position.z=THREE.MathUtils.clamp(this.camera.position.z,-66,17);this.camera.position.y=THREE.MathUtils.clamp(this.camera.position.y,1.3,7);}
  goTo(view){
    const views={entrance:{pos:V(0,3.6,14),yaw:0,pitch:.045},hall:{pos:V(0,3.2,-12),yaw:0,pitch:.12},garden:{pos:V(5.9,3.6,-9),yaw:-.98,pitch:.045}};
    const v=views[view];this.transition={from:this.camera.position.clone(),to:v.pos,fromYaw:this.yaw,toYaw:v.yaw,fromPitch:this.pitch,toPitch:v.pitch,start:this.elapsed};this.keys.clear();
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.composer?.setSize(innerWidth,innerHeight);const longest=this.mobile?768:1280,aspect=innerWidth/innerHeight,w=Math.round(aspect>=1?longest:longest*aspect),h=Math.round(aspect>=1?longest/aspect:longest);this.reflector.getRenderTarget().setSize(w,h);this.floorMaterial.uniforms.uTexel.value.set(1/w,1/h);}
  update(dt,response){
    this.elapsed+=dt;if(this.drifts)this.ambientTime+=dt;const t=this.ambientTime;
    if(this.transition){const m=this.transition,f=Math.min(1,(this.elapsed-m.start)/2.5),k=f*f*(3-2*f);this.camera.position.lerpVectors(m.from,m.to,k);this.yaw=THREE.MathUtils.lerp(m.fromYaw,m.toYaw,k);this.pitch=THREE.MathUtils.lerp(m.fromPitch,m.toPitch,k);this.targetYaw=this.yaw;this.targetPitch=this.pitch;if(f===1)this.transition=null;}
    else{this.yaw+=(this.targetYaw-this.yaw)*(1-Math.exp(-dt*9));this.pitch+=(this.targetPitch-this.pitch)*(1-Math.exp(-dt*9));const forward=(this.keys.has('w')||this.keys.has('arrowup')?1:0)-(this.keys.has('s')||this.keys.has('arrowdown')?1:0),strafe=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0);const speed=4*dt;this.camera.position.x+=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*strafe)*speed;this.camera.position.z+=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*strafe)*speed;this.clampPosition();}
    if(this.reduced)this.pointer.set(0,0);else this.pointer.lerp(this.hoverPointer,1-Math.exp(-dt*3));this.camera.rotation.order='YXZ';this.camera.rotation.y=this.yaw-this.pointer.x*.018;this.camera.rotation.x=this.pitch-this.pointer.y*.012;this.mood+=(this.moodTarget-this.mood)*(1-Math.exp(-dt*1.6));this.keyLight.color.setRGB(1.,.72+this.mood*.08,.43-this.mood*.12);this.renderer.toneMappingExposure=1.08+this.mood*.08;
    const bass = response.bass;
    const colors = response.colors || response.voices;
    const bassColor = Math.min(1, colors[0]*.25 + colors[1]*.75);
    const branchLight = Math.min(1.25, bass*.24 + response.voices[4]*.76);
    this.stoneLight.tide.value = Math.min(1, bassColor*.22 + colors[4]*.78);
    this.stoneLight.crown.value = .12 + bass*.93;
    this.crownMetal.emissiveIntensity = .11 + .62*bass;
    this.branchPearl.emissiveIntensity = .34 + 2.85*branchLight;
    this.rimPearl.emissiveIntensity = .52 + 2.4*bass + .42*response.high;

    for (const [index,bay] of this.bays.entries()) {
      const weight = .95 + .05*Math.cos(index*.7);
      const energy = bass * weight;
      bay.emission.emissive.copy(pearl).lerp(tide,Math.min(1, .20 + .80*this.stoneLight.tide.value));
      bay.emission.emissiveIntensity = .24 + 2.10*branchLight;
      bay.capmat.uniforms.uEnergy.value = .12 + energy*(1-.26*Math.min(1,colors[4]));
      bay.capmat.uniforms.uColor.value.copy(softGold).lerp(amber,bassColor).lerp(coolPearl,.50*Math.min(1,colors[4]));
      bay.gold.color.copy(softGold).lerp(amber,bassColor).multiplyScalar(.90 + energy*1.35);
      bay.gold.opacity = Math.min(.91, .40 + energy*.49);
      if (bay.light) {
        bay.light.intensity = 23 + energy*46;
        bay.light.color.copy(softGold).lerp(amber,bassColor);
      }
    }
    for (const jelly of this.jellies) {
      const {voice,mat,g,scale,phase} = jelly;
      const energy = response.voices[voice];
      const motion = response.motion?.[voice] ?? energy;
      const color = Math.min(1, colors[voice]);
      const hit = response.hits[voice];
      mat.uniforms.uTime.value = t;
      mat.uniforms.uEnergy.value = .06 + energy*.82 + hit*.22;
      mat.uniforms.uColor.value.copy(pearl).lerp(jellyGold,color);
      jelly.glow.color.copy(pearl).lerp(jellyGold,color).multiplyScalar(1 + energy*.9);
      jelly.glow.opacity = Math.min(.87,.32+energy*.45);
      jelly.organMat.color.copy(softGold).lerp(jellyGold,color).multiplyScalar(1.1+energy*1.8);
      jelly.organMat.opacity = Math.min(.95,.54+energy*.40);
      jelly.silk.opacity = Math.min(.58,.24+energy*.22);
      g.position.y = jelly.y + Math.sin(t*.45+phase)*.17 + motion*.11 + hit*.14;
      g.position.x = jelly.x + Math.sin(t*.28+phase)*.13;
      g.rotation.z = jelly.baseRot + Math.sin(t*.35+phase)*.045 + motion*.08;
      g.scale.set(scale*(1+motion*.12+hit*.045),scale*(1-motion*.18-hit*.08),scale*(1+motion*.12));
      for (const [k,thread] of jelly.threads.entries()) {
        thread.rotation.z = Math.sin(t*.65+k+phase)*.075;
        thread.material.uniforms.uTime.value = t;
        thread.material.uniforms.uOpacity.value = .34 + energy*.19;
      }
    }
    for (const filament of this.filaments) {
      const energy = response.filaments?.[filament.voice] ?? response.voices[5+filament.voice];
      filament.mat.color.copy(silver).multiplyScalar(.85+energy*1.85);
      filament.mat.opacity = Math.min(.93,.23+energy*.64);
      filament.tm.color.copy(silver).multiplyScalar(1.7+energy*3.5);
      filament.tm.opacity = Math.min(1,.53+energy*.46);
      filament.tm.size = .105+energy*.11;
      const sway = Math.sin(t*.21+filament.bay*.6)*.002;
      filament.mesh.rotation.z = filament.tipMesh.rotation.z = sway;
    }
    this.floorMaterial.uniforms.uTime.value=t;this.floorMaterial.uniforms.uLevel.value=bass;this.floorMaterial.uniforms.uPulse.value=response.floor;
    this.floorMaterial.uniforms.uAmount.value=response.amount;
    this.floorMaterial.uniforms.uFluid.value=response.fluid?1:0;
    const rings=this.floorMaterial.uniforms.uRings.value;rings.fill(-100);response.ripples.slice(-8).forEach((age,i)=>rings[i]=age);
    this.atmosphere.update(t,this.renderer.getPixelRatio());this.composer.render();
  }
}
