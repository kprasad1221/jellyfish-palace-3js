import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzePCM, detectEvents, Interpreter } from '../dist/src/analysis/features.js';
import { responseAt, PalaceAudio } from '../dist/src/audio.js';
import { envelope } from '../dist/src/shared/score.js';
import { VisualLag, PalaceResponse, measureVoiceRanges, remapLevel } from '../dist/src/response-filter.js';
const sr=32000,len=sr,opts={sensitivity:5,cooldownLow:160,cooldownHigh:90};
const checks=[];function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
const silent=analyzePCM([new Float32Array(len)],sr),silentEvents=detectEvents(silent,opts);
check('Silence produces no detected events',()=>assert.equal(silentEvents.time.length,0));
check('Silence stays dark through the interpreter',()=>{const i=new Interpreter();const levels=i.step(silent.voiceDb.subarray(0,8),silent.globalDb[0],1/60,{normalize:'preserve',gain:0,noiseFloor:-62,gateHyst:6,gateOpen:10,gateClose:150,reference:-12,tilt:2.5,curve:2.2,adapt:0});assert.ok([...levels].every(v=>v===0));});
for(const [hz,voice] of [[90,1],[650,3],[3500,5],[7000,6]]){const a=Float32Array.from({length:len},(_,i)=>.4*Math.sin(2*Math.PI*hz*i/sr));const f=analyzePCM([a],sr);check(`${hz} Hz resolves in voice ${voice}`,()=>{const frame=Math.floor(.5/f.hop),db=Array.from(f.voiceDb.subarray(frame*8,frame*8+8));assert.equal(db.indexOf(Math.max(...db)),voice);});}
check('An event gesture returns to rest',()=>{assert.equal(envelope(-1,.055,.045,.8),0);assert.equal(envelope(.07,.055,.045,.8),1);assert.equal(envelope(1,.055,.045,.8),0);});
const fake={meta:{duration:5}},events={time:[.5],voice:[1],strength:[1]};
check('Zero response produces no motion, light or floor waves',()=>{const r=responseAt(fake,events,.7,Array(8).fill(1),0);assert.equal(r.bass,0);assert.equal(r.ripples.length,0);assert.ok(r.voices.every(x=>x===0));});
check('Floor wave starts at the detected attack',()=>{assert.equal(responseAt(fake,events,.3,Array(8).fill(0)).ripples.length,0);assert.ok(Math.abs(responseAt(fake,events,.7,Array(8).fill(0)).ripples[0]-.2)<1e-6);});
check('The same audio time yields identical event responses',()=>assert.deepEqual(responseAt(fake,events,.7,Array(8).fill(.3)),responseAt(fake,events,.7,Array(8).fill(.3))));
// Decode the PCM WAV written from the supplied video; no external audio library required.
const bytes=fs.readFileSync(new URL('../dist/assets/palace-audio.wav',import.meta.url));let p=12,fmt,data;
while(p+8<=bytes.length){const tag=bytes.toString('ascii',p,p+4),n=bytes.readUInt32LE(p+4);if(tag==='fmt ')fmt={format:bytes.readUInt16LE(p+8),channels:bytes.readUInt16LE(p+10),sr:bytes.readUInt32LE(p+12),bits:bytes.readUInt16LE(p+22)};if(tag==='data')data=bytes.subarray(p+8,p+8+n);p+=8+n+(n%2);}
assert.equal(fmt.format,1);assert.equal(fmt.bits,16);const count=data.length/(fmt.channels*2),channels=Array.from({length:fmt.channels},()=>new Float32Array(count));for(let i=0;i<count;i++)for(let c=0;c<fmt.channels;c++)channels[c][i]=data.readInt16LE((i*fmt.channels+c)*2)/32768;
const f=analyzePCM(channels,fmt.sr),e=detectEvents(f,opts),counts=Array(8).fill(0);for(const v of e.voice)counts[v]++;
check('The supplied clip has non-silent, finite measured audio',()=>{assert.ok(f.globalDb.some(x=>x>-40));assert.ok(f.voiceDb.every(Number.isFinite));assert.ok(e.time.length>0);});
check('All detected events stay within the supplied clip',()=>assert.ok(e.time.every(t=>t>=0&&t<=f.meta.duration)));
check('Visual lag follows 90% of a step in its declared rise / fall time',()=>{const lag=new VisualLag(1,2);for(let i=0;i<60;i++)lag.step(1,1/60);assert.ok(Math.abs(lag.value-.9)<1e-8);lag.reset(1);for(let i=0;i<120;i++)lag.step(0,1/60);assert.ok(Math.abs(lag.value-.1)<1e-8);});
check('Visual lag gives the same step response at 30, 60 and 120 fps',()=>{const samples=[30,60,120].map(fps=>{const lag=new VisualLag(1,2);for(let i=0;i<fps;i++)lag.step(1,1/fps);return lag.value;});assert.ok(Math.max(...samples)-Math.min(...samples)<1e-8);});
check('A short input spike becomes a small continuous movement',()=>{const filter=new PalaceResponse();let peak=0;for(let i=0;i<240;i++){const raw=responseAt(fake,events,.3,Array(8).fill(i<3?1:0));const out=filter.step(raw,1/60);peak=Math.max(peak,out.motion[3]);}assert.ok(peak>0&&peak<.12);});
check('All filtered channels return to zero after the source stops',()=>{const filter=new PalaceResponse();for(let i=0;i<300;i++)filter.step(responseAt(fake,events,.7,Array(8).fill(.7)),1/60);const zero=responseAt(fake,events,.7,Array(8).fill(0),0);let out;for(let i=0;i<1800;i++)out=filter.step(zero,1/60);assert.ok([...out.voices,...out.motion,...out.colors,...out.filaments,out.amount,out.floor].every(x=>Math.abs(x)<1e-6));});
check('Existing floor waves finish instead of disappearing on pause',()=>{const filter=new PalaceResponse(),raw=responseAt(fake,events,.7,Array(8).fill(.7));raw.ripples=[.5];filter.step(raw,1/60);const zero=responseAt(fake,events,.7,Array(8).fill(0),0);const tail=filter.step(zero,.1);assert.equal(tail.ripples.length,1);assert.ok(Math.abs(tail.ripples[0]-.6)<1e-8);let out;for(let i=0;i<240;i++)out=filter.step(zero,1/60);assert.equal(out.ripples.length,0);});
check('Quiet or absent frequencies remain below the visual floor', () => {
  const silentRanges=measureVoiceRanges(silent);
  for(const range of silentRanges) {
    assert.equal(remapLevel(-100, range),0);
    assert.ok(range.high-range.low >= 5.5);
  }
  const flat={frames:40,globalDb:new Float32Array(40).fill(-18),voiceDb:new Float32Array(320).fill(-82)};
  for(let i=0;i<40;i++)flat.voiceDb[i*8+3]=-18;
  const ranges=measureVoiceRanges(flat);
  assert.equal(remapLevel(-18,ranges[3]),1);
  assert.equal(remapLevel(-82,ranges[1]),0);
});

// Exercise the same frame method used by the running palace and sample after
// the first loop so that the first note's fade-in does not inflate the range.
const playback=new PalaceAudio(()=>{});
Object.assign(playback,{context:{currentTime:0},buffer:{duration:f.meta.duration},
  playing:true,features:f,events:e,ranges:measureVoiceRanges(f)});
const fps=60, samples=[];
let previous, rawMotionTravel=0, filteredMotionTravel=0;
for(let i=0;i<Math.ceil(f.meta.duration*fps*3);i++) {
  playback.context.currentTime=i/fps;
  const out=playback.frame(1/fps);
  const raw=remapLevel(playback.bandDb[3],playback.ranges[3]);
  if(i/fps>=2*f.meta.duration) {
    samples.push(out.bass);
    if(previous) {
      rawMotionTravel+=Math.abs(raw-previous.raw);
      filteredMotionTravel+=Math.abs(out.motion[3]-previous.motion);
    }
  }
  previous={raw,motion:out.motion[3]};
}
check('Real playback repeatedly returns from a bright crown to a quieter crown at 100% Response',()=>{
  const ordered=[...samples].sort((a,b)=>a-b);
  assert.ok(ordered[Math.floor(ordered.length*.05)] < .30);
  assert.ok(ordered[Math.floor(ordered.length*.95)] > .82);
  let armed=false,crests=0;
  for(const value of samples){if(value<.45)armed=true;if(armed&&value>.68){crests++;armed=false;}}
  assert.ok(crests>=3,`Only ${crests} distinct swells`);
});
check('Real playback smooths the reranged motion and has no crown jumps at loop wrap',()=>{
  assert.ok(filteredMotionTravel < .65*rawMotionTravel);
  const jumps=samples.map((value,i)=>Math.abs(value-samples[(i+samples.length-1)%samples.length]));
  assert.ok(Math.max(...jumps)<.10);
});
check('Disabling the measured response at full playback returns every material control to rest',()=>{
  playback.enabled=false;
  let result;
  for(let i=0;i<700;i++)result=playback.frame(1/fps);
  assert.ok([...result.voices,...result.motion,...result.colors,...result.filaments,result.floor].every(x=>Math.abs(x)<1e-6));
});
console.log(JSON.stringify({checks:checks.length,duration:f.meta.duration,eventCountsByVoice:counts,source:'Living Particles c654ae403c5bece4822dd38024228c1fc468acd4'},null,2));
