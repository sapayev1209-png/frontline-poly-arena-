import { SurfaceType, WEAPONS, WeaponId } from '../types/game';

class SoundController {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private masterVolume = 0.75;
  private sfxVolume = 0.8;
  private externalBuffers: Map<string, AudioBuffer> = new Map();

  public registerExternalSoundBuffer(soundId: string, buffer: AudioBuffer) {
    this.externalBuffers.set(soundId, buffer);
  }

  private tryPlayExternalBuffer(soundId: string, volumeScale = 1.0): boolean {
    const buf = this.externalBuffers.get(soundId);
    if (!buf) return false;
    const ctx = this.getContext();
    const vol = this.getGain() * volumeScale;
    if (!ctx || vol <= 0.01) return true;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);
    return true;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getGain(): number {
    return this.enabled ? this.masterVolume * this.sfxVolume : 0;
  }

  public setConfig(
    enabled: boolean,
    masterVolume: number,
    sfxVolume = 0.85
  ) {
    this.enabled = enabled;
    this.masterVolume = Math.max(0, Math.min(1, masterVolume));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
  }

  public playUiClick() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.035);

    gain.gain.setValueAtTime(0.12 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playGunshot(weaponId: WeaponId, distanceRatio = 0) {
    const ctx = this.getContext();
    const baseVol = this.getGain();
    if (!ctx || baseVol <= 0.01) return;

    const spec = WEAPONS[weaponId];
    if (!spec) return;

    const attenuation = Math.max(0.05, 1 - distanceRatio * 0.88) * baseVol;
    if (attenuation <= 0.01) return;

    const now = ctx.currentTime;
    const dur = spec.soundDuration;

    // 1. Percussive muzzle blast noise
    const bufferSize = Math.max(128, Math.floor(ctx.sampleRate * dur));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.34));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = spec.fireMode === 'spread' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(spec.soundPitch, now);
    filter.Q.setValueAtTime(spec.slot === 'secondary' ? 1.5 : 1.1, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35 * attenuation, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 2. Mechanical body punch oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type =
      spec.fireMode === 'spread' || spec.id === 's12_falcon'
        ? 'sawtooth'
        : 'triangle';
    const startFreq = Math.max(95, spec.soundPitch * 0.22);
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + dur * 0.85);

    oscGain.gain.setValueAtTime(0.38 * attenuation, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  public playEmptyClick() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.028);

    gain.gain.setValueAtTime(0.16 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playWeaponSwitch() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.05);

    gain.gain.setValueAtTime(0.14 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playFootstep(
    sprinting = false,
    surface: SurfaceType = 'earth'
  ) {
    if (this.tryPlayExternalBuffer(`footstep_${surface}`, sprinting ? 1.15 : 0.85)) {
      return;
    }
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq =
      surface === 'wood'
        ? 135
        : surface === 'interior'
        ? 148
        : surface === 'stone'
        ? 165
        : surface === 'water'
        ? 210
        : surface === 'grass'
        ? 98
        : 84;
    osc.type =
      surface === 'stone' || surface === 'interior'
        ? 'triangle'
        : surface === 'wood'
        ? 'square'
        : 'sine';
    osc.frequency.setValueAtTime(
      sprinting ? baseFreq * 1.22 : baseFreq,
      now
    );
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.058);

    gain.gain.setValueAtTime((sprinting ? 0.12 : 0.075) * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.062);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.068);
  }

  public playHitMarker(headshot = false) {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(headshot ? 1680 : 1120, now);
    osc.frequency.exponentialRampToValueAtTime(
      headshot ? 2450 : 720,
      now + 0.055
    );

    gain.gain.setValueAtTime(0.24 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playReload() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    [0, 0.18].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 420 : 640, now + offset);
      osc.frequency.exponentialRampToValueAtTime(
        idx === 0 ? 280 : 880,
        now + offset + 0.04
      );

      gain.gain.setValueAtTime(0.14 * vol, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });
  }

  public playReloadComplete() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.055);

    gain.gain.setValueAtTime(0.18 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playJump() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(285, now + 0.11);

    gain.gain.setValueAtTime(0.14 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.125);
  }

  public playLand() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.075);

    gain.gain.setValueAtTime(0.15 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playAbility() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    [440, 660].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      osc.frequency.exponentialRampToValueAtTime(
        freq * 1.25,
        now + idx * 0.06 + 0.12
      );

      gain.gain.setValueAtTime(0.18 * vol, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.15);
    });
  }

  public playPropBreak() {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

    gain.gain.setValueAtTime(0.2 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playObjectiveCapture(friendly: boolean) {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const notes = friendly ? [440, 554.37, 659.25] : [392, 349.23, 293.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);

      gain.gain.setValueAtTime(0.2 * vol, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.25);
    });
  }

  public playMatchEnd(victory: boolean) {
    const ctx = this.getContext();
    const vol = this.getGain();
    if (!ctx || vol <= 0.01) return;

    const now = ctx.currentTime;
    const chord = victory
      ? [523.25, 659.25, 783.99, 1046.5]
      : [392.0, 349.23, 311.13, 261.63];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.22 * vol, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.56);
    });
  }
}

export const soundFX = new SoundController();
