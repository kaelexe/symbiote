r"""Run inside Blender: generate a fused, portable PBR symbiote GLB.

Example from Blender's Python console:
    path = r"E:\code\pprjs\venom\venom-web\tools\generate_symbiote.py"
    exec(compile(open(path, encoding="utf-8").read(), path, "exec"),
         {"__file__": path, "__name__": "__main__"})

Existing exports are never overwritten. No downloaded assets or paid generators.
"""

import json
import math
import random
from pathlib import Path
from uuid import uuid4

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree


EXPORT = Path(__file__).resolve().parents[1] / "public" / "models" / "symbiote.glb"
SEED = 270319


def enum_value(owner, property_name, desired):
    items = owner.bl_rna.properties[property_name].enum_items
    return next(item.identifier for item in items if item.identifier == desired)


def modifier(obj, name, kind):
    return obj.modifiers.new(name, enum_value(bpy.types.Modifier, "type", kind))


def activate(obj):
    for other in bpy.context.selected_objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply(obj, mod):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def linear_hex(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)


def material(name, glow=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    principled = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (*linear_hex("050505"), 1)
    principled.inputs["Metallic"].default_value = 0.84
    principled.inputs["Roughness"].default_value = 0.12
    principled.inputs["IOR"].default_value = 1.52
    principled.inputs["Specular IOR Level"].default_value = 0.65
    principled.inputs["Coat Weight"].default_value = 0.45
    principled.inputs["Coat Roughness"].default_value = 0.07
    principled.inputs["Emission Color"].default_value = (*linear_hex("8A0303"), 1)
    principled.inputs["Emission Strength"].default_value = glow
    # The viewport swatch is supplementary; the shader above is authoritative.
    mat.diffuse_color = (*linear_hex("050505"), 1)
    return mat


def tube(collection, name, points, radii, width):
    curve_type = bpy.data.curves.bl_rna.functions["new"].parameters["type"].enum_items
    curve = bpy.data.curves.new(name, next(i.identifier for i in curve_type if i.identifier == "CURVE"))
    curve.dimensions = enum_value(curve, "dimensions", "3D")
    curve.resolution_u = 16
    curve.bevel_depth = width
    curve.bevel_resolution = 4
    curve.use_fill_caps = True
    spline_types = curve.splines.bl_rna.functions["new"].parameters["type"].enum_items
    spline = curve.splines.new(next(i.identifier for i in spline_types if i.identifier == "BEZIER"))
    spline.bezier_points.add(len(points) - 1)
    for point, position, radius in zip(spline.bezier_points, points, radii):
        point.co = position
        point.radius = radius
        point.handle_left_type = enum_value(point, "handle_left_type", "AUTO")
        point.handle_right_type = enum_value(point, "handle_right_type", "AUTO")
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    converted = bpy.data.objects.new(name + "_Mesh", mesh)
    collection.objects.link(converted)
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.curves.remove(curve)
    return converted


def keep_connected_surface(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    unseen = set(bm.verts)
    components = []
    while unseen:
        first = unseen.pop()
        connected = {first}
        pending = [first]
        while pending:
            vertex = pending.pop()
            for edge in vertex.link_edges:
                neighbor = edge.other_vert(vertex)
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    connected.add(neighbor)
                    pending.append(neighbor)
        components.append(connected)
    largest = max(components, key=len)
    loose = [vertex for component in components if component is not largest for vertex in component]
    for vertex in loose:
        bm.verts.remove(vertex)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    return len(components), len(loose)


def binary_format():
    # Blender 5.3 moves this dynamic enum onto an inherited exporter base class.
    import io_scene_gltf2
    for cls in io_scene_gltf2.ExportGLTF2.__mro__:
        definition = getattr(cls, "__annotations__", {}).get("export_format")
        if definition is None:
            continue
        items = definition.keywords["items"]
        if callable(items):
            items = items(None, bpy.context)
        return next(item[0] for item in items if item[0] == "GLB")
    raise RuntimeError("Blender's glTF exporter does not expose a binary export format.")


def main():
    if EXPORT.exists():
        raise FileExistsError(f"Refusing to overwrite existing asset: {EXPORT}")
    if bpy.context.mode != "OBJECT":
        mode = bpy.ops.object.mode_set.get_rna_type().properties["mode"].enum_items
        bpy.ops.object.mode_set(mode=next(i.identifier for i in mode if i.identifier == "OBJECT"))
    glb_format = binary_format()  # Check API compatibility before changing the scene.
    rng = random.Random(SEED)
    for name, kind in (("Cube", "MESH"), ("Light", "LIGHT")):
        obj = bpy.context.scene.objects.get(name)
        if obj is not None and obj.type == kind:
            bpy.data.objects.remove(obj, do_unlink=True)

    collection = bpy.data.collections.new("SYMBIOTE_ASSET")
    bpy.context.scene.collection.children.link(collection)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=7, radius=1.08)
    core = bpy.context.object
    core.name = "Symbiote"
    for old_collection in list(core.users_collection):
        old_collection.objects.unlink(core)
    collection.objects.link(core)
    for vertex in core.data.vertices:
        vertex.co.x *= 1.10
        vertex.co.y *= 0.91
        vertex.co.z *= 1.20

    # Three baked Perlin scales: large tar folds, soft undulations, fine wet skin.
    for index, (scale, strength) in enumerate(((0.62, 0.46), (0.21, 0.085), (0.075, 0.018))):
        texture = bpy.data.textures.new(
            f"Symbiote_Perlin_{index}",
            type=enum_value(bpy.types.Texture, "type", "CLOUDS"),
        )
        texture.noise_basis = enum_value(texture, "noise_basis", "IMPROVED_PERLIN")
        texture.noise_scale = scale
        texture.noise_depth = 2
        displacement = modifier(core, f"Perlin_Tar_{index}", "DISPLACE")
        displacement.texture = texture
        displacement.strength = strength
        displacement.mid_level = 0.5
        apply(core, displacement)

    pieces = [core]
    tips = []
    branch_count = 0
    for index in range(18):
        angle = math.tau * index / 18 + rng.uniform(-0.12, 0.12)
        direction = Vector((math.cos(angle), rng.uniform(-0.32, 0.32), math.sin(angle))).normalized()
        tangent = Vector((-direction.z, 0, direction.x)).normalized()
        reach = rng.uniform(2.8, 3.8) if index % 3 == 0 else rng.uniform(1.35, 2.65)
        bend = rng.uniform(0.45, 1.1) * (-1 if index % 4 == 0 else 1)
        hook = rng.uniform(-0.85, 0.85)
        depth = Vector((0, rng.uniform(-0.42, 0.42), 0))
        points = [
            direction * 0.54,
            direction * 0.98 + tangent * 0.04,
            direction * 1.43 + tangent * 0.22 + depth * 0.3,
            direction * (1.3 + reach * 0.48) + tangent * bend * 0.65 + depth,
            direction * (1.3 + reach * 0.83) + tangent * (bend + hook * 0.3) + depth * 0.7,
            direction * (1.3 + reach) + tangent * (bend + hook),
        ]
        width = rng.uniform(0.17, 0.235)
        pieces.append(tube(collection, f"Tendril_{index:02}", points, [1.25, 1.16, 0.9, 0.55, 0.22, 0.001], width))
        tips.append(points[-1])
        if index % 2 == 0:
            origin = points[3]
            branch_direction = (direction * 0.6 - tangent * 0.8).normalized()
            length = rng.uniform(0.72, 1.35)
            branch_points = [
                origin,
                origin + branch_direction * length * 0.4 + tangent * 0.07,
                origin + branch_direction * length * 0.8 + tangent * 0.23,
                origin + branch_direction * length + tangent * rng.uniform(0.2, 0.5),
            ]
            pieces.append(tube(collection, f"Branch_{index:02}", branch_points, [1.1, 0.8, 0.32, 0.001], width * 0.43))
            tips.append(branch_points[-1])
            branch_count += 1

    activate(core)
    for piece in pieces:
        piece.select_set(True)
    bpy.ops.object.join()
    # Fuse the roots, rather than shipping intersecting curve shells as a joined object.
    remesh = modifier(core, "Fuse_Living_Tar", "REMESH")
    remesh.mode = enum_value(remesh, "mode", "VOXEL")
    remesh.voxel_size = 0.028
    remesh.use_smooth_shade = True
    apply(core, remesh)
    islands, removed = keep_connected_surface(core.data)
    smooth = modifier(core, "Polish_Tar", "SMOOTH")
    smooth.factor = 0.72
    smooth.iterations = 4
    apply(core, smooth)
    decimate = modifier(core, "Web_Export_Density", "DECIMATE")
    decimate.ratio = 0.62
    apply(core, decimate)

    # Restore needle-like ends after voxel fusion and polishing.
    tree = KDTree(len(core.data.vertices))
    for vertex in core.data.vertices:
        tree.insert(vertex.co, vertex.index)
    tree.balance()
    for tip in tips:
        _, vertex_index, distance = tree.find(tip)
        if distance < 0.24:
            core.data.vertices[vertex_index].co = tip

    core.data.materials.clear()
    core.data.materials.append(material("Symbiote_Wet_Obsidian"))
    for band in range(1, 9):
        core.data.materials.append(material(f"Symbiote_Crimson_Tip_{band}", 0.38 * (band / 8) ** 1.7))
    tip_tree = KDTree(len(tips))
    for index, tip in enumerate(tips):
        tip_tree.insert(tip, index)
    tip_tree.balance()
    core.data.update()
    for polygon in core.data.polygons:
        center = sum((core.data.vertices[i].co for i in polygon.vertices), Vector()) / len(polygon.vertices)
        _, _, distance = tip_tree.find(center)
        glow = max(0, 1 - distance / 0.44)
        polygon.material_index = math.ceil(glow * 8)
        polygon.use_smooth = True

    core["asset"] = "Procedural symbiote mass — no external assets or generated textures"
    core["seed"] = SEED
    core["main_tendrils"] = 18
    core["branch_tendrils"] = branch_count
    core["displacement"] = "Three baked improved-Perlin scales, fused and polished"
    core["base_color_srgb"] = "#050505"
    core["tip_emission_srgb"] = "#8A0303"
    core["forward"] = "-Y"
    activate(core)
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    temporary = EXPORT.with_name(f".symbiote-{uuid4().hex}.glb")
    options = {
        "filepath": str(temporary), "export_format": glb_format,
        "use_selection": True, "export_apply": True, "export_extras": True,
        "export_cameras": False, "export_lights": False, "export_animations": False,
    }
    supported = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    if not set(options).issubset(supported):
        raise RuntimeError(f"Missing exporter options: {set(options) - supported}")
    try:
        result = bpy.ops.export_scene.gltf(**options)
        if "FINISHED" not in result or not temporary.is_file():
            raise RuntimeError(f"GLB export did not finish: {result}")
        temporary.rename(EXPORT)
    finally:
        if temporary.exists():
            temporary.unlink()
    core.data.calc_loop_triangles()
    bounds = [core.matrix_world @ Vector(point) for point in core.bound_box]
    print(json.dumps({
        "export": str(EXPORT), "bytes": EXPORT.stat().st_size,
        "object": core.name, "vertices": len(core.data.vertices),
        "triangles": len(core.data.loop_triangles),
        "materials": len(core.data.materials), "main_tendrils": 18,
        "branch_tendrils": branch_count, "voxel_components_before_cleanup": islands,
        "removed_loose_vertices": removed,
        "dimensions": list(core.dimensions),
        "bounds_min": [min(point[axis] for point in bounds) for axis in range(3)],
        "bounds_max": [max(point[axis] for point in bounds) for axis in range(3)],
    }, indent=2))


if __name__ == "__main__":
    main()
