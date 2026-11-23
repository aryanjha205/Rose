/**
 * WebCall Procedural Web Audio API Synthesizer & Visualizer
 * Provides crystal-clear procedural ringtones, dialtones, call chimes, and live waveform analysis.
 */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.incomingInterval = null;
    this.outgoingInterval = null;
    this.analyser = null;
    this.visualizerAnimationId = null;
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play Incoming Ringtone (Pleasant melodic pink chime)
   */
  playIncomingRingtone() {
    this.stopIncomingRingtone();
    const ctx = this.getAudioContext();

    const ringPattern = () => {
      if (!this.incomingInterval) return;
      const now = ctx.currentTime;
      // Gentle 4-note melodic chime (F5, A5, C6, E6)
      const notes = [698.46, 880.00, 1046.50, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.5);
      });
    };

    ringPattern();
    this.incomingInterval = setInterval(ringPattern, 2400);
  }

  stopIncomingRingtone() {
    if (this.incomingInterval) {
      clearInterval(this.incomingInterval);
      this.incomingInterval = null;
    }
  }

  /**
   * Play Outgoing Dial Tone / Ringback
   */
  playOutgoingDialtone() {
    this.stopOutgoingDialtone();
    const ctx = this.getAudioContext();

    const dialTone = () => {
      if (!this.outgoingInterval) return;
      const now = ctx.currentTime;
      // Dual-tone 440Hz + 480Hz PBX ring
      [440, 480].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.setValueAtTime(0.12, now + 1.2);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.3);
      });
    };

    dialTone();
    this.outgoingInterval = setInterval(dialTone, 3500);
  }

  stopOutgoingDialtone() {
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }

  /**
   * Play Call Connected Chime
   */
  playCallConnectedTone() {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.18, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.4);
    });
  }

  /**
   * Play Call End Tone
   */
  playCallEndTone() {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    [783.99, 659.25, 523.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.15, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.35);
    });
  }

  /**
   * Real-Time Voice Waveform Visualizer with Organic Breathing State
   */
  startWaveformVisualizer(stream, canvas) {
    if (!canvas) return;
    this.stopWaveformVisualizer();

    const ctx = this.getAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 64;
    source.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvasCtx = canvas.getContext("2d");
    let idlePhase = 0;

    const render = () => {
      this.visualizerAnimationId = requestAnimationFrame(render);
      this.analyser.getByteFrequencyData(dataArray);

      let activitySum = 0;
      for (let i = 0; i < bufferLength; i++) {
        activitySum += dataArray[i];
      }
      const isQuiet = activitySum < 15;

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const numBars = 22;
      const barWidth = 6;
      const spacing = 8;
      const totalWidth = numBars * (barWidth + spacing) - spacing;
      const startX = (canvas.width - totalWidth) / 2;
      const centerY = canvas.height / 2;

      idlePhase += 0.04;

      for (let i = 0; i < numBars; i++) {
        let val = 0;
        if (isQuiet) {
          // Gentle organic sine wave when silent
          val = Math.sin(idlePhase + i * 0.35) * 16 + 20;
        } else {
          const sampleIndex = Math.floor((i / numBars) * bufferLength);
          val = dataArray[sampleIndex] || 0;
        }

        const barHeight = Math.max(8, (val / 255) * canvas.height * 0.82);
        const x = startX + i * (barWidth + spacing);
        const y = centerY - barHeight / 2;

        // Vivid Pink to Purple Neon Gradient
        const gradient = canvasCtx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, "#FF4F9A");
        gradient.addColorStop(0.5, "#F72585");
        gradient.addColorStop(1, "#7928CA");

        canvasCtx.fillStyle = gradient;
        canvasCtx.shadowBlur = 8;
        canvasCtx.shadowColor = "rgba(255, 79, 154, 0.4)";

        canvasCtx.beginPath();
        if (canvasCtx.roundRect) {
          canvasCtx.roundRect(x, y, barWidth, barHeight, 3);
        } else {
          canvasCtx.rect(x, y, barWidth, barHeight);
        }
        canvasCtx.fill();
      }
    };

    render();
  }

  stopWaveformVisualizer() {
    if (this.visualizerAnimationId) {
      cancelAnimationFrame(this.visualizerAnimationId);
      this.visualizerAnimationId = null;
    }
    this.analyser = null;
  }
}

window.soundManager = new SoundManager();
