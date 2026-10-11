import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

test("ground label stays on its wire", async () => {
  const { Circuit } = await import("@tscircuit/core")
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  let input: any
  circuit.on("solver:started", (event) => {
    if (event.solverName === "SchematicTracePipelineSolver")
      input = event.solverParams
  })
  const caption = "ground labels stay connected"
  circuit.add(
    <board>
      <net name="GND" />
      <net name="TEC_CURRENT_COMMAND" />
      <schematictext text={caption} schX={-2.5} schY={3} fontSize={0.18} />
      <chip
        name="U1"
        schWidth={2}
        pinLabels={{
          pin1: "P1",
          pin2: "P2",
          pin3: "P3",
          pin4: "P4",
          pin5: "P5",
          pin6: "P6",
          pin7: "P7",
          pin8: "P8",
          pin9: "P9",
          pin10: "P10",
          pin11: "P11",
          pin12: "P12",
          pin13: "P13",
          pin14: "P14",
          pin15: "P15",
        }}
        connections={{
          pin2: "net.GND",
          pin7: "net.GND",
          pin15: "net.GND",
          pin8: "net.TEC_CURRENT_COMMAND",
        }}
      />
      <diode name="D1" schX={-3} schY={-2} />
      <capacitor
        name="C1"
        capacitance="22uF"
        schX={-4}
        schY={-1}
        connections={{ pin2: "net.GND" }}
      />
      <capacitor
        name="C2"
        capacitance="22uF"
        schX={-6}
        schY={-1}
        connections={{ pin2: "net.GND" }}
      />
      <capacitor
        name="C3"
        capacitance="100nF"
        schX={-4}
        schY={1}
        connections={{ pin2: "net.GND" }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const solver = new SchematicTracePipelineSolver(input)
  solver.solve()
  // Core bundles its solver; apply the repository solver paths to the live Circuit JSON.
  for (const path of solver.netLabelToTraceSolver!.getOutput().traces) {
    const trace = circuit.db.schematic_trace.getWhere({
      source_trace_id: path.mspPairId,
    })!
    expect(trace).toBeDefined()
    circuit.db.schematic_trace.update(trace.schematic_trace_id, {
      edges: path.tracePath
        .slice(1)
        .map((to, i) => ({ from: path.tracePath[i]!, to })),
    })
  }
  const ground = circuit.db.source_net.getWhere({ name: "GND" })!
  const edges = circuit.db.schematic_trace
    .list()
    .filter(
      (trace) =>
        trace.subcircuit_connectivity_map_key ===
        ground.subcircuit_connectivity_map_key,
    )
    .flatMap((trace) => trace.edges)
  const labels = circuit.db.schematic_net_label
    .list()
    .filter((label) => label.source_net_id === ground.source_net_id)
  const orphans = labels.filter(
    (label) =>
      !edges.some(({ from, to }) => {
        const p = label.anchor_position!
        return (
          (Math.abs(from.x - p.x) < 1e-6 &&
            Math.abs(to.x - p.x) < 1e-6 &&
            p.y >= Math.min(from.y, to.y) &&
            p.y <= Math.max(from.y, to.y)) ||
          (Math.abs(from.y - p.y) < 1e-6 &&
            Math.abs(to.y - p.y) < 1e-6 &&
            p.x >= Math.min(from.x, to.x) &&
            p.x <= Math.max(from.x, to.x))
        )
      }) &&
      !circuit.db.schematic_port
        .list()
        .some(
          (pin) =>
            Math.hypot(
              pin.center.x - label.anchor_position!.x,
              pin.center.y - label.anchor_position!.y,
            ) < 1e-6,
        ),
  )
  const text = circuit.db.schematic_text.getWhere({ text: caption })!
  circuit.db.schematic_text.update(text.schematic_text_id, {
    text: orphans.length
      ? "FAIL: GND label floats below its wire"
      : "PASS: GND label stays attached to its wire",
  })
  const svg = convertCircuitJsonToSchematicSvg(circuit.db.toArray(), {
    colorOverrides: { schematic: { background: "white" } },
    width: 900,
    height: 500,
  }).replace(/[ \t]+$/gm, "")
  const snapshot = new URL(
    `./assets/ground-label-anchor-${orphans.length ? "failure" : "pass"}.svg`,
    import.meta.url,
  )
  if (process.env.BUN_UPDATE_SNAPSHOTS) await Bun.write(snapshot, svg)
  expect(labels.length).toBeGreaterThan(0)
  expect(orphans).toHaveLength(0)
  expect(svg).toBe(await Bun.file(snapshot).text())
})
