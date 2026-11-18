# SYMBIOTE — The Klyntar Project

A frontend-only, black-and-crimson Venom-inspired fan website built with React,
TypeScript, Vite, Tailwind, GSAP, and Lenis. An optional, lazily loaded Three.js
hero displays a locally made Blender asset. There is no backend, authentication,
database, external AI service, or API key requirement.

## Develop

Use Node.js 20.19+ or 22.12+:

```sh
npm ci
npm run dev
```

## Experience

- Four chapters: origin, adaptations, vulnerabilities, and containment records.
- Desktop and mobile chapter navigation, scroll progress, and kinetic typography.
- Select or preview adaptations to read their profiles.
- Sonic/thermal controls update illustrative containment readouts. Escape,
  leaving the chapter, or blurring the window ends the tests. No high-frequency
  sound is played.
- Optional locally synthesized ambient audio is off by default; no microphone.
- A lightweight **2D Canvas** cursor uses spring-driven tendrils on fine pointers.
  Slow movement has a short tail of six tightly grouped, irregularly spaced
  strands. At rest they gently reach around the pointer with independently
   varying lengths, capped at 18px. After a short (~3.2s) idle flourish and settled
   springs, the cursor sleeps in its last pose until movement or a click wakes it.
  Sustained fast waving makes eight
  tendrils grip the screen edges and pull the visual cursor toward the center.
  Move the real pointer into the center ring and slow down to release, or press
  Escape immediately. The normal pointer is visible during restraint; clicks
  are never redirected or blocked, and no browser/OS pointer lock is requested.
  Touch and reduced-motion users retain their native cursor without restraint.
- The hero specimen subtly breathes and responds to mouse/scroll input. Its
  renderer is independent of the approved 2D cursor and never intercepts input.
- Fonts, the model, and the static fallback image are served locally.

## Performance safeguards

- Blender master: **2,134,660 bytes / 114,624 triangles**. The site never downloads it.
- Web derivative: **159,212 bytes / 29,608 triangles / 9 draw calls**, Meshopt-compressed.
- Static WebP fallback: about **32 KB**. Touch/mobile, widths below 1000px,
  reduced motion, Save-Data, reported 2G/3G, fewer than 4 CPU threads, or less than
  4 GB reported memory skip both the 3D JavaScript and model downloads.
- The renderer imports only after the hero is visible, the tab is active, and
  idle time is available. Landing directly on an archive section doesn't load 3D.
- Maximum **30 FPS**, DPR **1.25**, and **650,000 drawing-buffer pixels**.
  Sustained expensive frames reduce the budget to 24 FPS / 250,000 pixels;
  persistent slowness switches to the poster, without a retry loop.
- Offscreen/hidden rendering stops entirely. There are no shadows, postprocessing,
  external HDRs, real-time vertex deformation, React frame updates, or continuous
  renders after GPU/context failure. Resources and listeners are disposed on teardown.
- The renderer requests the high-performance GPU with antialiasing enabled
  (no postprocessing), stencil disabled, and depth retained for correct self-occlusion.
  Geometry displacement is baked into the optimized asset: there are **zero**
  runtime noise octaves or high-subdivision procedural meshes.
- The 2D cursor uses **1× CSS pixels**, 13 spring points including the head, no
  shadow blur, a 60 FPS drawing cap, and small dirty-region clears except while
  edge ropes span the viewport. Idle sleep cancels RAF entirely, with no polling timer.
- ScrollTrigger, pointer listeners, and animation callbacks never invoke React
  state setters. Chapter indicators, restraint hints, and stress resets use isolated
  DOM/ref controllers. Discrete adaptation, menu, audio, and accessibility changes
  still use React normally.
- Lenis uses only GSAP's ticker (`autoRaf` is not enabled), with
  `gsap.ticker.lagSmoothing(0)`. Typography/progress/integrity animate transforms;
  kinetic text is layer-promoted. Inactive sonic rings pause their CSS animations.
- The optional Three.js/loader/decoder chunk is approximately **163 KB gzip**,
  separate from the initial UI (approximately 130 KB gzip). Vite still warns
  about its >500 KB uncompressed size; it is deliberately deferred, not hidden
  by raising the warning limit.

These are enforced budgets, not a guarantee of identical FPS on every device.

Local Chromium audit (1440×1000, reported DPR 2): the old cursor made 145
full-viewport clears in a one-second idle sample with a 2880×2000 backing store.
The refactor uses 1440×1000 and made **zero** clears after settling. A moving
sample averaged ~3,438 CSS pixels per clear rather than 1,440,000; the model
continued at 30 FPS. These observations are specific to the local test hardware.

## Verify

```sh
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

Playwright covers desktop/mobile layout, fallback-only requests, navigation,
adaptation selection, stress reset, audio opt-in, keyboard/touch controls, and
reduced motion. Cursor tests cover fast-wave restraint, calm centered release,
Escape/cooldown, non-blocking clicks, and cleanup. Unit tests bound every tail
link across different frame rates. WebGL tests verify actual draw-call/frame/pixel
budgets, deferred downloads, hidden/offscreen pausing, dynamic reduced motion,
denied/lost contexts, missing assets, and automatic slow-device fallback.
The performance regression test instruments real React commits during simultaneous
WebGL rendering, pointer restraint, scroll, and automatic stress resets (zero commits).
Cursor tests also verify Retina backing-store dimensions, no redraws while sleeping,
dirty-region bounds, and immediate movement/click wake-up.
The tests start their own Vite server on port
5174, separate from your development server on 5173.

Dependency audit: the latest `npm audit` reports zero findings, including development dependencies.

## Docker

```sh
docker compose up -d --build
```

Open http://localhost:8080. A multi-stage build serves only static output through
Nginx. Local dependencies, build output, and test artifacts are excluded from the
Docker context.

```sh
docker compose down
```

The website itself does not call paid services. Hosting infrastructure is
separate. Character and lore belong to their respective owners.

## Git

Git is initialized on `main` in `venom-web`, with
`origin` set to `https://github.com/kaelexe/symbiote.git`.
No commit or push was performed. Dependencies, build/test output, environment
files, private-key files, and local OpenCode configuration are ignored.

## Rebuild the model assets

A locally sculpted procedural mesh is available at
`public/models/symbiote.glb` (2.13 MB). It has a displaced wet-black core,
18 main tendrils, 9 branches, and subtle crimson tips. See
`public/models/README.md` and `tools/generate_symbiote.py` for details.
The original export stays untouched. After re-exporting it, run:

```sh
npm run model:optimize
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

In another terminal, run `npm run model:poster`, then `npm run build` again.
The optimizer rejects a derivative exceeding 450 KB, 40,000 triangles, or 9 primitives.
The poster tool rejects images larger than 60 KB and uses local Chromium only.
