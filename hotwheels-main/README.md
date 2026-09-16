<div align="center">

# Hot Wheels

*A top-down pixel art racing game inspired by the original GTA, built with Phaser 3.*

[![License](https://img.shields.io/badge/license-ISC-blue.svg?style=flat-square)](LICENSE)
[![Built With](https://img.shields.io/badge/built_with-Phaser_3-8b44ff.svg?style=flat-square)](https://phaser.io)
[![Platform](https://img.shields.io/badge/platform-browser-44cc44.svg?style=flat-square)](#quick-start)

<!-- TODO: Add hero screenshot of gameplay — capture a mid-race moment showing the track, both cars, HUD, and a power-up in action -->

</div>

---

Race 1v1 against an AI opponent through a city circuit track. Pick from three wildly different cars, dodge oil slicks, fire missiles, and fight for first place across 3 laps — all in retro pixel-art style, right in your browser.

## Features

- **Three unique cars** — Monster Truck, Sports Car, and a car shaped like a Top Hat, each with distinct speed, acceleration, and handling stats
- **Rubber-banding AI** — Three difficulty levels (Easy, Medium, Hard) that stay competitive without feeling cheap
- **Five power-ups** — Nitro Boost, Oil Slick, Shield, Missile, and Tire Tacks collected from on-track item boxes
- **City circuit track** — Tight 90-degree turns, sweeping curves, a chicane, and two long straights lined with buildings and barriers
- **Full race HUD** — Lap counter, position indicator, minimap, speedometer, and power-up slot
- **Retro sound effects** — Procedurally generated engine hum, tire screeches, countdown beeps, and power-up sounds via Web Audio API
- **Arcade physics** — Responsive controls, wall collision sparks, and satisfying boundary sliding

## Quick Start

```bash
git clone https://github.com/itsbirdo/hotwheels.git
cd hotwheels
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser and press any key to start.

## How to Play

### Controls

| Action | Keys |
|--------|------|
| Accelerate | `W` / `↑` |
| Brake / Reverse | `S` / `↓` |
| Steer left | `A` / `←` |
| Steer right | `D` / `→` |
| Use power-up | `Space` |

### Game Flow

1. **Select your car** — browse with arrow keys, confirm with Enter
2. **Pick difficulty** — press `1` (Easy), `2` (Medium), or `3` (Hard)
3. **Race** — 3-2-1-GO countdown with traffic lights, then 3 laps around the city
4. **Results** — lap times and total time for both you and the AI, with options to race again or reselect

### Cars

| Car | Top Speed | Acceleration | Handling | Special |
|-----|-----------|-------------|----------|---------|
| Monster Truck | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | — |
| Sports Car | ★★★☆☆ | ★★★★☆ | ★★★★☆ | — |
| Top Hat | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | 1.5x power-up pickup radius |

### Power-ups

Pick up glowing item boxes on the track to receive a random power-up. You hold one at a time — use it before grabbing another.

| Power-up | Effect |
|----------|--------|
| Nitro Boost | 2-second speed burst with exhaust flames |
| Oil Slick | Drops a puddle behind you — spins out the opponent for 1 second |
| Shield | Blocks one incoming hit for 10 seconds |
| Missile | Fires forward — slows the opponent to 50% speed on hit |
| Tire Tacks | Scatters tacks behind you — slows the opponent for 2 seconds |

## Tech Stack

- **[Phaser 3](https://phaser.io)** — game framework (rendering, physics, input, audio, scenes)
- **[Vite](https://vite.dev)** — dev server and bundler
- **Vanilla JavaScript** — no TypeScript, no framework overhead
- **Web Audio API** — procedurally generated retro sound effects
- **Programmatic pixel art** — all sprites and tiles generated at runtime via Phaser graphics

## Project Structure

```
src/
├── main.js              # Phaser game config and entry point
├── scenes/              # Game screens (Boot, CarSelect, Race, Results)
├── entities/            # Player and AI car classes
├── physics/             # Arcade car physics engine
├── track/               # Track layout, tilemap data, renderer
├── powerups/            # Item boxes and 5 power-up effects
├── race/                # Checkpoint system and lap tracking
├── ui/                  # HUD (minimap, lap counter, power-up slot)
├── audio/               # Sound manager (Web Audio API)
├── data/                # Car stats and difficulty configs
├── sprites/             # Programmatic sprite generator
└── music/               # Race music tracks (MP3)
```

## Contributing

This is a personal project built with [Claude Code](https://claude.com/claude-code). PRs and ideas are welcome — open an issue first to discuss.

## License

ISC
