# 2D → 3D Design

Draw in 2D and turn your shapes into editable 3D models — with live preview, materials, move/rotate/group controls, export, and optional AI 3D generation via fal.ai.

## Features

- **2D canvas** — pen, shapes, color wheel, zoom/pan, select & drag
- **Live 3D preview** — depth, round edges, size, solid/hollow, materials
- **Transform** — move and rotate objects; group / merge shapes
- **AI generate** — text → 3D or sketch → 3D (fal.ai)
- **Export** — GLB / OBJ and engine manifests

## Setup

```bash
npm install
cp .env.example .env   # add your FAL_KEY if using AI generate
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## Stack

React, TypeScript, Vite, Three.js / React Three Fiber, Zustand, fal.ai
