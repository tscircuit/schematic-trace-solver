import { expect, test } from "bun:test"
import { ConnectivityMap } from "connectivity-map"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-pga300-redundant-ground-traces.input.json"

// Full solver input captured from tscircuit/ti#117 at 067b6a2 using
// `tsci build ... --schematic-only --disable-pcb --solver-debug`.
// Only the debug serializer's { value_type: "undefined" } markers were removed.
const COMP = "schematic_port_10"
const GND = "schematic_port_7"
const C3_GND = "schematic_port_32"
const R1_GND = "schematic_port_38"

test("PGA300 preserves COMP to R1 without redundant ground branches", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const hasPair = (a: string, b: string) =>
    traces.some((trace) => trace.pinIds.includes(a) && trace.pinIds.includes(b))

  // GND labels provide global connectivity; they must not replace the
  // explicitly requested COMP -> R1 connection with unrelated ground branches.
  expect(hasPair(COMP, GND)).toBe(false)
  expect(hasPair(COMP, C3_GND)).toBe(false)
  expect(hasPair(COMP, R1_GND)).toBe(true)

  // Removing physical branches must leave every original GND pin connected
  // through a routed island and a ground label, including the capacitor pins.
  const renderedConnectivity = new ConnectivityMap({})
  for (const trace of traces)
    renderedConnectivity.addConnections([trace.pinIds])
  for (const label of netLabelPlacements) {
    if (label.netId) {
      renderedConnectivity.addConnections([[label.netId, ...label.pinIds]])
    }
  }
  const groundNet = renderedConnectivity.getNetConnectedToId("GND")
  expect(groundNet).toBeDefined()
  for (const pinId of inputProblem.netConnections.find((net) => net.isGround)!
    .pinIds) {
    expect(renderedConnectivity.getNetConnectedToId(pinId)).toBe(groundNet)
  }

  // Keep the already-fixed vertical Q1 emitter/R1 connection.
  const emitterTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_34") &&
      trace.pinIds.includes("schematic_port_37"),
  )!
  expect(emitterTrace).toBeDefined()
  for (const point of emitterTrace.tracePath) expect(point.x).toBeCloseTo(5.49)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
