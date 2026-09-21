export type Chiptune = {
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

const BPM = 100;
const STEPS = 128;
const STEP_SECONDS = 60 / BPM / 4;
const MASTER_GAIN = 0.11;
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
    return { setMuted() {}, dispose() {} };
  }

  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2600;
  tone.Q.value = 0.65;
  master.connect(tone);
  tone.connect(ctx.destination);

  const leadWave = pulseWave(ctx, 0.5);
  const arpWave = pulseWave(ctx, 0.25);
  const noiseBuffer = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * 0.08),
    ctx.sampleRate,
  );
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  let muted = true;
  let playing = false;
  let timer = 0;
  let nextStep = 0;
  let nextTime = 0;
  const unlockers: Array<{ type: string; fn: () => void }> = [];

  function playPulse(
    wave: PeriodicWave,
    midi: number,
    time: number,
    seconds: number,
    gain: number,
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
    envelope.connect(master);
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
    envelope.connect(master);
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
    envelope.connect(master);
    source.start(time);
    source.stop(time + 0.05);
  }

  function schedule() {
    const horizon = ctx.currentTime + 0.18;
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
    if (muted || playing || ctx.state === "closed") return;
    void ctx
      .resume()
      .then(() => {
        if (muted || ctx.state === "closed") return;
        if (ctx.state !== "running") {
          armUnlock();
          return;
        }
        playing = true;
        nextTime = ctx.currentTime + 0.06;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(MASTER_GAIN, ctx.currentTime);
        stopScheduler();
        schedule();
        timer = window.setInterval(schedule, 40);
      })
      .catch(() => {
        armUnlock();
      });
  }

  function armUnlock() {
    if (unlockers.length) return;
    const unlock = () => {
      for (const { type, fn } of unlockers) {
        window.removeEventListener(type, fn);
      }
      unlockers.length = 0;
      begin();
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

  return {
    setMuted(nextMuted) {
      muted = nextMuted;
      if (muted) {
        playing = false;
        stopScheduler();
        clearUnlock();
        if (ctx.state !== "closed") {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
          void ctx.suspend();
        }
        return;
      }
      armUnlock();
      begin();
    },
    dispose() {
      muted = true;
      playing = false;
      stopScheduler();
      clearUnlock();
      if (ctx.state !== "closed") void ctx.close();
    },
  };
}
