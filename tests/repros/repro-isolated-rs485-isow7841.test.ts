import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-isolated-rs485-isow7841.input.json"

const EXPECTED_D_P_RAIL_Y = 2.2
const REDUNDANT_D_P_RAIL_Y = 2.3
const EXPECTED_COMPACT_GND1_RAIL_Y = 2.82
const COMPACT_GND1_TRACE_ID = "schematic_port_35-schematic_port_33"
const LOCAL_PROTECTION_RETURN_TRACE_ID = "schematic_port_63-schematic_port_60"
const EXPECTED_LOCAL_PROTECTION_RETURN_Y = 0.7
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
  const compactGnd1Trace =
    solver.sameNetJunctionAlignmentSolver?.outputTraces.find(
      (trace) => trace.mspPairId === COMPACT_GND1_TRACE_ID,
    )
  expect(compactGnd1Trace?.tracePath[1]?.y).toBeCloseTo(
    EXPECTED_COMPACT_GND1_RAIL_Y,
  )
  expect(compactGnd1Trace?.tracePath[2]?.y).toBeCloseTo(
    EXPECTED_COMPACT_GND1_RAIL_Y,
  )
  const localProtectionReturnTrace =
    solver.sameNetJunctionAlignmentSolver?.outputTraces.find(
      (trace) => trace.mspPairId === LOCAL_PROTECTION_RETURN_TRACE_ID,
    )
  expect(localProtectionReturnTrace?.tracePath[3]?.y).toBeCloseTo(
    EXPECTED_LOCAL_PROTECTION_RETURN_Y,
  )
  expect(localProtectionReturnTrace?.tracePath[4]?.y).toBeCloseTo(
    EXPECTED_LOCAL_PROTECTION_RETURN_Y,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
