import * as THREE from 'three';
import assert from 'node:assert/strict';
import { Palace } from '../dist/src/world.js';
const p=Object.create(Palace.prototype);
Object.assign(p,{scene:new THREE.Scene(),mobile:false,bays:[],jellies:[],filaments:[],lights:[],elapsed:0,ambientTime:0,drifts:true,mood:0,moodTarget:0,pointer:new THREE.Vector2(),hoverPointer:new THREE.Vector2(),reduced:false,yaw:0,pitch:.045,targetYaw:0,targetPitch:.045,keys:new Set()});
p.makeFloor();p.makeArchitecture();p.makeDetails();p.makeJellies();p.makeParticles();
let meshes=0,vertices=0,instances=0,customMaterials=new Set();
p.scene.traverse(o=>{
  if(o.isMesh)meshes++;
  if(o.isInstancedMesh){instances+=o.count;assert.ok([...o.instanceMatrix.array].every(Number.isFinite));}
  if(o.geometry){const a=o.geometry.getAttribute('position');assert.ok([...a.array].every(Number.isFinite),'Invalid geometry');vertices+=a.count;}
  if(o.material?.isShaderMaterial){customMaterials.add(o.material);for(const source of [o.material.vertexShader,o.material.fragmentShader])for(const m of source.matchAll(/#include <([^>]+)>/g))assert.ok(THREE.ShaderChunk[m[1]],'Missing chunk '+m[1]);if(o.material.fog){assert.ok(o.material.uniforms.fogColor);assert.ok(o.material.uniforms.fogDensity);}}
});
assert.equal(p.bays.length,9);assert.equal(p.jellies.length,60);assert.equal(p.filaments.length,27);
assert.equal(p.floorMaterial,p.reflector.material,'The patterned floor must be the reflector itself');
p.camera=new THREE.PerspectiveCamera(62,16/9,.08,130);p.camera.position.set(0,3.6,14);p.keyLight=new THREE.DirectionalLight();
p.renderer={getPixelRatio:()=>1.5,setSize(){}};p.composer={render(){p.camera.updateMatrixWorld();},setSize(){}};
globalThis.innerWidth=1280;globalThis.innerHeight=720;
p.resize();assert.equal(p.reflector.getRenderTarget().width,1280);assert.equal(p.reflector.getRenderTarget().height,720);
const r={bass:.4,mid:.6,high:.2,floor:.5,amount:1,voices:Array(8).fill(.4),motion:Array(8).fill(.3),colors:Array(8).fill(.3),filaments:Array(3).fill(.2),hits:Array(8).fill(0),ripples:[.2,.7],fluid:true};
const rest = {...r, bass:0, high:0, floor:0, voices:Array(8).fill(0), colors:Array(8).fill(0)};
p.update(1/60,rest);
const quietCrown = p.crownMetal.emissiveIntensity;
const quietBeads = p.branchPearl.emissiveIntensity;
const upperMids = Array(8).fill(0);
upperMids[4] = 1;
p.update(1/60,{...rest, voices:upperMids, colors:upperMids});
assert.ok(p.branchPearl.emissiveIntensity > quietBeads);
assert.equal(p.crownMetal.emissiveIntensity, quietCrown);
p.update(1/60,{...rest, bass:1, floor:.8});
assert.ok(p.crownMetal.emissiveIntensity > quietCrown);
assert.equal(p.floorMaterial.uniforms.uPulse.value,.8);
for(let i=0;i<120;i++)p.update(1/60,r);
assert.ok(p.jellies[0].threads[0].material.uniforms.uTime.value>1.9);
p.drifts=false;const stopped=p.ambientTime;p.update(1/60,r);assert.equal(p.ambientTime,stopped);assert.equal(p.atmosphere.particles.material.uniforms.uTime.value,stopped);
p.setMood('amber');for(let i=0;i<180;i++)p.update(1/60,r);assert.ok(p.mood>.99);
for(const name of ['entrance','hall','garden']){p.goTo(name);for(let i=0;i<180;i++)p.update(1/60,r);assert.ok(p.camera.position.toArray().every(Number.isFinite));assert.ok(p.projectLandmarks().every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)));}
console.log(JSON.stringify({checks:'Geometry, fog uniforms, single floor, reflection sizing, ambient pause, light mood, camera travel and landmark projection passed',meshes,vertices,instances,customMaterials:customMaterials.size,limitation:'Scene graph verification; GPU drawing is not covered.'},null,2));
