import { Palace } from './world.js';
import { PalaceAudio } from './audio.js';

const $=id=>document.getElementById(id),status=$('audioStatus');let palace,entered=false,guideOpen=innerWidth>760&&innerHeight>520,currentGuide='jellies';
function notice(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').hidden=true,6500);}
const audio=new PalaceAudio((state,value)=>{
  const names={loading:'Loading audio…',analyzing:`Listening to the clip… ${Math.round((value||0)*100)}%`,ready:'Audio measured · ready to play',playing:audio.enabled?'Listening · audio response on':'Playing · audio response off',paused:'Paused · audio response resting',error:'Audio unavailable · try another file'};
  status.textContent=names[state];$('playButton').classList.toggle('is-playing',state==='playing');$('playButton').setAttribute('aria-label',state==='playing'?'Pause audio':'Play palace audio');
  $('playButton').disabled=state==='loading'||state==='analyzing';$('trackName').textContent=audio.currentName;
  if(state==='error')notice(value);
});
try{palace=new Palace($('world'));}catch(e){console.error(e);document.body.classList.add('no-webgl');$('world').style.background="url('./assets/reference.jpg') center/cover";$('rendererNotice').hidden=false;notice('The 3D renderer could not start. Try a browser with WebGL enabled; the source film is still available.');$('enterButton').disabled=true;$('quietButton').disabled=true;}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced&&palace){palace.drifts=false;$('drift').checked=false;}
function enter(sound=true){if(!palace)return;entered=true;document.body.classList.add('entered');$('intro').inert=true;$('location').hidden=false;setGuide(guideOpen);if(innerWidth<=760)document.querySelector('.mobile-move').hidden=false;if(sound)audio.play().catch(e=>notice(e.message));}
$('enterButton').onclick=()=>enter(true);$('quietButton').onclick=()=>enter(false);
$('playButton').onclick=()=>{if(!entered)enter(false);audio.playing?audio.pause():audio.play().catch(e=>notice(e.message));};
function setView(view){if(!entered)enter(false);palace?.goTo(view);document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});$('locationName').textContent={entrance:'The threshold',hall:'The bell hall',garden:'The jellyfish garden'}[view];setGuideEntry(view==='garden'?'jellies':view==='hall'?'bells':'floor');}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
function panel(open){$('soundPanel').hidden=!open;$('soundButton').setAttribute('aria-expanded',String(open));if(open){scenePanel(false);$('closeSound').focus({preventScroll:true});}else if($('soundPanel').contains(document.activeElement))$('soundButton').focus({preventScroll:true});}
function scenePanel(open){$('scenePanel').hidden=!open;$('lightButton').setAttribute('aria-expanded',String(open));if(open){panel(false);$('closeScene').focus({preventScroll:true});}else if($('scenePanel').contains(document.activeElement))$('lightButton').focus({preventScroll:true});}
$('lightButton').onclick=()=>scenePanel($('scenePanel').hidden);$('closeScene').onclick=()=>scenePanel(false);
document.querySelectorAll('[data-mood]').forEach(button=>button.onclick=()=>{palace?.setMood(button.dataset.mood);document.querySelectorAll('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
$('soundButton').onclick=()=>panel($('soundPanel').hidden);$('closeSound').onclick=()=>panel(false);
$('response').oninput=e=>{audio.amount=+e.target.value;$('responseValue').value=Math.round(audio.amount*100)+'%';};
function setVolume(value){audio.setVolume(+value);for(const id of ['volume','mobileVolume'])$(id).value=value;for(const id of ['volumeValue','mobileVolumeValue'])$(id).value=Math.round(audio.volume*100)+'%';}
$('volume').oninput=$('mobileVolume').oninput=e=>setVolume(e.target.value);
$('responseStyle').onchange=e=>{audio.responseStyle=e.target.value;$('smoothing').disabled=e.target.value==='original';$('flowHint').textContent=e.target.value==='original'?'Original fast response for comparison.':'Each band uses the range measured in this track. Smoothing sets how quickly the light and movement follow.';};
$('smoothing').oninput=e=>{audio.smoothing=+e.target.value;$('smoothingValue').value=audio.smoothing.toFixed(1).replace(/\.0$/,'')+'×';};
$('reaction').onchange=e=>{audio.enabled=e.target.checked;status.textContent=audio.playing?(audio.enabled?'Listening · audio response on':'Playing · audio response off'):'Paused · audio response resting';};
$('drift').onchange=e=>{if(palace)palace.drifts=e.target.checked;};
async function loadFile(file){if(!file||audio.busy)return;if(!entered)enter(false);if(await audio.load(file)){await audio.play();notice(`Now listening to ${audio.currentName}.`);}}
$('audioFile').onchange=e=>loadFile(e.target.files[0]);document.querySelector('.file-button').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('audioFile').click();}};
$('resetAudio').onclick=async()=>{if(audio.busy)return;if(await audio.load())await audio.play();};
addEventListener('dragover',e=>e.preventDefault());addEventListener('drop',e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file && (file.type.startsWith('audio/')||/\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(file.name)))loadFile(file);else notice('Drop an audio file to let the palace listen.');});
const guide={
  jellies:{number:'01',kicker:'THE LIVING BELLS',title:'Aurelia.',description:'Pearl membranes, trailing silk. Each bell follows its own quiet current through the hall.',link:'Visit the jellyfish garden',view:'garden',icon:'i-jelly'},
  bells:{number:'02',kicker:'THE LISTENING ARCHITECTURE',title:'The bell canopy.',description:'Gold ribs hold their symmetry. Fine filaments hang beneath the scalloped crowns, catching light at the edge of the sea.',link:'Step into the bell hall',view:'hall',icon:'i-arch'},
  floor:{number:'03',kicker:'THE WATER BELOW',title:'The tide floor.',description:'Dark polished stone holds the light of the vault. Pale mineral veins follow the water into the distance.',link:'Return to the threshold',view:'entrance',icon:'i-wave'}
};
function setGuideEntry(id){const g=guide[id];currentGuide=id;$('fieldNumber').textContent=g.number;$('fieldKicker').textContent=g.kicker;$('fieldTitle').textContent=g.title;$('fieldDescription').textContent=g.description;$('discoverButton').firstChild.textContent=g.link+' ';$('specimenIcon').querySelector('use').setAttribute('href','#'+g.icon);}
function setGuide(open){guideOpen=open;$('fieldCard').hidden=!open;$('fieldCard').classList.toggle('opened',open);$('fieldButton').setAttribute('aria-expanded',String(open));$('landmarks').hidden=!open||!entered||!palace;}
setGuide(guideOpen);
$('fieldButton').onclick=()=>setGuide(!guideOpen);$('closeField').onclick=()=>setGuide(false);
$('discoverButton').onclick=()=>{setView(guide[currentGuide].view);if(innerWidth<=760)setGuide(false);};
document.querySelectorAll('[data-landmark]').forEach(b=>b.onclick=()=>{setGuideEntry(b.dataset.landmark);setGuide(true);});
addEventListener('pointermove',e=>{if(reduced||e.pointerType==='touch')return;document.documentElement.style.setProperty('--look-x',((e.clientX/innerWidth-.5)*8).toFixed(2)+'px');document.documentElement.style.setProperty('--look-y',((e.clientY/innerHeight-.5)*6).toFixed(2)+'px');});
let wasCompact=innerWidth<=760||innerHeight<=520;addEventListener('resize',()=>{const compact=innerWidth<=760||innerHeight<=520;if(compact!==wasCompact){setGuide(!compact);wasCompact=compact;}if(entered)document.querySelector('.mobile-move').hidden=innerWidth>760;});
let resumeAfterFilm=false;
$('referenceButton').onclick=()=>{resumeAfterFilm=audio.playing;audio.pause();$('referenceDialog').showModal();};
$('referenceDialog').addEventListener('close',()=>{$('sourceVideo').pause();if(resumeAfterFilm)audio.play().catch(e=>notice(e.message));});
$('aboutButton').onclick=()=>$('aboutDialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function clean(){const hidden=document.body.classList.toggle('clean');$('restoreButton').hidden=!hidden;}
$('hideButton').onclick=clean;$('restoreButton').onclick=clean;
addEventListener('keydown',e=>{if(e.key==='Escape'){panel(false);scenePanel(false);return;}if(/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;if(document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();$('playButton').click();}if(e.key.toLowerCase()==='h')clean();if(['1','2','3'].includes(e.key))setView(['entrance','hall','garden'][+e.key-1]);});
for(const [id,key] of [['forwardButton','w'],['backButton','s']]){$(id).onpointerdown=e=>{e.preventDefault();e.target.setPointerCapture(e.pointerId);if(palace){palace.transition=null;palace.keys.add(key);}};$(id).onpointerup=$(id).onpointercancel=()=>palace?.keys.delete(key);}
// Stop movement when a dialog or browser tab takes focus; audio is left under the user's control.
addEventListener('visibilitychange',()=>{palace?.keys.clear();});
let lastResponse;
let last=performance.now(),ui=0,renderWindow=0,renderFrames=0;const bars=[...document.querySelectorAll('.mini-spectrum i')];
function frame(now){const elapsed=(now-last)/1000,dt=Math.min(.1,elapsed);last=now;const r=audio.frame(dt);lastResponse=r;palace?.update(dt,r);if(palace&&entered&&guideOpen){for(const p of palace.projectLandmarks()){const el=document.querySelector('[data-landmark="'+p.id+'"]');el.hidden=!p.visible;el.style.left=p.x+'px';el.style.top=p.y+'px';}}ui+=dt;
  if(elapsed>0&&elapsed<.5){renderWindow+=elapsed;renderFrames++;}else{renderWindow=0;renderFrames=0;}
  if(renderWindow>=1.5){$('renderStatus').textContent=palace?`Rendering · ${Math.round(renderFrames/renderWindow)} fps`:'3D unavailable in this preview browser';renderWindow=0;renderFrames=0;}
  if(ui>.09){ui=0;bars.forEach((b,i)=>b.style.height=(2+r.voices[i]*10)+'px');$('bassMeter').value=r.bass;$('midMeter').value=r.mid;$('highMeter').value=r.high;$('floorMeter').value=r.floor;const t=Math.floor(audio.time);$('time').textContent=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
// Read-only diagnostic snapshot for iteration; never injects artificial sound or motion.
Object.defineProperty(window,'palaceStudy',{value:{snapshot:()=>({playing:audio.playing,audioTime:audio.time,duration:audio.buffer?.duration,analysis:audio.features?.meta,events:audio.events?.time.length,levels:Array.from(lastResponse?.voices||audio.levels),camera:palace?.camera.position.toArray(),drawCalls:palace?.renderer.info.render.calls,triangles:palace?.renderer.info.render.triangles})}});
