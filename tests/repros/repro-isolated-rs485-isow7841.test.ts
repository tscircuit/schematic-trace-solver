import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-isolated-rs485-isow7841.input.json"

const EXPECTED_D_P_RAIL_Y = 2.2
const REDUNDANT_D_P_RAIL_Y = 2.3
const EXPECTED_GND1_RAIL_Y = 1.76
const GND1_RAIL_PIN_IDS = ["schematic_port_35", "schematic_port_33"] satisfies [
  PinId,
  PinId,
]
const POINT_EPSILON = 1e-6

test("repro isolated RS-485 ISOW7841 schematic traces", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.schematicTraceLinesSolver?.solvedTracePaths).toHaveLength(50)
  expect(solver.schematicTraceLinesSolver?.failedConnectionPairs).toHaveLength(
    0,
  )
  expect(solver.sameNetJunctionAlignmentSolver?.stats.collapsedCycleCount).toBe(
    1,
  )
  expect(
    solver.sameNetJunctionAlignmentSolver?.stats.alignedJunctionCount,
  ).toBeGreaterThan(0)
  const dPLabel =
    solver.sameNetJunctionAlignmentSolver?.outputNetLabelPlacements.find(
      (label) => label.netId === "D_P",
    )
  expect(dPLabel?.anchorPoint.y).toBeCloseTo(EXPECTED_D_P_RAIL_Y)
  const dPLabelHostTrace =
    solver.sameNetJunctionAlignmentSolver?.outputTraces.find((trace) =>
      dPLabel?.mspConnectionPairIds.includes(trace.mspPairId),
    )
  expect(
    dPLabelHostTrace?.tracePath.some(
      (point) => Math.abs(point.y - REDUNDANT_D_P_RAIL_Y) < POINT_EPSILON,
    ),
  ).toBe(false)
  const gnd1RailTrace =
    solver.sameNetJunctionAlignmentSolver?.outputTraces.find((trace) =>
      GND1_RAIL_PIN_IDS.every((pinId) => trace.pinIds.includes(pinId)),
    )
  expect(gnd1RailTrace?.tracePath[1]?.y).toBeCloseTo(EXPECTED_GND1_RAIL_Y)
  expect(gnd1RailTrace?.tracePath[2]?.y).toBeCloseTo(EXPECTED_GND1_RAIL_Y)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
