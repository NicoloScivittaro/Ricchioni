"""Read-only GLB inspection. Does not modify or optimize the source asset."""
import hashlib
import json
import math
import pathlib
import struct

SOURCE = pathlib.Path(r"C:\Users\niluf.PC-NIKO\Downloads\green+goblin+3d+model.glb")
OUT = pathlib.Path(__file__).parent
raw = SOURCE.read_bytes()
magic, version, length = struct.unpack_from("<4sII", raw)
assert magic == b"glTF" and version == 2 and length == len(raw)
chunks = {}
offset = 12
while offset < length:
    size, kind = struct.unpack_from("<II", raw, offset)
    chunks[kind] = raw[offset + 8:offset + 8 + size]
    offset += 8 + size
assert offset == length
g = json.loads(chunks[0x4E4F534A])
binary = chunks[0x004E4942]

def accessor(index):
    a = g["accessors"][index]
    assert "sparse" not in a
    view = g["bufferViews"][a["bufferView"]]
    code = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}[a["componentType"]]
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    fmt = "<" + code * count
    stride = view.get("byteStride", struct.calcsize(fmt))
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    return [struct.unpack_from(fmt, binary, start + i * stride) for i in range(a["count"])]

def jpeg_size(data):
    assert data[:2] == b"\xff\xd8"
    i = 2
    while i < len(data):
        assert data[i] == 255
        while data[i] == 255:
            i += 1
        marker = data[i]
        i += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        size = struct.unpack_from(">H", data, i)[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height, width = struct.unpack_from(">HH", data, i + 3)
            return [width, height]
        i += size
    raise ValueError("JPEG dimensions not found")

p = g["meshes"][0]["primitives"][0]
positions = accessor(p["attributes"]["POSITION"])
joints = accessor(p["attributes"]["JOINTS_0"])
weights = accessor(p["attributes"]["WEIGHTS_0"])
indices = accessor(p["indices"])
skin = g["skins"][0]
binds = accessor(skin["inverseBindMatrices"])
image = g["images"][0]
view = g["bufferViews"][image["bufferView"]]
start = view.get("byteOffset", 0)
image_bytes = binary[start:start + view["byteLength"]]
animations = []
for anim in g.get("animations", []):
    times = [t[0] for s in anim["samplers"] for t in accessor(s["input"])]
    hips = []
    for c in anim["channels"]:
        target = c["target"]
        if g["nodes"][target["node"]].get("name") == "mixamorig:Hips" and target["path"] == "translation":
            hips = accessor(anim["samplers"][c["sampler"]]["output"])
    animations.append({
        "name": anim.get("name"), "channels": len(anim["channels"]),
        "target_nodes": len({c["target"]["node"] for c in anim["channels"]}),
        "start_seconds": min(times), "end_seconds": max(times),
        "span_seconds": max(times) - min(times),
        "interpolation": sorted({s.get("interpolation", "LINEAR") for s in anim["samplers"]}),
        "hips_translation_min": [min(v[k] for v in hips) for k in range(3)] if hips else None,
        "hips_translation_max": [max(v[k] for v in hips) for k in range(3)] if hips else None,
        "hips_first": hips[0] if hips else None, "hips_last": hips[-1] if hips else None,
    })
minimum = [min(v[k] for v in positions) for k in range(3)]
maximum = [max(v[k] for v in positions) for k in range(3)]
report = {
    "status": "STATIC ANALYSIS ONLY; Babylon import and game integration not executed",
    "source": str(SOURCE), "sha256": hashlib.sha256(raw).hexdigest(),
    "bytes": len(raw), "asset": g["asset"], "extensions_used": g.get("extensionsUsed", []),
    "meshes": len(g["meshes"]), "primitives": len(g["meshes"][0]["primitives"]),
    "vertices": len(positions), "triangles": len(indices) // 3,
    "local_bounds_min": minimum, "local_bounds_max": maximum,
    "local_dimensions": [maximum[k] - minimum[k] for k in range(3)],
    "invalid_indices": sum(i[0] >= len(positions) for i in indices),
    "nonfinite_positions": sum(not math.isfinite(x) for v in positions for x in v),
    "skins": len(g["skins"]), "joints": len(skin["joints"]),
    "finger_joints": sum("Hand" in g["nodes"][i].get("name", "") and any(f in g["nodes"][i].get("name", "") for f in ("Index", "Middle", "Ring", "Pinky", "Thumb")) for i in skin["joints"]),
    "joint_names": [g["nodes"][i].get("name") for i in skin["joints"]],
    "invalid_joint_indices": sum(j >= len(skin["joints"]) for v in joints for j in v),
    "negative_weights": sum(w < 0 for v in weights for w in v),
    "nonfinite_weights": sum(not math.isfinite(w) for v in weights for w in v),
    "max_weight_sum_error": max(abs(sum(v) - 1) for v in weights),
    "zero_weight_vertices": sum(sum(v) == 0 for v in weights),
    "nonfinite_inverse_bind_values": sum(not math.isfinite(x) for v in binds for x in v),
    "inverse_bind_count": len(binds),
    "morph_targets": len(p.get("targets", [])),
    "animations": animations,
    "materials": g["materials"], "texture_mime": image["mimeType"],
    "texture_dimensions": jpeg_size(image_bytes), "embedded_texture_bytes": len(image_bytes),
    "rgba8_base_memory_mib": 4096 * 4096 * 4 / 2**20,
    "rgba8_with_full_mips_estimate_mib": 4096 * 4096 * 4 * 4 / 3 / 2**20,
}
(OUT / "asset-analysis.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k not in ("joint_names", "materials")}, indent=2))
