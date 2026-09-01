import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { isVertical } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-hub-usb-sheet.input.json"

// Captured from @tsci/mohan-bee.hub 1.0.12 using @tscircuit/core 0.0.1816.
// Only opaque schematic component IDs were replaced with unique source names.
test("repro hub USB sheet schematic trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundNetIds = new Set(
    inputProblem.netConnections
      .filter((connection) => connection.isGround)
      .map((connection) => connection.netId),
  )
  const pinChipMap = new Map<PinId, InputChip>(
    inputProblem.chips.flatMap((chip) =>
      chip.pins.map((pin) => [pin.pinId, chip] as const),
    ),
  )
  const sameChipGroundLabel = output.netLabelPlacements.find((label) => {
    if (
      label.pinIds.length !== 2 ||
      label.netId === undefined ||
      !groundNetIds.has(label.netId)
    ) {
      return false
    }
    const firstChip = pinChipMap.get(label.pinIds[0]!)
    const secondChip = pinChipMap.get(label.pinIds[1]!)
    return firstChip === secondChip && (firstChip?.pins.length ?? 0) > 2
  })!
  const sameChipGroundHostTrace = output.traces.find((trace) =>
    sameChipGroundLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const verticalHostPoint = sameChipGroundHostTrace.tracePath.find(
    (point, index, path) => index > 0 && isVertical(path[index - 1]!, point),
  )!
  const tracesAtSameChipGroundLabel = output.traces.filter((trace) =>
    tracePathContainsPoint(trace.tracePath, sameChipGroundLabel.anchorPoint),
  )

  expect(sameChipGroundLabel.orientation).toBe("y-")
  expect(sameChipGroundLabel.anchorPoint.x).toBeCloseTo(verticalHostPoint.x)
  expect(tracesAtSameChipGroundLabel).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
