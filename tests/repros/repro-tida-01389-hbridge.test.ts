import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tida-01389-hbridge.input.json"

// Reduced from the TIDA-01389 H-bridge in tscircuit/ti#116. It retains only
// the four components on the enclosing loop and the two nested capacitors.
test("repro: enclosing rectangle collapses into two smaller loops", () => {
  expect(inputProblem.chips).toHaveLength(6)
  expect(inputProblem.directConnections).toHaveLength(8)
  expect(inputProblem.netConnections).toHaveLength(0)

  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  const cyclePairSolver = solver.enclosingCycleConnectionPairSolver!
  expect(cyclePairSolver.stats.detectedCycleCount).toBe(1)
  expect(cyclePairSolver.stats.preservedNetCount).toBe(4)
  const pairKeys = new Set(
    cyclePairSolver.getOutput().mspConnectionPairs.map((pair) =>
      pair.pins
        .map((pin) => pin.pinId)
        .sort()
        .join("::"),
    ),
  )
  for (const pairKey of [
    "schematic_port_q1b_drain::schematic_port_q2a_drain",
    "schematic_port_q1a_drain::schematic_port_q1b_source",
    "schematic_port_q2a_source::schematic_port_q2b_drain",
    "schematic_port_q1a_source::schematic_port_q2b_source",
    "schematic_port_c17_1::schematic_port_c18_1",
    "schematic_port_c17_2::schematic_port_c18_2",
  ]) {
    expect(pairKeys.has(pairKey)).toBe(true)
  }

  const finalTraces = solver.netLabelToTraceSolver!.getOutput().traces
  for (const sideTraceId of [
    "schematic_port_q1b_source-schematic_port_q1a_drain",
    "schematic_port_q2a_source-schematic_port_q2b_drain",
  ]) {
    const sideTrace = finalTraces.find(
      (trace) => trace.mspPairId === sideTraceId,
    )
    expect(sideTrace).toBeDefined()
    const sideXs = sideTrace!.tracePath.map((point) => point.x)
    expect(Math.max(...sideXs) - Math.min(...sideXs)).toBeLessThan(0.02)
  }

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
