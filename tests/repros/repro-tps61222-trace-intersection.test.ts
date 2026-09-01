import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { nearlyEqual } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-tps61222-trace-intersection.input.json"

// Extracted from https://github.com/tscircuit/core/pull/2785 with
// DEBUG=Group_doInitialSchematicTraceRender.
test("repro TPS61222 schematic trace intersection", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  const mainChip = inputProblem.chips.toSorted(
    (firstChip, secondChip) => secondChip.pins.length - firstChip.pins.length,
  )[0]!
  expect(inputProblem.textBoxes).toBeDefined()
  const manufacturerPartNumberTextBox = inputProblem
    .textBoxes!.filter((textBox) => textBox.chipId === mainChip.chipId)
    .toSorted(
      (firstTextBox, secondTextBox) =>
        firstTextBox.center.y - secondTextBox.center.y,
    )[0]
  expect(manufacturerPartNumberTextBox).toBeDefined()

  const textBounds = getTextBoxBounds(manufacturerPartNumberTextBox!)
  solver.solveUntilPhase("longDistancePairSolver")

  const leftCapacitor = inputProblem.chips
    .filter(
      (chip) =>
        chip.pins.length === 2 &&
        chip.pins.some((pin) => pin._facingDirection === "y-"),
    )
    .toSorted(
      (firstChip, secondChip) => firstChip.center.x - secondChip.center.x,
    )[0]!
  const leftCapacitorLowerPin = leftCapacitor.pins.find(
    (pin) => pin._facingDirection === "y-",
  )!
  const initialGroundTrace =
    solver.schematicTraceLinesSolver!.solvedTracePaths.find(
      (trace) =>
        trace.pinIds.includes(leftCapacitorLowerPin.pinId) &&
        trace.pins.some((pin) => pin.chipId === mainChip.chipId),
    )
  expect(initialGroundTrace).toBeDefined()
  expect(
    isPathCollidingWithObstacles(initialGroundTrace!.tracePath, [textBounds]),
  ).toBe(false)

  solver.solve()

  const crossingTraceIds = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.filter((trace) =>
      isPathCollidingWithObstacles(trace.tracePath, [textBounds]),
    )
    .map((trace) => trace.mspPairId)

  expect(crossingTraceIds).toEqual([])
  const groundTraces =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.filter(
      (trace) => trace.globalConnNetId === initialGroundTrace!.globalConnNetId,
    )
  const lowestHorizontalRailYs = groundTraces.map((trace) =>
    Math.min(
      ...trace.tracePath.slice(0, -1).flatMap((start, pointIndex) => {
        const end = trace.tracePath[pointIndex + 1]!
        if (!nearlyEqual(start.y, end.y)) return []
        return [start.y]
      }),
    ),
  )
  expect(groundTraces).toHaveLength(2)
  expect(
    lowestHorizontalRailYs.every((railY) =>
      nearlyEqual(railY, lowestHorizontalRailYs[0]!),
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
