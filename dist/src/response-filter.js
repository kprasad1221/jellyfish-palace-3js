// Final visual filtering: measured levels and event envelopes remain separate.
// Two-pole low-pass (critically damped) keeps both value and velocity continuous.
// Times are seconds to follow 90% of a sustained step, similar to Lag CHOP's unit.
const STEP90 = 3.889720169867429;
export class VisualLag {
  constructor(rise,fall){this.rise=rise;this.fall=fall;this.value=0;this.velocity=0;}
  reset(value=0){this.value=value;this.velocity=0;}
  step(target,dt,scale=1){
    target=Number.isFinite(target)?target:0;
    if(!(dt>0))return this.value;
    const seconds=(target>this.value?this.rise:this.fall)*Math.max(.25,scale);
    const w=STEP90/seconds,error=this.value-target,j=this.velocity+w*error,e=Math.exp(-w*dt);
    this.value=target+(error+j*dt)*e;this.velocity=(this.velocity-w*j*dt)*e;
    if(Math.abs(this.value-target)<1e-7&&Math.abs(this.velocity)<1e-6)this.reset(target);
    return this.value;
  }
}

// Measure once per decoded track. A shared pair of dB endpoints would put bass
// near black and leave the mids permanently bright on this particular recording.
export function measureVoiceRanges(features) {
  const bands = Array.from({ length: 8 }, () => []);
  for (let frame = 0; frame < features.frames; frame++) {
    if (features.globalDb[frame] < -60) continue;
    for (let band = 0; band < bands.length; band++) {
      const db = features.voiceDb[frame * 8 + band];
      if (Number.isFinite(db)) bands[band].push(db);
    }
  }
  return bands.map(values => {
    if (!values.length) return { low: -60, high: -48 };
    values.sort((a, b) => a - b);
    const last = values.length - 1;
    const quiet = values[Math.round(last * .23)];
    const bright = values[Math.round(last * .74)];
    // A minimum span preserves steady tones and keeps noise near the floor dark.
    const low = Math.max(-60, Math.min(quiet, bright - 5.5));
    return { low, high: Math.max(-53, bright, low + 5.5) };
  });
}

export function remapLevel(db, range) {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db - range.low) / (range.high - range.low)));
}

export const FLUID_TIMES = {
  light: [.26, .53], motion: [.80, 1.], color: [.4, .70],
  filament: [.26, .55], floor: [.34, .65]
};

export class PalaceResponse {
  constructor() {
    this.light = Array.from({ length: 8 }, () => new VisualLag(...FLUID_TIMES.light));
    this.motion = Array.from({ length: 8 }, () => new VisualLag(...FLUID_TIMES.motion));
    this.color = Array.from({ length: 8 }, () => new VisualLag(...FLUID_TIMES.color));
    this.filament = Array.from({ length: 3 }, () => new VisualLag(...FLUID_TIMES.filament));
    this.floor = new VisualLag(...FLUID_TIMES.floor);
    this.gain = new VisualLag(.4, .65);
    this.ripples = [];
  }
  reset() {
    for (const bank of [this.light, this.motion, this.color, this.filament]) {
      for (const filter of bank) filter.reset();
    }
    this.floor.reset();
    this.gain.reset();
    this.ripples = [];
  }
  step(raw, dt, scale = 1) {
    // The input has already been reranged, clamped and multiplied by Response.
    // Each destination gets its final lag here, including floor emission.
    const voices = this.light.map((filter, band) => filter.step(raw.voices[band], dt, scale));
    const motion = this.motion.map((filter, band) => filter.step(raw.voices[band], dt, scale));
    const colors = this.color.map((filter, band) => filter.step(Math.min(1, raw.voices[band]), dt, scale));
    const filaments = this.filament.map((filter, band) => filter.step(raw.voices[band + 5], dt, scale));
    const floorTarget = Math.max(raw.bass * .85, Math.min(raw.floor, raw.bass * 1.7));
    this.ripples = raw.amount > 0 ? raw.ripples : this.ripples.map(age => age + dt).filter(age => age < 3.5);
    return {
      ...raw, voices, motion, colors, filaments, fluid: true,
      bass: voices[0] * .25 + voices[1] * .75,
      mid: (voices[2] + voices[3] + voices[4]) / 3, high: (filaments[0] + filaments[1] + filaments[2]) / 3,
      floor: this.floor.step(floorTarget, dt, scale), amount: this.gain.step(raw.amount, dt, scale),
      hits: Array(8).fill(0), ripples: this.ripples
    };
  }
}
