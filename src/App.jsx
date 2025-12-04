import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as Tone from 'tone'

const DOMAIN = { min: -5, max: 5 }
const DOMAIN_SIZE = DOMAIN.max - DOMAIN.min
const MAX_VOICES = 16
const MAX_PARTICLES = 60
const GRAPH_CANVAS = { w: 180, h: 90 }

const SCALE_FREQS = [130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25]

const CONVERGENCE = {
  minAge: 60,
  lossThreshold: 0.20,
  stabilityWindow: 30,
  varianceThreshold: 0.001,
  checkInterval: 10
}

const GRAPH = {
  historyLength: 60,
  updateInterval: 50
}

const PHYSICS = {
  baseNoiseScale: 0.06,
  noiseDecayRate: 200,
  minNoiseFactor: 0.1,
  gradientStep: 0.01,
  maxGradient: 10,
  maxVelNormalized: 8,
  maxVelStandard: 15,
  trailLength: 50,
  minLife: 600,
  maxLifeBonus: 400
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400&family=Syne:wght@600;700&display=swap');

:root {
  --text-overlay: #e8e8f0;
  --text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8);
  --panel-text: #d0d0d8;
  --panel-text-dim: #a0a0b0;
  --panel-text-bright: #e8e8f0;
  --accent: #00fff2;
  --accent-dim: #00d4c8;
  --success: #00ff88;
  --warning: #ffb400;
  --error: #ff6688;
  --panel-bg: rgba(6, 6, 12, 0.55);
  --panel-border: rgba(255, 255, 255, 0.06);
  --btn-bg: rgba(255, 255, 255, 0.05);
  --btn-border: rgba(255, 255, 255, 0.12);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'JetBrains Mono', monospace;
  background: #000;
  overflow: hidden;
}

.container {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #000;
}

canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.header {
  position: absolute;
  top: 2rem;
  left: 2rem;
  z-index: 10;
}

.logo {
  font-family: 'Syne', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #ffffff;
  text-transform: uppercase;
  text-shadow: var(--text-shadow);
}

.logo-accent { color: var(--accent); margin-right: 0.5rem; }

.subtitle {
  font-size: 0.7rem;
  letter-spacing: 0.3em;
  color: var(--text-overlay);
  text-transform: uppercase;
  margin-top: 0.25rem;
  text-shadow: var(--text-shadow);
}

.stats {
  position: absolute;
  top: 2rem;
  right: 2rem;
  display: flex;
  gap: 1.5rem;
  z-index: 10;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-label {
  font-size: 0.55rem;
  letter-spacing: 0.15em;
  color: var(--text-overlay);
  text-transform: uppercase;
  font-weight: 400;
  text-shadow: var(--text-shadow);
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 400;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  text-shadow: var(--text-shadow);
}

.glass-panel {
  background: var(--panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--panel-border);
  z-index: 10;
}

.bottom-panels {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  display: flex;
  gap: 0.75rem;
  z-index: 10;
  align-items: flex-end;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.2rem;
  width: 280px;
}

.panel.minimized { 
  padding: 0.6rem 1rem; 
  gap: 0; 
  width: auto;
  min-width: 90px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}

.panel-title {
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: var(--panel-text);
  text-transform: uppercase;
  font-weight: 400;
}

.minimize-btn {
  background: none;
  border: none;
  color: var(--panel-text);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 0.3rem;
  line-height: 1;
}

.minimize-btn:hover { color: var(--panel-text-bright); }

.section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--panel-text);
  text-transform: uppercase;
}

.label-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-group {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.35rem 0.5rem;
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  color: var(--panel-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:hover { background: rgba(255, 255, 255, 0.1); color: var(--panel-text-bright); }
.btn.active { background: rgba(0, 255, 242, 0.15); border-color: var(--accent); color: var(--accent); }
.btn.pause-active { background: rgba(255, 180, 0, 0.18); border-color: var(--warning); color: var(--warning); }

.btn-group.landscape-btns {
  display: flex;
  gap: 0.3rem;
}

.btn-group.landscape-btns .btn {
  padding: 0.35rem 0.45rem;
  font-size: 0.5rem;
}

.slider {
  width: 100%;
  height: 4px;
  appearance: none;
  background: rgba(255, 255, 255, 0.15);
  outline: none;
  cursor: pointer;
  border-radius: 2px;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
}

.toggles {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.6rem;
  color: var(--panel-text);
  cursor: pointer;
}

.checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--panel-text-dim);
  font-size: 0.5rem;
  color: var(--panel-text-dim);
  cursor: pointer;
  flex-shrink: 0;
}

.info-icon:hover { border-color: var(--panel-text); color: var(--panel-text); }

.legend {
  position: absolute;
  top: 5.5rem;
  right: 2rem;
  padding: 0.6rem 0.8rem;
}

.legend-label {
  font-size: 0.55rem;
  letter-spacing: 0.15em;
  color: var(--panel-text);
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.legend-bar {
  width: 90px;
  height: 6px;
  border-radius: 2px;
  background: linear-gradient(to right, rgb(0, 255, 242), rgb(128, 180, 200), rgb(255, 100, 172));
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.2rem;
}

.legend-stop {
  font-size: 0.5rem;
  color: var(--panel-text-dim);
}

.tracker {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.8rem 1rem;
  min-width: 150px;
}

.tracker.minimized { 
  padding: 0.6rem 1rem; 
  gap: 0; 
  min-width: auto;
}

.tracker-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
}

.tracker-label {
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  color: var(--panel-text);
  text-transform: uppercase;
}

.tracker-value {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.tracker-value.converged { color: var(--success); }
.tracker-value.expired { color: var(--error); }

.graph-panel {
  display: flex;
  flex-direction: column;
  padding: 0.8rem 1rem;
  min-width: 150px;
}

.graph-panel.minimized { 
  padding: 0.6rem 1rem; 
  min-width: auto;
}

.graph-title {
  font-size: 0.55rem;
  letter-spacing: 0.15em;
  color: var(--panel-text);
  text-transform: uppercase;
  margin-bottom: 0.4rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.graph-container {
  position: relative;
  width: 180px;
  height: 90px;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.graph-legend {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.35rem;
  font-size: 0.42rem;
}

.graph-legend-item {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--panel-text-dim);
}

.graph-legend-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.graph-legend-dot.active { background: var(--accent); }
.graph-legend-dot.converged { background: var(--success); }
.graph-legend-dot.expired { background: var(--error); }

.bottom-right {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.6rem;
  z-index: 10;
}

.instructions {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: var(--text-overlay);
  text-shadow: var(--text-shadow);
}

.about-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  padding: 0.45rem 0.7rem;
  background: rgba(0, 255, 242, 0.08);
  border: 1px solid rgba(0, 255, 242, 0.25);
  color: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  text-shadow: var(--text-shadow);
}

.about-btn:hover { background: rgba(0, 255, 242, 0.15); }

.corner {
  position: absolute;
  width: 80px;
  height: 80px;
  pointer-events: none;
}

.corner-tl {
  top: 0;
  left: 0;
  border-left: 1px solid rgba(0, 255, 242, 0.15);
  border-top: 1px solid rgba(0, 255, 242, 0.15);
}

.corner-br {
  bottom: 0;
  right: 0;
  border-right: 1px solid rgba(0, 255, 242, 0.15);
  border-bottom: 1px solid rgba(0, 255, 242, 0.15);
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.info-panel {
  background: #080810;
  border: 1px solid rgba(0, 255, 242, 0.15);
  max-width: 560px;
  max-height: 75vh;
  overflow: auto;
  margin: 2rem;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-title {
  font-family: 'Syne', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.close-btn {
  background: none;
  border: none;
  color: var(--panel-text-dim);
  font-size: 1.3rem;
  cursor: pointer;
}

.close-btn:hover { color: var(--panel-text-bright); }

.info-content { padding: 1.2rem; }

.info-text {
  font-size: 0.7rem;
  line-height: 1.8;
  color: var(--panel-text-dim);
  margin-bottom: 1rem;
  white-space: pre-wrap;
}

.info-text:last-child { margin-bottom: 0; }

.paused-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Syne', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: rgba(255, 180, 0, 0.5);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 5;
}

@media (max-width: 768px) {
  .header {
    top: 1rem;
    left: 1rem;
  }
  
  .logo { font-size: 1.1rem; }
  .subtitle { font-size: 0.55rem; letter-spacing: 0.2em; }
  
  .stats {
    top: 1rem;
    right: 1rem;
    gap: 0.8rem;
  }
  
  .stat-label { font-size: 0.45rem; }
  .stat-value { font-size: 0.9rem; }
  
  .legend {
    top: auto;
    bottom: 1rem;
    right: 1rem;
    padding: 0.5rem 0.6rem;
  }
  
  .bottom-panels {
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .panel {
    width: 100%;
    padding: 0.8rem;
    gap: 0.5rem;
  }
  
  .panel.minimized { width: 100%; }
  
  .tracker {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    padding: 0.6rem 0.8rem;
    min-width: auto;
  }
  
  .tracker.minimized { flex-direction: row; }
  
  .tracker-row { gap: 0.4rem; }
  
  .graph-panel {
    width: 100%;
    min-width: auto;
    padding: 0.6rem 0.8rem;
  }
  
  .graph-container {
    width: 100%;
    height: 50px;
  }
  
  .bottom-right {
    bottom: auto;
    top: 4.5rem;
    right: 1rem;
  }
  
  .instructions { display: none; }
  
  .corner { width: 40px; height: 40px; }
  
  .info-panel {
    margin: 1rem;
    max-height: 85vh;
  }
  
  .paused-overlay { font-size: 1.2rem; }
  
  .btn { padding: 0.4rem 0.5rem; }
  .btn-group.landscape-btns .btn { padding: 0.35rem 0.4rem; }
}
`

const lossFunctions = {
  rastrigin: {
    name: 'Rastrigin',
    fn: (x, y) => {
      const A = 10
      return A * 2 + (x * x - A * Math.cos(2 * Math.PI * x)) + (y * y - A * Math.cos(2 * Math.PI * y))
    }
  },
  ackley: {
    name: 'Ackley',
    fn: (x, y) => {
      const a = 20, b = 0.2, c = 2 * Math.PI
      return -a * Math.exp(-b * Math.sqrt(0.5 * (x * x + y * y))) -
             Math.exp(0.5 * (Math.cos(c * x) + Math.cos(c * y))) + a + Math.E
    }
  },
  himmelblau: {
    name: 'Himmelblau',
    fn: (x, y) => Math.pow(x * x + y - 11, 2) + Math.pow(x + y * y - 7, 2)
  }
}

function canvasToDomain(px, py, width, height) {
  const size = Math.min(width, height)
  const offsetX = (width - size) / 2
  const offsetY = (height - size) / 2
  return {
    x: ((px - offsetX) / size) * DOMAIN_SIZE + DOMAIN.min,
    y: ((py - offsetY) / size) * DOMAIN_SIZE + DOMAIN.min
  }
}

class AudioEngine {
  constructor() {
    this.ready = false
    this.voices = new Map()
  }

  async init() {
    if (this.ready) return
    await Tone.start()
    
    this.reverb = new Tone.Reverb({ decay: 6, wet: 0.4 }).toDestination()
    this.filter = new Tone.Filter({ frequency: 1200, type: 'lowpass', rolloff: -12 }).connect(this.reverb)
    this.compressor = new Tone.Compressor(-18, 3).connect(this.filter)
    
    this.spawnSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0, release: 0.2 }
    }).connect(this.reverb)
    this.spawnSynth.volume.value = -24
    
    this.convergeSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.1, release: 0.8 }
    }).connect(this.reverb)
    this.convergeSynth.volume.value = -18
    
    this.ready = true
  }

  playSpawn(normalizedY) {
    if (!this.ready) return
    const freqs = [261.63, 293.66, 329.63, 392, 440]
    const idx = Math.floor((1 - normalizedY) * (freqs.length - 1))
    this.spawnSynth.triggerAttackRelease(freqs[idx], 0.2)
  }

  playConverge() {
    if (!this.ready) return
    const notes = [261.63, 329.63, 392]
    notes.forEach((freq, i) => {
      setTimeout(() => this.convergeSynth.triggerAttackRelease(freq, 0.5), i * 60)
    })
  }

  startVoice(id, normalizedX, normalizedLoss) {
    if (!this.ready || this.voices.size >= MAX_VOICES || this.voices.has(id)) return false
    
    const panner = new Tone.Panner(normalizedX * 2 - 1).connect(this.compressor)
    const synth = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 0.3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.4, decay: 0.2, sustain: 0.7, release: 1.2 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.5, decay: 0.3, sustain: 0.4, release: 0.8 }
    }).connect(panner)
    
    const freqIdx = Math.floor((1 - normalizedLoss) * (SCALE_FREQS.length - 1))
    synth.volume.value = -32
    synth.triggerAttack(SCALE_FREQS[Math.max(0, Math.min(freqIdx, SCALE_FREQS.length - 1))])
    
    this.voices.set(id, { synth, panner })
    return true
  }

  updateVoice(id, normalizedX, normalizedLoss, velocity, gradientMag) {
    const voice = this.voices.get(id)
    if (!voice) return
    
    voice.panner.pan.rampTo(normalizedX * 2 - 1, 0.2)
    
    const freqIdx = (1 - normalizedLoss) * (SCALE_FREQS.length - 1)
    const lowIdx = Math.floor(freqIdx)
    const highIdx = Math.min(lowIdx + 1, SCALE_FREQS.length - 1)
    const freq = SCALE_FREQS[lowIdx] * (1 - (freqIdx - lowIdx)) + SCALE_FREQS[highIdx] * (freqIdx - lowIdx)
    voice.synth.frequency.rampTo(freq, 0.3)
    
    voice.synth.volume.rampTo(-38 + Math.min(velocity * 2, 8), 0.2)
    voice.synth.modulationIndex.rampTo(0.2 + Math.min(gradientMag * 0.03, 0.6), 0.3)
    this.filter.frequency.rampTo(600 + Math.min(velocity * 40, 400), 0.2)
  }

  stopVoice(id) {
    const voice = this.voices.get(id)
    if (!voice) return
    this.voices.delete(id)
    voice.synth.triggerRelease()
    setTimeout(() => {
      try { voice.synth.dispose(); voice.panner.dispose() } catch {}
    }, 1200)
  }

  stopAll() {
    this.voices.forEach(voice => {
      voice.synth.triggerRelease()
      setTimeout(() => {
        try { voice.synth.dispose(); voice.panner.dispose() } catch {}
      }, 1200)
    })
    this.voices.clear()
  }

  dispose() {
    this.stopAll()
    try {
      this.reverb?.dispose()
      this.filter?.dispose()
      this.compressor?.dispose()
      this.spawnSynth?.dispose()
      this.convergeSynth?.dispose()
    } catch {}
    this.ready = false
  }
}

let particleId = 0

class Particle {
  constructor(x, y, width, height) {
    this.id = particleId++
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.vx = 0
    this.vy = 0
    
    this.maxLife = PHYSICS.minLife + Math.random() * PHYSICS.maxLifeBonus
    this.age = 0
    this.life = 1
    this.size = 3 + Math.random() * 2
    
    this.trail = []
    this.recentLosses = []
    
    this.velocity = 0
    this.gradientMag = 0
    this.currentLoss = 0
    this.normalizedLoss = 0
    this.color = { r: 0, g: 255, b: 242 }
    
    this.sonified = false
    this.converged = false
    this.deathReason = null
  }

  update(lossFn, lossRange, lr, mom, norm) {
    const { x: domX, y: domY } = canvasToDomain(this.x, this.y, this.width, this.height)
    
    const h = PHYSICS.gradientStep
    const dfdx = (lossFn(domX + h, domY) - lossFn(domX - h, domY)) / (2 * h)
    const dfdy = (lossFn(domX, domY + h) - lossFn(domX, domY - h)) / (2 * h)
    this.gradientMag = Math.sqrt(dfdx * dfdx + dfdy * dfdy)
    
    let stepX = dfdx, stepY = dfdy
    if (norm) {
      const n = this.gradientMag + 1e-4
      stepX = dfdx / n
      stepY = dfdy / n
    } else if (this.gradientMag > PHYSICS.maxGradient) {
      const scale = PHYSICS.maxGradient / this.gradientMag
      stepX *= scale
      stepY *= scale
    }
    
    const noiseDecay = Math.max(PHYSICS.minNoiseFactor, Math.exp(-this.age / PHYSICS.noiseDecayRate))
    const noise = PHYSICS.baseNoiseScale * noiseDecay
    const noiseX = (Math.random() - 0.5) * noise
    const noiseY = (Math.random() - 0.5) * noise
    
    const pixelScale = Math.min(this.width, this.height) / DOMAIN_SIZE
    this.vx = mom * this.vx - lr * (stepX + noiseX) * pixelScale
    this.vy = mom * this.vy - lr * (stepY + noiseY) * pixelScale
    
    const maxVel = norm ? PHYSICS.maxVelNormalized : PHYSICS.maxVelStandard
    this.velocity = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
    if (this.velocity > maxVel) {
      const scale = maxVel / this.velocity
      this.vx *= scale
      this.vy *= scale
      this.velocity = maxVel
    }
    
    this.trail.push({ x: this.x, y: this.y })
    if (this.trail.length > PHYSICS.trailLength) this.trail.shift()
    
    this.x += this.vx
    this.y += this.vy
    
    if (this.x < 0 || this.x > this.width) {
      this.vx *= -0.5
      this.x = Math.max(0, Math.min(this.width, this.x))
    }
    if (this.y < 0 || this.y > this.height) {
      this.vy *= -0.5
      this.y = Math.max(0, Math.min(this.height, this.y))
    }
    
    const { x: newDomX, y: newDomY } = canvasToDomain(this.x, this.y, this.width, this.height)
    this.currentLoss = lossFn(newDomX, newDomY)
    const range = lossRange.max - lossRange.min + 0.001
    this.normalizedLoss = Math.max(0, Math.min(1, (this.currentLoss - lossRange.min) / range))
    
    const t = this.normalizedLoss
    this.color = {
      r: Math.floor(255 * t),
      g: Math.floor(255 * (1 - t * 0.6)),
      b: Math.floor(242 - 70 * t)
    }
    
    this.recentLosses.push(this.normalizedLoss)
    if (this.recentLosses.length > CONVERGENCE.stabilityWindow) this.recentLosses.shift()
    
    if (!this.converged && 
        this.age > CONVERGENCE.minAge && 
        this.age % CONVERGENCE.checkInterval === 0 &&
        this.recentLosses.length === CONVERGENCE.stabilityWindow) {
      const avg = this.recentLosses.reduce((a, b) => a + b, 0) / CONVERGENCE.stabilityWindow
      const variance = this.recentLosses.reduce((s, l) => s + (l - avg) ** 2, 0) / CONVERGENCE.stabilityWindow
      
      if (variance < CONVERGENCE.varianceThreshold && avg < CONVERGENCE.lossThreshold) {
        this.converged = true
        this.deathReason = 'converged'
      }
    }
    
    this.age++
    this.life = Math.max(0, 1 - this.age / this.maxLife)
    
    if (this.life <= 0 && !this.deathReason) {
      this.deathReason = 'expired'
    }
    
    return this.life > 0
  }

  draw(ctx) {
    const { r, g, b } = this.color
    
    if (this.trail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(this.trail[0].x, this.trail[0].y)
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y)
      }
      const grad = ctx.createLinearGradient(this.trail[0].x, this.trail[0].y, this.x, this.y)
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.5 * this.life})`)
      ctx.strokeStyle = grad
      ctx.lineWidth = this.size * 0.8
      ctx.lineCap = 'round'
      ctx.stroke()
    }
    
    if (this.sonified) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size * 5 * this.life, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * this.life})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    
    if (this.converged) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size * 6 * this.life, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0, 255, 136, ${0.6 * this.life})`
      ctx.lineWidth = 2
      ctx.stroke()
    }
    
    const glowSize = this.size * 4 * this.life
    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize)
    glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${this.life})`)
    glow.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${0.5 * this.life})`)
    glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.beginPath()
    ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
    
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size * 1.2 * this.life, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${this.life})`
    ctx.fill()
  }
}

const INFO = {
  fn: {
    title: 'Loss Landscapes',
    content: `Three benchmark optimization functions shown as 2D surfaces. Color indicates loss value — cyan is low, magenta is high. Particles descend toward darker cyan regions.

• Rastrigin — Regular grid of local minima surrounding a global minimum at center. Tests escape from local optima via momentum and noise.

• Ackley — Flat outer region with a sharp funnel to the global minimum. Tests whether particles can detect weak gradient signals.

• Himmelblau — Four symmetric global minima. Particles converge to whichever basin they start nearest.`
  },
  sgd: {
    title: 'SGD Modes',
    content: `Two gradient descent variants affecting how particles move:

Standard SGD — Step size scales with gradient magnitude. Particles accelerate in steep regions and crawl through flat areas. Can oscillate in narrow valleys.

Normalized SGD — Constant step size regardless of gradient steepness. Better at escaping shallow local minima but may overshoot narrow valleys.`
  },
  spawn: {
    title: 'Auto Spawn',
    content: `When enabled, particles spawn automatically at random positions across the landscape.

Disable for manual control — click anywhere to spawn particles, or click and drag to paint continuous streams.`
  },
  audio: {
    title: 'Audio Sonification',
    content: `Each particle generates a tone based on its optimization state:

• Pitch — Lower loss produces higher pitch. Converging particles rise in frequency.
• Stereo pan — Horizontal position maps to left/right speaker placement.
• Timbre — Gradient magnitude increases FM modulation complexity.
• Convergence — Finding a minimum triggers a resolving chord.`
  },
  tracker: {
    title: 'Particle Outcomes',
    content: `Converged — Particle settled into a minimum. Loss variance dropped below threshold while maintaining low absolute loss. Shown with green ring.

Expired — Particle reached maximum lifespan without converging. Happens in flat regions or when stuck oscillating.

Active — Currently descending, following the negative gradient with momentum.`
  },
  graph: {
    title: 'Rate Graph',
    content: `Tracks particle population over time:

• Cyan line — Active particle count
• Green area — Convergence rate per interval
• Red area — Expiration rate per interval

High convergence with low expiration indicates effective optimization settings.`
  },
  about: {
    title: 'About Gradient Flow',
    content: `Gradient descent is the optimization algorithm that trains neural networks. This visualization shows particles following the steepest downward path through a loss landscape.

Particle color indicates loss value — cyan at minima, magenta at maxima. Trails show recent trajectory. Green rings mark convergence.

Caveats: Real networks optimize over millions of dimensions. This 2D projection builds intuition for optimization dynamics.

By Jeremy Hsiao 2025.`
  }
}

export default function App() {
  const canvasRef = useRef(null)
  const graphCanvasRef = useRef(null)
  const particles = useRef([])
  const audioEngine = useRef(null)
  const landscape = useRef(null)
  const mouse = useRef({ x: 0, y: 0, down: false })
  const animationId = useRef(null)
  const spawnTimer = useRef(0)
  const dragSpawnTimer = useRef(0)
  const fpsCounter = useRef({ count: 0, lastTime: 0 })
  const statsCounter = useRef({ converged: 0, expired: 0 })
  const graphHistory = useRef({
    active: [],
    converged: [],
    expired: [],
    lastConverged: 0,
    lastExpired: 0,
    lastUpdate: 0
  })
  const dpr = useRef(1)
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [lossFnKey, setLossFnKey] = useState('rastrigin')
  const [learningRate, setLearningRate] = useState(0.8)
  const [momentum, setMomentum] = useState(0.85)
  const [normalizeGradient, setNormalizeGradient] = useState(true)
  const [autoSpawn, setAutoSpawn] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [paused, setPaused] = useState(false)
  const [particleCount, setParticleCount] = useState(0)
  const [minLoss, setMinLoss] = useState(null)
  const [fps, setFps] = useState(0)
  const [panelMin, setPanelMin] = useState(false)
  const [trackerMin, setTrackerMin] = useState(false)
  const [graphMin, setGraphMin] = useState(false)
  const [infoKey, setInfoKey] = useState(null)
  const [stats, setStats] = useState({ converged: 0, expired: 0, active: 0 })
  const [lossRange, setLossRange] = useState({ min: 0, max: 100 })

  const renderLandscape = useCallback((w, h, fnKey) => {
    if (w === 0 || h === 0) return
    
    const fn = lossFunctions[fnKey].fn
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(w, h)
    
    const size = Math.min(w, h)
    const offsetX = (w - size) / 2
    const offsetY = (h - size) / 2
    
    let minVal = Infinity, maxVal = -Infinity
    const values = new Float32Array(w * h)
    
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = ((px - offsetX) / size) * DOMAIN_SIZE + DOMAIN.min
        const y = ((py - offsetY) / size) * DOMAIN_SIZE + DOMAIN.min
        const val = fn(x, y)
        const idx = py * w + px
        values[idx] = val
        minVal = Math.min(minVal, val)
        maxVal = Math.max(maxVal, val)
      }
    }
    
    setLossRange({ min: minVal, max: maxVal })
    const range = maxVal - minVal + 0.001
    
    for (let i = 0; i < values.length; i++) {
      const normalized = (values[i] - minVal) / range
      const logNorm = Math.log(1 + normalized * 9) / Math.log(10)
      const brightness = 0.15 + logNorm * 0.6
      imageData.data[i * 4] = 255 * normalized * brightness
      imageData.data[i * 4 + 1] = 255 * (1 - normalized * 0.6) * brightness
      imageData.data[i * 4 + 2] = (242 - 70 * normalized) * brightness
      imageData.data[i * 4 + 3] = 255
    }
    
    ctx.putImageData(imageData, 0, 0)
    landscape.current = canvas
  }, [])

  const spawnParticles = useCallback((cx, cy, count = 1) => {
    const { width, height } = dimensions
    if (width === 0 || height === 0 || particles.current.length >= MAX_PARTICLES) return
    
    const toSpawn = Math.min(count, MAX_PARTICLES - particles.current.length)
    for (let i = 0; i < toSpawn; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 20
      particles.current.push(new Particle(
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius,
        width, height
      ))
    }
    
    if (audioEnabled && audioEngine.current?.ready) {
      audioEngine.current.playSpawn(cy / height)
    }
  }, [dimensions, audioEnabled])

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      dpr.current = window.devicePixelRatio || 1
      setDimensions({ width: w, height: h })
      
      if (canvasRef.current) {
        canvasRef.current.width = w * dpr.current
        canvasRef.current.height = h * dpr.current
        const ctx = canvasRef.current.getContext('2d')
        ctx.scale(dpr.current, dpr.current)
      }
      
      if (graphCanvasRef.current) {
        graphCanvasRef.current.width = GRAPH_CANVAS.w * dpr.current
        graphCanvasRef.current.height = GRAPH_CANVAS.h * dpr.current
        const ctx = graphCanvasRef.current.getContext('2d')
        ctx.scale(dpr.current, dpr.current)
      }
      
      renderLandscape(w, h, lossFnKey)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [renderLandscape, lossFnKey])

  useEffect(() => {
    renderLandscape(dimensions.width, dimensions.height, lossFnKey)
  }, [lossFnKey, renderLandscape, dimensions])

  useEffect(() => {
    audioEngine.current = new AudioEngine()
    return () => audioEngine.current?.dispose()
  }, [])

  const drawGraph = useCallback(() => {
    const canvas = graphCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = GRAPH_CANVAS.w
    const h = GRAPH_CANVAS.h
    const gh = graphHistory.current
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, w, h)
    
    if (gh.active.length < 2) return
    
    const maxActive = Math.max(...gh.active, 1)
    const maxRate = Math.max(...gh.converged, ...gh.expired, 1)
    
    const len = gh.active.length
    const stepX = w / (GRAPH.historyLength - 1)
    const startX = w - (len - 1) * stepX
    
    ctx.beginPath()
    ctx.moveTo(startX, h)
    for (let i = 0; i < len; i++) {
      const x = startX + i * stepX
      const y = h - (gh.expired[i] / maxRate) * (h * 0.4)
      ctx.lineTo(x, y)
    }
    ctx.lineTo(startX + (len - 1) * stepX, h)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 100, 136, 0.4)'
    ctx.fill()
    
    ctx.beginPath()
    ctx.moveTo(startX, h)
    for (let i = 0; i < len; i++) {
      const x = startX + i * stepX
      const expiredY = (gh.expired[i] / maxRate) * (h * 0.4)
      const convergedY = (gh.converged[i] / maxRate) * (h * 0.4)
      const y = h - expiredY - convergedY
      ctx.lineTo(x, y)
    }
    for (let i = len - 1; i >= 0; i--) {
      const x = startX + i * stepX
      const y = h - (gh.expired[i] / maxRate) * (h * 0.4)
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(0, 255, 136, 0.4)'
    ctx.fill()
    
    ctx.beginPath()
    for (let i = 0; i < len; i++) {
      const x = startX + i * stepX
      const y = h - (gh.active[i] / maxActive) * (h * 0.85) - 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#00fff2'
    ctx.lineWidth = 1.5
    ctx.stroke()
    
    ctx.fillStyle = 'rgba(200, 200, 208, 0.5)'
    ctx.font = '7px JetBrains Mono'
    ctx.textAlign = 'left'
    ctx.fillText(maxActive.toString(), 2, 8)
    ctx.fillText('0', 2, h - 2)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const animate = (time) => {
      const { width: w, height: h } = dimensions
      
      fpsCounter.current.count++
      if (time - fpsCounter.current.lastTime >= 1000) {
        setFps(fpsCounter.current.count)
        fpsCounter.current.count = 0
        fpsCounter.current.lastTime = time
      }

      if (w === 0 || h === 0) {
        animationId.current = requestAnimationFrame(animate)
        return
      }

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)

      if (landscape.current) {
        ctx.globalAlpha = 0.9
        ctx.drawImage(landscape.current, 0, 0)
        ctx.globalAlpha = 1
      }

      if (!paused) {
        if (autoSpawn && particles.current.length < MAX_PARTICLES) {
          if (++spawnTimer.current >= 70) {
            spawnTimer.current = 0
            spawnParticles(Math.random() * w, Math.random() * h, 2)
          }
        }

        if (mouse.current.down) {
          dragSpawnTimer.current++
          if (dragSpawnTimer.current >= 3) {
            dragSpawnTimer.current = 0
            spawnParticles(mouse.current.x, mouse.current.y, 2)
          }
        }

        const lossFn = lossFunctions[lossFnKey].fn
        let currentMinLoss = Infinity
        const deadIds = []

        particles.current = particles.current.filter(p => {
          const alive = p.update(lossFn, lossRange, learningRate, momentum, normalizeGradient)
          
          if (alive) {
            if (p.currentLoss < currentMinLoss) currentMinLoss = p.currentLoss

            if (audioEnabled && audioEngine.current?.ready) {
              const normX = p.x / w
              if (!p.sonified && p.age > 5) {
                p.sonified = audioEngine.current.startVoice(p.id, normX, p.normalizedLoss)
              }
              if (p.sonified) {
                audioEngine.current.updateVoice(p.id, normX, p.normalizedLoss, p.velocity, p.gradientMag)
              }
            }
          } else {
            if (p.sonified) deadIds.push(p.id)
            if (p.deathReason === 'converged') {
              statsCounter.current.converged++
              if (audioEnabled) audioEngine.current?.playConverge()
            } else if (p.deathReason === 'expired') {
              statsCounter.current.expired++
            }
          }
          return alive
        })

        deadIds.forEach(id => audioEngine.current?.stopVoice(id))
        
        if (Math.random() < 0.15) {
          setParticleCount(particles.current.length)
          setMinLoss(currentMinLoss === Infinity ? null : currentMinLoss)
          setStats({ ...statsCounter.current, active: particles.current.length })
        }
        
        if (time - graphHistory.current.lastUpdate >= GRAPH.updateInterval) {
          const gh = graphHistory.current
          const sc = statsCounter.current
          
          const convergeRate = sc.converged - gh.lastConverged
          const expireRate = sc.expired - gh.lastExpired
          
          gh.active.push(particles.current.length)
          gh.converged.push(convergeRate)
          gh.expired.push(expireRate)
          
          if (gh.active.length > GRAPH.historyLength) {
            gh.active.shift()
            gh.converged.shift()
            gh.expired.shift()
          }
          
          gh.lastConverged = sc.converged
          gh.lastExpired = sc.expired
          gh.lastUpdate = time
          
          drawGraph()
        }
      }

      particles.current.forEach(p => p.draw(ctx))
      animationId.current = requestAnimationFrame(animate)
    }

    animationId.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId.current)
  }, [dimensions, spawnParticles, drawGraph, lossFnKey, learningRate, momentum, normalizeGradient, 
      autoSpawn, audioEnabled, paused, lossRange])

  const toggleAudio = async () => {
    if (!audioEnabled) {
      await audioEngine.current.init()
      setAudioEnabled(true)
    } else {
      audioEngine.current.stopAll()
      particles.current.forEach(p => { p.sonified = false })
      setAudioEnabled(false)
    }
  }

  const togglePause = () => {
    if (!paused && audioEnabled) {
      audioEngine.current.stopAll()
      particles.current.forEach(p => { p.sonified = false })
    }
    setPaused(!paused)
  }

  const clearAll = () => {
    particles.current.forEach(p => p.sonified && audioEngine.current?.stopVoice(p.id))
    particles.current = []
    statsCounter.current = { converged: 0, expired: 0 }
    graphHistory.current = {
      active: [],
      converged: [],
      expired: [],
      lastConverged: 0,
      lastExpired: 0,
      lastUpdate: 0
    }
    setParticleCount(0)
    setStats({ converged: 0, expired: 0, active: 0 })
  }

  const burst = () => {
    if (paused) return
    for (let i = 0; i < 5; i++) {
      spawnParticles(Math.random() * dimensions.width, Math.random() * dimensions.height, 3)
    }
  }

  const handleMouseDown = (e) => {
    if (e.target.closest('.panel, .tracker, .overlay') || paused) return
    mouse.current = { x: e.clientX, y: e.clientY, down: true }
    dragSpawnTimer.current = 0
    spawnParticles(e.clientX, e.clientY, 5)
  }

  const handleMouseMove = (e) => {
    mouse.current.x = e.clientX
    mouse.current.y = e.clientY
  }

  const handleMouseUp = () => { mouse.current.down = false }
  
  const handleTouchStart = (e) => {
    if (e.target.closest('.panel, .tracker, .overlay') || paused) return
    const touch = e.touches[0]
    mouse.current = { x: touch.clientX, y: touch.clientY, down: true }
    dragSpawnTimer.current = 0
    spawnParticles(touch.clientX, touch.clientY, 5)
  }
  
  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    mouse.current.x = touch.clientX
    mouse.current.y = touch.clientY
  }
  
  const handleTouchEnd = () => { mouse.current.down = false }

  return (
    <>
      <style>{styles}</style>
      <div className="container">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {paused && <div className="paused-overlay">PAUSED</div>}

        <header className="header">
          <div className="logo"><span className="logo-accent">∇</span>GRADIENT FLOW</div>
          <div className="subtitle">Optimization Visualization</div>
        </header>

        <div className="stats">
          <div className="stat">
            <span className="stat-label">Particles</span>
            <span className="stat-value">{particleCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Min Loss</span>
            <span className="stat-value">{minLoss === null ? '—' : minLoss.toFixed(3)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">FPS</span>
            <span className="stat-value">{fps}</span>
          </div>
        </div>

        <div className="bottom-panels">
          <div className={`panel glass-panel ${panelMin ? 'minimized' : ''}`}>
            <div className="panel-header">
              <span className="panel-title">Controls</span>
              <button className="minimize-btn" onClick={() => setPanelMin(!panelMin)}>
                {panelMin ? '+' : '−'}
              </button>
            </div>

            {!panelMin && (
              <>
                <div className="section">
                  <div className="label-row">
                    <span className="label">Landscape</span>
                    <span className="info-icon" onClick={() => setInfoKey('fn')}>?</span>
                  </div>
                  <div className="btn-group landscape-btns">
                    {Object.entries(lossFunctions).map(([key, { name }]) => (
                      <button key={key} className={`btn ${lossFnKey === key ? 'active' : ''}`} onClick={() => setLossFnKey(key)}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="section">
                  <div className="label-row">
                    <span className="label">SGD Mode</span>
                    <span className="info-icon" onClick={() => setInfoKey('sgd')}>?</span>
                  </div>
                  <div className="btn-group">
                    <button className={`btn ${!normalizeGradient ? 'active' : ''}`} onClick={() => setNormalizeGradient(false)}>Standard</button>
                    <button className={`btn ${normalizeGradient ? 'active' : ''}`} onClick={() => setNormalizeGradient(true)}>Normalized</button>
                  </div>
                </div>

                <div className="section">
                  <span className="label">Learning Rate: {learningRate.toFixed(2)}</span>
                  <input type="range" className="slider" min="0.1" max="2.5" step="0.1" value={learningRate} onChange={e => setLearningRate(parseFloat(e.target.value))} />
                </div>

                <div className="section">
                  <span className="label">Momentum: {momentum.toFixed(2)}</span>
                  <input type="range" className="slider" min="0" max="0.98" step="0.01" value={momentum} onChange={e => setMomentum(parseFloat(e.target.value))} />
                </div>

                <div className="section">
                  <div className="toggles">
                    <label className="toggle">
                      <input type="checkbox" className="checkbox" checked={autoSpawn} onChange={e => setAutoSpawn(e.target.checked)} />
                      <span>Auto Spawn</span>
                      <span className="info-icon" onClick={e => { e.preventDefault(); setInfoKey('spawn') }}>?</span>
                    </label>
                    <label className="toggle">
                      <input type="checkbox" className="checkbox" checked={audioEnabled} onChange={toggleAudio} />
                      <span>Audio</span>
                      <span className="info-icon" onClick={e => { e.preventDefault(); setInfoKey('audio') }}>?</span>
                    </label>
                  </div>
                </div>

                <div className="section">
                  <div className="btn-group">
                    <button className={`btn ${paused ? 'pause-active' : ''}`} onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
                    <button className="btn" onClick={burst}>Burst</button>
                    <button className="btn" onClick={clearAll}>Clear</button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={`tracker glass-panel ${trackerMin ? 'minimized' : ''}`}>
            <div className="panel-header">
              <span className="panel-title">Tracker</span>
              <button className="minimize-btn" onClick={() => setTrackerMin(!trackerMin)}>{trackerMin ? '+' : '−'}</button>
            </div>
            {!trackerMin && (
              <>
                <div className="tracker-row">
                  <span className="tracker-label">Converged</span>
                  <span className="tracker-value converged">{stats.converged}</span>
                </div>
                <div className="tracker-row">
                  <span className="tracker-label">Expired</span>
                  <span className="tracker-value expired">{stats.expired}</span>
                </div>
                <div className="tracker-row">
                  <span className="tracker-label">Active</span>
                  <span className="tracker-value">{stats.active}</span>
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  <span className="info-icon" onClick={() => setInfoKey('tracker')}>?</span>
                </div>
              </>
            )}
          </div>

          <div className={`graph-panel glass-panel ${graphMin ? 'minimized' : ''}`}>
            <div className="graph-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Rates
                <span className="info-icon" onClick={() => setInfoKey('graph')}>?</span>
              </span>
              <button className="minimize-btn" onClick={() => setGraphMin(!graphMin)}>{graphMin ? '+' : '−'}</button>
            </div>
            {!graphMin && (
              <>
                <div className="graph-container">
                  <canvas ref={graphCanvasRef} className="graph-canvas" width={GRAPH_CANVAS.w} height={GRAPH_CANVAS.h} />
                </div>
                <div className="graph-legend">
                  <div className="graph-legend-item">
                    <span className="graph-legend-dot active" />
                    <span>Active</span>
                  </div>
                  <div className="graph-legend-item">
                    <span className="graph-legend-dot converged" />
                    <span>Conv</span>
                  </div>
                  <div className="graph-legend-item">
                    <span className="graph-legend-dot expired" />
                    <span>Exp</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="legend glass-panel">
          <div className="legend-label">Loss</div>
          <div className="legend-bar" />
          <div className="legend-labels">
            <span className="legend-stop">Low</span>
            <span className="legend-stop">High</span>
          </div>
        </div>

        <div className="bottom-right">
          <div className="instructions">Click to spawn</div>
          <button className="about-btn" onClick={() => setInfoKey('about')}>
            <span>ℹ</span>
            <span>About</span>
          </button>
        </div>

        <div className="corner corner-tl" />
        <div className="corner corner-br" />

        {infoKey && (
          <div className="overlay" onClick={() => setInfoKey(null)}>
            <div className="info-panel" onClick={e => e.stopPropagation()}>
              <div className="info-header">
                <span className="info-title">{INFO[infoKey]?.title}</span>
                <button className="close-btn" onClick={() => setInfoKey(null)}>×</button>
              </div>
              <div className="info-content">
                {INFO[infoKey]?.content.split('\n\n').map((text, i) => (
                  <p key={i} className="info-text">{text}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
