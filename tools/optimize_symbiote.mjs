import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Keep the Blender master untouched. Only the web derivative is replaceable.
const source = fileURLToPath(new URL('../public/models/symbiote.glb', import.meta.url))
const output = fileURLToPath(new URL('../public/models/symbiote-web.glb', import.meta.url))
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
})
const document = await io.read(source)
await document.transform(
  dedup(), weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.24, error: 0.002, lockBorder: true }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 14 }),
)
const primitives = document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
const triangles = primitives.reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0)
const binary = await io.writeBinary(document)
if (triangles > 40_000 || binary.byteLength > 450_000 || primitives.length > 9) {
  throw new Error(`Web asset exceeds budget: ${triangles} triangles, ${binary.byteLength} bytes, ${primitives.length} primitives`)
}
await writeFile(output, binary)
console.log(JSON.stringify({
  sourceBytes: (await stat(source)).size, webBytes: binary.byteLength,
  triangles, primitives: primitives.length,
}, null, 2))
