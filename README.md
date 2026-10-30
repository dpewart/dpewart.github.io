# Gridsome Games

A collection of lightweight, browser-based grid simulations, incremental games, and systems engineering puzzles. Built with vanilla web standards and zero runtime bloat.

🌐 **Live Site**: (https://dpewart.github.io)

---

## 🎮 The Games

### [Reactor Successor](./reactor-successor/)
A tile-based nuclear and industrial simulation puzzle.
- **Core Loop**: Balance active fuel decay, manage 2D orthogonal radiation diffusion, and prevent thermal choking with passive reflectors and active sinks.
- **Metallurgy Tier**: Intercept raw generation with 1-hop flux conduits to fuel industrial smelters for Exotic Alloys.
- **Quantum Loop**: Synthesize Quantum Flux in high-tier condensers to collapse timelines and bank persistent meta-progression.
- **Tech Stack**: Vanilla ES6 modules, CSS Grid, HTML5 Canvas/SVG, LocalStorage persistence.

---

## 🛠️ Repository Architecture

This repository serves as the root hub (`<username>.github.io`) on GitHub Pages. Each game lives in its own subdirectory:

```text
.
├── index.html              # Gridsome Games landing page hub
├── README.md               # Repository documentation
│
└── Reactor-Successor/      # Game 1  git submodule
    ├── index.html
    ├── css/
    ├── js/
    └── assets/
