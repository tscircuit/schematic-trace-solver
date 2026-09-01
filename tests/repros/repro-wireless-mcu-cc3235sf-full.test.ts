import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-wireless-mcu-cc3235sf-full.input.json"

const BOTTOM_CAPACITOR_RAIL_PIN_IDS = new Set([
  "schematic_port_86",
  "schematic_port_88",
  "schematic_port_90",
  "schematic_port_92",
  "schematic_port_94",
])

const TOP_CAPACITOR_RAIL_PIN_IDS = new Set([
  "schematic_port_69",
  "schematic_port_71",
  "schematic_port_73",
  "schematic_port_75",
  "schematic_port_77",
  "schematic_port_79",
  "schematic_port_81",
])

function getHorizontalRailYs(trace: SolvedTracePath): number[] {
  const railYs: number[] = []
  for (let index = 1; index < trace.tracePath.length; index++) {
    const start = trace.tracePath[index - 1]!
    const end = trace.tracePath[index]!
    if (start.y === end.y) railYs.push(start.y)
  }
  return railYs
}

// Complete "group-trace-render-input-problem" capture from tscircuit/ti's
// WirelessMCU_CC3235SF, including the full capacitor bank and support circuitry.
test("repro WirelessMCU CC3235SF full schematic trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const alignedTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const bottomRailYs = alignedTraces
    .filter((trace) =>
      trace.pinIds.every((pinId) => BOTTOM_CAPACITOR_RAIL_PIN_IDS.has(pinId)),
    )
    .flatMap(getHorizontalRailYs)
  expect(bottomRailYs).toHaveLength(4)
  for (const railY of bottomRailYs) {
    expect(railY).toBeCloseTo(bottomRailYs[0]!)
  }

  const topRailYs = alignedTraces
    .filter((trace) =>
      trace.pinIds.every((pinId) => TOP_CAPACITOR_RAIL_PIN_IDS.has(pinId)),
    )
    .flatMap(getHorizontalRailYs)
  const topRailFeeder = alignedTraces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_81") &&
      trace.pinIds.includes("schematic_port_65"),
  )!
  const feederRailY = getHorizontalRailYs(topRailFeeder)[0]!
  expect(topRailYs).toHaveLength(6)
  for (const railY of topRailYs) {
    expect(railY).toBeCloseTo(feederRailY)
  }

  const c1C2GroundTrace = alignedTraces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_66") &&
      trace.pinIds.includes("schematic_port_68"),
  )
  const nearbyGroundFeeder = alignedTraces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_68") &&
      trace.pinIds.includes("schematic_port_126"),
  )
  expect(c1C2GroundTrace).toBeDefined()
  expect(nearbyGroundFeeder).toBeDefined()
  const c1C2GroundRailY = getHorizontalRailYs(c1C2GroundTrace!)[0]!
  const nearbyGroundFeederRailY = getHorizontalRailYs(nearbyGroundFeeder!)[0]!
  expect(c1C2GroundRailY).toBeCloseTo(nearbyGroundFeederRailY)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
