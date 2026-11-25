import { Interpreter } from './analysis/features.js';
import { envelope } from './shared/score.js';
import { PalaceResponse, measureVoiceRanges, remapLevel } from './response-filter.js';

const detect={sensitivity:5,cooldownLow:160,cooldownHigh:90};
const interpretation={normalize:'preserve',gain:0,noiseFloor:-62,gateHyst:6,gateOpen:10,gateClose:150,reference:-12,tilt:2.5,curve:2.2,adapt:0};
export const blankResponse=()=>({bass:0,mid:0,high:0,floor:0,amount:0,voices:Array(8).fill(0),hits:Array(8).fill(0),ripples:[]});

// Sound time, not a wall-clock beat, selects each feature frame and each event.
// Only the envelope from score.js is used; its manually timed Score is not started.
export function responseAt(features,events,time,levels,amount=1){
  const out=blankResponse();if(!features||amount===0)return out;
  out.amount=amount;
  for(let v=0;v<8;v++)out.voices[v]=Math.min(1.5,Math.max(0,levels[v])*amount);
  out.bass=(out.voices[0]*.25+out.voices[1]*.75);out.mid=Math.max(out.voices[2],out.voices[3],out.voices[4]);out.high=Math.max(out.voices[5],out.voices[6],out.voices[7]);
  // Short loop tails are read from the preceding cycle, so the same audio time
  // gives the same response after looping. This does not schedule new events.
  for(let i=0;i<events.time.length;i++){
    let age=time-events.time[i];if(age<0)age+=features.meta.duration;
    const voice=events.voice[i],strength=events.strength[i];
    if(age<1.1)out.hits[voice]=Math.max(out.hits[voice],envelope(age,.055,.045,.8)*strength*amount);
    if(voice<=1 && age<3.5 && strength>.65){
      // Simultaneous sub/bass detections make one traveling wave.
      if(!out.ripples.some(x=>Math.abs(x-age)<.08))out.ripples.push(age);
      out.floor=Math.max(out.floor,envelope(age,.055,.08,.8)*strength*amount);
    }
  }
  out.ripples.sort((a,b)=>b-a);return out;
}

export class PalaceAudio{
  constructor(onState) {
    this.onState = onState;
    this.context = this.buffer = this.features = this.events = this.ranges = null;
    this.playing = false;
    this.offset = this.started = this.requestId = 0;
    this.volume = .65;
    this.amount = this.smoothing = 1;
    this.enabled = true;
    this.busy = false;
    this.levels = new Float32Array(8);
    this.bandDb = new Float32Array(8);
    this.interpreter = new Interpreter();
    this.currentName = 'Jellyfish Palace';
    this.responseStyle = 'fluid';
    this.visualResponse = new PalaceResponse();
  }
  async unlock(){
    if(!this.context){this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.gain.connect(this.context.destination);}
    await this.context.resume();
  }
  async load(file=null){
    if(this.busy)return false;this.busy=true;this.pause();this.offset=0;this.features=null;this.events=null;this.buffer=null;this.onState('loading');
    try{
      await this.unlock();
      if(file && file.size>40*1024*1024)throw new Error('Choose an audio file under 40 MB.');
      const bytes=file?await file.arrayBuffer():await fetch(new URL('../assets/palace-audio.wav',import.meta.url)).then(r=>{if(!r.ok)throw new Error('The original audio could not be loaded.');return r.arrayBuffer();});
      const buffer=await this.context.decodeAudioData(bytes);
      if(buffer.duration>180)throw new Error('For this study, choose a clip of 3 minutes or less.');
      if(buffer.duration<.2)throw new Error('That audio clip is too short to analyse.');
      this.currentName=file?file.name.replace(/\.[^.]+$/,''):'Jellyfish Palace';
      const worker=new Worker(new URL('./analysis/worker.js',import.meta.url),{type:'module'}),key=String(++this.requestId);
      const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());
      const data=await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Analysis took too long. Try a shorter audio clip.'));},60000);
        worker.onmessage=e=>{const m=e.data;if(m.type==='result'){clearTimeout(timeout);resolve(m);}else if(m.type==='error'){clearTimeout(timeout);reject(new Error(m.message));}else if(m.type==='progress')this.onState('analyzing',m.p);};
        worker.onerror=e=>{clearTimeout(timeout);reject(new Error(e.message||'Audio analysis could not start.'));};
        worker.postMessage({type:'analyze',key,channels,sampleRate:buffer.sampleRate,detect},channels.map(c=>c.buffer));
      }).finally(()=>worker.terminate());
      this.ranges = measureVoiceRanges(data.features);
      this.buffer = buffer;
      this.features = data.features;
      this.events = data.events;
      this.interpreter.reset();
      this.levels.fill(0);
      this.visualResponse.reset();
      this.onState('ready');
      return true;
    }catch(e){this.onState('error',e.message);return false;}finally{this.busy=false;}
  }
  async play(){if(this.busy)return;await this.unlock();if(!this.buffer && !await this.load())return;if(this.playing)return;
    this.source=this.context.createBufferSource();this.source.buffer=this.buffer;this.source.loop=true;this.source.connect(this.gain);this.started=this.context.currentTime;this.source.start(0,this.offset%this.buffer.duration);this.playing=true;this.onState('playing');
  }
  pause(){if(this.playing){this.offset=this.time;this.source?.stop();this.source?.disconnect();this.source=null;}this.playing=false;this.interpreter.reset();this.onState('paused');}
  get time(){return this.buffer?((this.offset+(this.playing?this.context.currentTime-this.started:0))%this.buffer.duration):0;}
  setVolume(v){this.volume=v;if(this.gain)this.gain.gain.setTargetAtTime(v,this.context.currentTime,.025);}
  frame(dt) {
    const features = this.features;
    const time = this.time;
    if (!this.playing || !features || !this.enabled || this.amount === 0) {
      const zero = blankResponse();
      const settling = this.visualResponse.step(zero, dt, this.smoothing);
      if (this.responseStyle !== 'original') return settling;
      for (let band = 0; band < 8; band++) this.levels[band] *= Math.exp(-dt * 10);
      zero.voices = Array.from(this.levels, level => level * this.amount);
      [zero.bass, zero.mid, zero.high] = [zero.voices[1], zero.voices[3], zero.voices[6]];
      return zero;
    }

    const position = Math.min(time / features.hop, features.frames - 1);
    const frame = Math.min(features.frames - 2, Math.floor(position));
    const fraction = position - frame;
    for (let band = 0; band < 8; band++) {
      const index = frame * 8 + band;
      this.bandDb[band] = features.voiceDb[index] * (1 - fraction) + features.voiceDb[index + 8] * fraction;
    }
    const globalDb = features.globalDb[frame] * (1 - fraction) + features.globalDb[frame + 1] * fraction;
    const levels = this.bandDb.map((db, band) => remapLevel(db, this.ranges[band]));
    const mapped = responseAt(features, this.events, time, levels, this.amount);
    const fluid = this.visualResponse.step(mapped, dt, this.smoothing);
    if (this.responseStyle !== 'original') return fluid;

    const original = this.interpreter.step(this.bandDb, globalDb, dt, interpretation);
    for (let band = 0; band < 8; band++) {
      const difference = original[band] - this.levels[band];
      this.levels[band] += difference * (1 - Math.exp(-dt * (difference > 0 ? 22 : 7)));
    }
    return responseAt(features, this.events, time, this.levels, this.amount);
  }
}
