"""Split pinned v1.0.40 solver captures into section fixtures; see README.md."""

import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("capture_dir", type=Path)
parser.add_argument("published_circuit", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent
(root / "assets").mkdir(exist_ok=True)


def read_json(path):
    return json.loads(path.read_text())


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


circuit = read_json(args.capture_dir / "circuit.json")
components = {
    e["schematic_component_id"]: e
    for e in circuit if e["type"] == "schematic_component"
}
sources = {
    e["source_component_id"]: e
    for e in circuit if e["type"] == "source_component"
}
sheets = {
    e["schematic_sheet_id"]: e
    for e in circuit if e["type"] == "schematic_sheet"
}
published = {
    e["schematic_component_id"]: e
    for e in read_json(args.published_circuit)
    if e["type"] == "schematic_component"
}
assert components.keys() == published.keys()
for component_id, component in components.items():
    assert all(
        component.get(key) == published[component_id].get(key)
        for key in ("center", "size", "rotation", "symbol_name")
    ), f"Geometry changed: {component_id}"


def with_label_text(connection):
    net_id = connection.get("netId", "")
    if net_id and not net_id.startswith("source_"):
        return {**connection, "netLabelText": connection.get("netLabelText", net_id)}
    return connection


manifest = []
seen = set()
for index in range(9):
    original = read_json(args.capture_dir / f"input-{index}.json")
    for section in dict.fromkeys(c.get("sectionId") for c in original["chips"]):
        name = (section or "motor-power-mounting-and-test-points")
        name = name.replace("MCU__", "controller-").replace("_", "-").lower()
        chips = [c for c in original["chips"] if c.get("sectionId") == section]
        ids = {c["chipId"] for c in chips}
        pins = {p["pinId"] for c in chips for p in c["pins"]}
        assert not seen.intersection(ids), "Duplicate section membership"
        seen.update(ids)

        # Never silently remove one endpoint of a direct connection.
        for connection in original["directConnections"]:
            endpoints = set(connection["pinIds"])
            assert not pins.intersection(endpoints) or endpoints <= pins
        direct = [
            with_label_text(c) for c in original["directConnections"]
            if set(c["pinIds"]) <= pins
        ]
        nets = [
            with_label_text({**n, "pinIds": [p for p in n["pinIds"] if p in pins]})
            for n in original["netConnections"] if pins.intersection(n["pinIds"])
        ]
        assert all(b.get("chipId") for b in original["textBoxes"])
        net_ids = {c["netId"] for c in direct + nets if "netId" in c}
        members = {
            c["chipId"]: sources[components[c["chipId"]]["source_component_id"]]["name"]
            for c in chips
        }

        # Restore refdes/symbol metadata omitted by the older core adapter.
        rendered_chips = []
        for chip in chips:
            rendered = {**chip, "chipId": members[chip["chipId"]]}
            symbol = components[chip["chipId"]].get("symbol_name")
            if symbol:
                rendered["symbolName"] = symbol
            rendered_chips.append(rendered)
        boxes = [
            {**b, "chipId": members[b["chipId"]]}
            for b in original["textBoxes"] if b["chipId"] in ids
        ]
        fixture = {
            **original,
            "chips": rendered_chips,
            "directConnections": direct,
            "netConnections": nets,
            "textBoxes": boxes,
            "availableNetLabelOrientations": {
                n: orientations
                for n, orientations in original["availableNetLabelOrientations"].items()
                if n in net_ids
            },
            "_hideRatsNet": True,
        }
        write_json(root / "assets" / f"{name}.input.json", fixture)
        sheet = sheets[components[chips[0]["chipId"]]["schematic_sheet_id"]]["name"]
        manifest.append({
            "file": name,
            "sheet": sheet,
            "section": section,
            "components": members,
            "pinCount": len(pins),
            "directConnectionCount": len(direct),
            "netConnectionCount": len(nets),
        })
        (root / f"{name}.test.ts").write_text(f'''import {{ expect, test }} from "bun:test"
import {{ SchematicTracePipelineSolver }} from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type {{ InputProblem }} from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/{name}.input.json"

// v1.0.40, sheet {sheet}, section {section or '(unsectioned)'}.
// Components: {', '.join(members.values())}.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: {name}", async () => {{
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
}})
''')

assert seen == set(components), "Missing schematic components"
assert len(seen) == 115 and len(manifest) == 24
write_json(root / "assets" / "manifest.json", {
    "package": "imrishabh18/rp2040-motor-controller",
    "version": "1.0.40",
    "releaseId": "cb88c834-87f2-42f1-8839-a2893dd7b77e",
    "coreVersion": "0.0.2032",
    "publishedCircuitJsonSha256": hashlib.sha256(args.published_circuit.read_bytes()).hexdigest(),
    "sections": manifest,
})
print(f"Generated {len(manifest)} reproductions for {len(seen)} components")
