# Gradient Flow

A visual exploration of gradient descent, the fundamental process by which neural networks learn.

## Concept

Particles flow through mathematical loss landscapes, descending toward minima like digital fireflies navigating computational terrain. Each particle represents a gradient update, its trajectory shaped by learning rate, momentum, and stochastic noise. However, real networks optimize over millions of dimensions; this 2D projection builds intuition for optimization dynamics.


## Features

- **Three Loss Functions**: Ackley, Rastrigin, and Himmelblau, each with distinct topologies
- **Real-time Particle System**: Particles follow actual gradient descent dynamics
- **Interactive Controls**: Adjust learning rate and momentum to see their effects
- **Click to Spawn**: Click and drag anywhere to release particle swarms
- **Dark Futuristic Aesthetic**: Clean, minimal interface with electric accents

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Technical Details

The visualization implements:
- Numerical gradient computation via central differences
- Momentum-based optimization (simulating SGD with momentum)
- Stochastic noise injection to simulate realistic training behavior
- Trail rendering with gradient-based opacity
- Real-time loss landscape rendering

## Loss Functions

**Ackley**: A smooth function with a single global minimum but many local optima. Good for visualizing convergence behavior.

**Rastrigin**: Highly multimodal with many local minima arranged in a regular lattice. Demonstrates the challenge of escaping local optima.

**Himmelblau**: Features multiple global minima of equal value. Shows how gradient descent finds different solutions from different starting points.

## Controls

| Control | Effect |
|---------|--------|
| Click/Drag | Spawn particles at cursor |
| Learning Rate | Speed of descent (higher = faster but less stable) |
| Momentum | How much previous velocity influences movement |
| Show Landscape | Toggle the loss function visualization |
| Auto Spawn | Automatically spawn particles over time |
| Burst | Spawn many particles across the canvas |
| Clear | Remove all particles |
