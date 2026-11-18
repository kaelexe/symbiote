# Procedural symbiote asset

`symbiote.glb` is a static glTF 2.0 binary made locally in Blender 5.3.
No external models, textures, AI generators, or provider credentials were used.

- One fused, connected, watertight mesh; 114,624 triangles.
- 18 curved main tendrils and 9 branching tendrils.
- Three baked improved-Perlin displacement scales on an icosphere core.
- Near-black `#050505` PBR surface, metallic 0.84, roughness 0.12,
  and a clearcoat for wet reflections.
- Eight subtle `#8A0303` emission bands near the tips, plus the base material.
- About 2.13 MB, embedded geometry/materials, no external file dependencies.
- Standard glTF clearcoat, specular, and IOR material extensions.
- No cameras, lights, animation, or unapplied modifiers in the export.
- Source mesh has no non-manifold edges or loose vertices; positive signed volume.
- Khronos glTF Validator: zero errors, warnings, infos, or hints.

The original default camera was preserved in Blender; the default cube and light
were removed. A model's specular appearance depends on the viewer's lighting.

## Access

Development URL: `http://localhost:5173/models/symbiote.glb`.
Vite copies the asset into `dist/models/` during a production build.
The site never requests this master. It loads `symbiote-web.glb` only on eligible
desktops with a visible hero and uses `symbiote-poster.webp` otherwise.

## Web derivative

- 159,212 bytes, 29,608 triangles, 9 primitives/draw calls.
- Meshoptimizer simplification with border locking and 0.2% error bound,
  14-bit position quantization, and Meshopt compression.
- Compressed asset: Khronos Validator reports zero errors/warnings and two
  informational messages (unsupported Meshopt validation, unused fallback buffer).
  After decoding with Meshopt, validation has zero errors, warnings, infos, or hints.
- Static transparent WebP: approximately 32 KB, captured with the same renderer.
- Runtime budgets: 30 FPS, DPR ≤1.25, ≤650,000 pixels; adaptive downshift to
  24 FPS / 250,000 pixels, then poster-only if rendering remains expensive.
- Mobile/touch, reduced-motion, data-saving/slow-network, and low-memory/CPU
  devices do not download the model or its renderer. Missing or denied WebGL
  keeps all chapter content and controls accessible.
- Rendering stops offscreen or in a hidden tab. The approved 2D cursor is unchanged.

Run `npm run model:optimize` to regenerate the web derivative. See the application
README for local poster capture and complete verification commands.

## Reproduce

The deterministic Blender script is `tools/generate_symbiote.py` (seed 270319).
It creates and exports the asset, applying displacement, voxel fusion,
polishing, decimation, tip sharpening, and smooth shading.

Run the script inside Blender using the Python-console example in its header.
Move an existing export aside first: the script intentionally refuses to
overwrite an existing GLB. It only removes objects named `Cube` and `Light`
of the corresponding types, and exports only its newly created mesh.
