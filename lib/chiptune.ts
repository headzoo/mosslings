import type { PowerId } from "./god/types";

export type GodSound = {
  impact: () => void;
  stop: () => void;
};

/** A sting plays at cast. An impact cue waits for the visual strike. */
export const GOD_SOUND_CUES = {
  rain: "sting",
  sun: "sting",
  raze: "sting",
  disease: "sting",
  fire: "sting",
  tornado: "sting",
  lightning: "sting",
  nuke: "impact",
  meteor: "impact",
} as const satisfies Record<PowerId, "sting" | "impact">;

export function godSoundWaitsForImpact(kind: PowerId) {
  return GOD_SOUND_CUES[kind] === "impact";
}

const SILENT_SOUND: GodSound = {
  impact() {},
  stop() {},
};

export type Chiptune = {
  setMuted: (muted: boolean) => void;
  playGodSound: (kind: PowerId) => GodSound;
  dispose: () => void;
};

const BPM = 100;
const STEPS = 128;
const STEP_SECONDS = 60 / BPM / 4;
const MASTER_GAIN = 0.11;
const SFX_GAIN = 0.8;
const HOLD = -1;

function voice(source: string) {
  return source
    .trim()
    .split(/\s+/)
    .map((step) => Number(step));
}

// G-major woodland loop. 0 rest, -1 hold, else MIDI note.
const LEAD = voice(`
  79 -1 76 -1 74 -1 71 -1 69 -1 71 -1 74 -1 -1 -1
  76 -1 79 -1 81 -1 79 -1 76 -1 74 -1 71 -1 -1 -1
  74 -1 76 -1 79 -1 -1 -1 81 -1 79 -1 76 -1 -1 -1
  74 -1 71 -1 69 -1 67 -1 69 -1 71 -1 67 -1 -1 -1
  79 -1 76 -1 74 -1 71 -1 69 -1 71 -1 74 -1 -1 -1
  76 -1 79 -1 83 -1 81 -1 79 -1 76 -1 74 -1 -1 -1
  71 -1 74 -1 76 -1 -1 -1 74 -1 71 -1 69 -1 -1 -1
  67 -1 69 -1 71 -1 74 -1 76 -1 74 -1 67 -1 -1 -1
`);

const BASS = voice(`
  43 -1 -1 -1 -1 -1 -1 -1 50 -1 -1 -1 -1 -1 -1 -1
  48 -1 -1 -1 -1 -1 -1 -1 50 -1 -1 -1 -1 -1 -1 -1
  40 -1 -1 -1 -1 -1 -1 -1 47 -1 -1 -1 -1 -1 -1 -1
  48 -1 -1 -1 -1 -1 -1 -1 50 -1 -1 -1 -1 -1 -1 -1
  43 -1 -1 -1 -1 -1 -1 -1 50 -1 -1 -1 -1 -1 -1 -1
  48 -1 -1 -1 -1 -1 -1 -1 43 -1 -1 -1 -1 -1 -1 -1
  40 -1 -1 -1 -1 -1 -1 -1 48 -1 -1 -1 -1 -1 -1 -1
  50 -1 -1 -1 -1 -1 -1 -1 43 -1 -1 -1 -1 -1 -1 -1
`);

const ARP = voice(`
  67 0 71 0 74 0 71 0 62 0 66 0 69 0 66 0
  60 0 64 0 67 0 64 0 62 0 66 0 69 0 66 0
  64 0 67 0 71 0 67 0 59 0 62 0 66 0 62 0
  60 0 64 0 67 0 64 0 62 0 66 0 69 0 66 0
  67 0 71 0 74 0 71 0 62 0 66 0 69 0 66 0
  60 0 64 0 67 0 64 0 55 0 59 0 62 0 59 0
  64 0 67 0 71 0 67 0 60 0 64 0 67 0 64 0
  62 0 66 0 69 0 66 0 55 0 59 0 62 0 67 0
`);

function midiHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function holdLength(steps: number[], index: number) {
  let length = 1;
  while (index + length < steps.length && steps[index + length] === HOLD) {
    length += 1;
  }
  return length;
}

function pulseWave(ctx: AudioContext, duty: number) {
  const bins = 64;
  const real = new Float32Array(bins);
  const imag = new Float32Array(bins);
  for (let i = 1; i < bins; i++) {
    real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag);
}

export function createChiptune(): Chiptune {
  if (typeof AudioContext === "undefined") {
    return {
      setMuted() {},
      playGodSound: () => SILENT_SOUND,
      dispose() {},
    };
  }

  const ctx = new AudioContext();
  const music = ctx.createGain();
  music.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2600;
  tone.Q.value = 0.65;
  music.connect(tone);
  tone.connect(ctx.destination);

  const sfx = ctx.createGain();
  sfx.gain.value = SFX_GAIN;
  sfx.connect(ctx.destination);

  const leadWave = pulseWave(ctx, 0.5);
  const arpWave = pulseWave(ctx, 0.25);
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  let muted = true;
  let playing = false;
  let starting = false;
  let resuming = false;
  let timer = 0;
  let nextStep = 0;
  let nextTime = 0;
  const unlockers: Array<{ type: string; fn: () => void }> = [];
  const afterUnlock: Array<() => void> = [];

  function playPulse(
    wave: PeriodicWave,
    midi: number,
    time: number,
    seconds: number,
    gain: number,
    destination: AudioNode = music,
  ) {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(midiHz(midi), time);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    envelope.gain.exponentialRampToValueAtTime(
      gain * 0.72,
      time + seconds * 0.55,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    osc.connect(envelope);
    envelope.connect(destination);
    osc.start(time);
    osc.stop(time + seconds + 0.01);
  }

  function playBass(midi: number, time: number, seconds: number) {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(midiHz(midi), time);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(0.22, time + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.14, time + seconds * 0.7);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    osc.connect(envelope);
    envelope.connect(music);
    osc.start(time);
    osc.stop(time + seconds + 0.01);
  }

  function playHat(time: number) {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = 7000;
    envelope.gain.setValueAtTime(0.035, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(music);
    source.start(time);
    source.stop(time + 0.05);
  }

  function schedule() {
    const horizon = ctx.currentTime + 0.5;
    while (nextTime < horizon) {
      const lead = LEAD[nextStep];
      const bass = BASS[nextStep];
      const arp = ARP[nextStep];
      if (lead > 0) {
        playPulse(
          leadWave,
          lead,
          nextTime,
          holdLength(LEAD, nextStep) * STEP_SECONDS,
          0.16,
        );
      }
      if (bass > 0) {
        playBass(bass, nextTime, holdLength(BASS, nextStep) * STEP_SECONDS);
      }
      if (arp > 0) {
        playPulse(arpWave, arp, nextTime, STEP_SECONDS * 1.6, 0.045);
      }
      if (nextStep % 4 === 2) playHat(nextTime);
      nextStep = (nextStep + 1) % STEPS;
      nextTime += STEP_SECONDS;
    }
  }

  function stopScheduler() {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  }

  function begin() {
    if (muted || playing || starting || ctx.state === "closed") return;
    starting = true;
    void ctx
      .resume()
      .then(() => {
        starting = false;
        if (muted || playing || ctx.state === "closed") return;
        if (ctx.state !== "running") {
          armUnlock();
          return;
        }
        playing = true;
        nextTime = ctx.currentTime + 0.06;
        music.gain.cancelScheduledValues(ctx.currentTime);
        music.gain.setValueAtTime(MASTER_GAIN, ctx.currentTime);
        stopScheduler();
        schedule();
        timer = window.setInterval(schedule, 100);
        flushUnlocked();
      })
      .catch(() => {
        starting = false;
        armUnlock();
      });
  }

  function flushUnlocked() {
    if (ctx.state !== "running") return;
    const queued = afterUnlock.splice(0);
    for (const fn of queued) fn();
  }

  function armUnlock() {
    if (unlockers.length) return;
    const unlock = () => {
      clearUnlock();
      if (!muted) begin();
      flushUnlocked();
    };
    for (const type of ["pointerdown", "keydown"]) {
      unlockers.push({ type, fn: unlock });
      window.addEventListener(type, unlock);
    }
  }

  function clearUnlock() {
    for (const { type, fn } of unlockers) {
      window.removeEventListener(type, fn);
    }
    unlockers.length = 0;
  }

  function resumeThen(fn: () => void) {
    if (ctx.state === "closed") return;
    if (ctx.state === "running") {
      fn();
      return;
    }
    afterUnlock.push(fn);
    if (resuming) return;
    resuming = true;
    void ctx
      .resume()
      .then(() => {
        resuming = false;
        if (ctx.state === "running") {
          flushUnlocked();
          return;
        }
        armUnlock();
      })
      .catch(() => {
        resuming = false;
        armUnlock();
      });
  }

  function noiseHit(
    start: number,
    seconds: number,
    peak: number,
    shape: (filter: BiquadFilterNode) => void,
  ) {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = noiseBuffer;
    shape(filter);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      peak,
      start + Math.min(0.02, seconds * 0.35),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfx);
    source.start(start);
    source.stop(start + seconds + 0.02);
  }

  function playSquare(
    midi: number,
    time: number,
    seconds: number,
    gain: number,
  ) {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(midiHz(midi), time);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    osc.connect(envelope);
    envelope.connect(sfx);
    osc.start(time);
    osc.stop(time + seconds + 0.02);
  }

  function release(envelope: GainNode, when: number) {
    envelope.gain.cancelScheduledValues(when);
    envelope.gain.setValueAtTime(Math.max(envelope.gain.value, 0.0001), when);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  }

  function stopper(sources: AudioScheduledSourceNode[], envelopes: GainNode[]) {
    let done = false;
    return {
      stop() {
        if (done || ctx.state === "closed") return;
        done = true;
        const now = ctx.currentTime;
        for (const envelope of envelopes) release(envelope, now);
        for (const source of sources) {
          try {
            source.stop(now + 0.05);
          } catch {
            // The approach tone already ended.
          }
        }
      },
    };
  }

  function rainSting() {
    const now = ctx.currentTime;
    const drops = [
      { at: 0, freq: 2800, gain: 0.18 },
      { at: 0.08, freq: 3600, gain: 0.14 },
      { at: 0.15, freq: 1900, gain: 0.16 },
      { at: 0.27, freq: 4200, gain: 0.12 },
    ];
    for (const drop of drops) {
      noiseHit(now + drop.at, 0.07, drop.gain, (filter) => {
        filter.type = "bandpass";
        filter.frequency.value = drop.freq;
        filter.Q.value = 4;
      });
    }
  }

  function sunSting() {
    const now = ctx.currentTime;
    for (const [index, midi] of [79, 83, 86].entries()) {
      playPulse(leadWave, midi, now + index * 0.11, 0.22, 0.3, sfx);
    }
  }

  function carrotSting() {
    const now = ctx.currentTime;
    playSquare(76, now, 0.1, 0.2);
    playSquare(83, now + 0.12, 0.12, 0.18);
  }

  function diseaseSting() {
    const now = ctx.currentTime;
    const seconds = 0.65;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    for (const detune of [1, 0.97]) {
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(210 * detune, now);
      osc.frequency.exponentialRampToValueAtTime(74 * detune, now + seconds);
      lfoGain.connect(osc.frequency);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      osc.connect(envelope);
      envelope.connect(sfx);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    }
    lfo.start(now);
    lfo.stop(now + seconds + 0.02);
  }

  function fireSting() {
    const now = ctx.currentTime;
    const pops = [
      { at: 0, freq: 900, seconds: 0.05, gain: 0.22 },
      { at: 0.05, freq: 1400, seconds: 0.04, gain: 0.16 },
      { at: 0.12, freq: 700, seconds: 0.08, gain: 0.2 },
      { at: 0.22, freq: 1600, seconds: 0.04, gain: 0.14 },
      { at: 0.31, freq: 1100, seconds: 0.07, gain: 0.16 },
    ];
    for (const pop of pops) {
      noiseHit(now + pop.at, pop.seconds, pop.gain, (filter) => {
        filter.type = "bandpass";
        filter.frequency.value = pop.freq;
        filter.Q.value = 0.7;
      });
    }
  }

  function tornadoSting() {
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.8);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.26, now + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfx);
    source.start(now);
    source.stop(now + 0.85);
  }

  function lightningSting() {
    const now = ctx.currentTime;
    noiseHit(now, 0.09, 0.48, (filter) => {
      filter.type = "highpass";
      filter.frequency.value = 5000;
    });
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1860, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.16, now + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(envelope);
    envelope.connect(sfx);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  function nukeWhistle() {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.7);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.34, now + 0.05);
    envelope.gain.exponentialRampToValueAtTime(0.22, now + 0.7);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    osc.connect(envelope);
    envelope.connect(sfx);
    osc.start(now);
    osc.stop(now + 1.55);
    return stopper([osc], [envelope]);
  }

  function meteorWhoosh() {
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseEnv = ctx.createGain();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 1.1);
    noiseEnv.gain.setValueAtTime(0.0001, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.3, now + 0.06);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    noise.connect(filter);
    filter.connect(noiseEnv);
    noiseEnv.connect(sfx);
    noise.start(now);
    noise.stop(now + 1.55);

    const osc = ctx.createOscillator();
    const oscEnv = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 1.1);
    oscEnv.gain.setValueAtTime(0.0001, now);
    oscEnv.gain.exponentialRampToValueAtTime(0.07, now + 0.06);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    osc.connect(oscEnv);
    oscEnv.connect(sfx);
    osc.start(now);
    osc.stop(now + 1.55);
    return stopper([noise, osc], [noiseEnv, oscEnv]);
  }

  function impactBlast(big: boolean) {
    const now = ctx.currentTime;
    const seconds = big ? 0.55 : 0.32;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(big ? 78 : 130, now);
    osc.frequency.exponentialRampToValueAtTime(big ? 32 : 48, now + seconds);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(big ? 0.5 : 0.32, now + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(envelope);
    envelope.connect(sfx);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
    noiseHit(now, big ? 0.42 : 0.24, big ? 0.45 : 0.26, (filter) => {
      filter.type = "lowpass";
      filter.frequency.value = big ? 700 : 1200;
    });
    if (big) {
      noiseHit(now, 0.18, 0.24, (filter) => {
        filter.type = "highpass";
        filter.frequency.value = 2200;
      });
    }
  }

  function playGodSound(kind: PowerId): GodSound {
    if (ctx.state === "closed") return SILENT_SOUND;
    let approach: { stop: () => void } | null = null;
    let closed = false;

    const start = () => {
      if (closed || ctx.state !== "running") return;
      if (!muted && !playing) begin();
      switch (kind) {
        case "rain":
          rainSting();
          break;
        case "sun":
          sunSting();
          break;
        case "raze":
          carrotSting();
          break;
        case "disease":
          diseaseSting();
          break;
        case "fire":
          fireSting();
          break;
        case "tornado":
          tornadoSting();
          break;
        case "lightning":
          lightningSting();
          break;
        case "nuke":
          approach = nukeWhistle();
          break;
        case "meteor":
          approach = meteorWhoosh();
          break;
      }
    };

    resumeThen(start);

    return {
      impact() {
        if (closed || !godSoundWaitsForImpact(kind)) return;
        const blast = () => {
          if (closed || ctx.state !== "running") return;
          approach?.stop();
          approach = null;
          impactBlast(kind === "nuke");
          closed = true;
        };
        if (ctx.state === "running") blast();
        else resumeThen(blast);
      },
      stop() {
        if (closed) return;
        closed = true;
        approach?.stop();
        approach = null;
      },
    };
  }

  return {
    setMuted(nextMuted) {
      muted = nextMuted;
      if (ctx.state === "closed") return;
      if (muted) {
        playing = false;
        starting = false;
        stopScheduler();
        clearUnlock();
        music.gain.cancelScheduledValues(ctx.currentTime);
        music.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
        return;
      }
      armUnlock();
      begin();
    },
    playGodSound,
    dispose() {
      muted = true;
      playing = false;
      starting = false;
      resuming = false;
      stopScheduler();
      clearUnlock();
      afterUnlock.length = 0;
      if (ctx.state !== "closed") void ctx.close();
    },
  };
}
