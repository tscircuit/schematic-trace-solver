import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { nearlyEqual } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "tests/assets/audio-amplifier-tas2505.input.json"
import "tests/fixtures/matcher"

test("repro AudioAmplifier TAS2505 schematic traces", () => {
  const typedInputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblem),
  )
  const solver = new SchematicTracePipelineSolver(typedInputProblem)

  solver.solve()

  const verticalTwoPinComponents = typedInputProblem.chips.filter(
    (chip) =>
      chip.pins.length === 2 &&
      chip.pins.some((pin) => pin._facingDirection === "y+") &&
      chip.pins.some((pin) => pin._facingDirection === "y-"),
  )
  const topCapacitorCenterY = Math.max(
    ...verticalTwoPinComponents.map((chip) => chip.center.y),
  )
  const topCapacitors = verticalTwoPinComponents.filter((chip) =>
    nearlyEqual(chip.center.y, topCapacitorCenterY),
  )
  const topCapacitorLowerPins = topCapacitors.flatMap((chip) =>
    chip.pins.filter((pin) => pin._facingDirection === "y-"),
  )
  const railStartX = Math.min(...topCapacitorLowerPins.map((pin) => pin.x))
  const railEndX = Math.max(...topCapacitorLowerPins.map((pin) => pin.x))
  const capacitorPinY = topCapacitorLowerPins[0]!.y
  const mainChip = typedInputProblem.chips.toSorted(
    (firstChip, secondChip) =>
      secondChip.width * secondChip.height - firstChip.width * firstChip.height,
  )[0]!
  const mainChipTopY = mainChip.center.y + mainChip.height / 2
  const topCapacitorRailTraces = solver
    .inlineNetLabelSolver!.getOutput()
    .traces.filter((trace) =>
      trace.tracePath.every(
        (point) =>
          point.x >= railStartX &&
          point.x <= railEndX &&
          point.y >= mainChipTopY &&
          point.y <= capacitorPinY,
      ),
    )
  const topCapacitorRailSegments = topCapacitorRailTraces.flatMap((trace) =>
    trace.tracePath.slice(0, -1).flatMap((start, index) => {
      const end = trace.tracePath[index + 1]!
      if (!nearlyEqual(start.y, end.y)) return []
      if (nearlyEqual(start.y, mainChipTopY)) return []
      if (nearlyEqual(start.y, capacitorPinY)) return []
      return [{ start, end }]
    }),
  )

  expect(topCapacitors).toHaveLength(4)
  expect(topCapacitorRailSegments).toHaveLength(6)
  const railEndpointYs = topCapacitorRailSegments.flatMap(({ start, end }) => [
    start.y,
    end.y,
  ])
  expect([...new Set(railEndpointYs)]).toHaveLength(1)
  const railEndpointXs = topCapacitorRailSegments.flatMap(({ start, end }) => [
    start.x,
    end.x,
  ])
  expect(Math.min(...railEndpointXs)).toBeCloseTo(railStartX)
  expect(Math.max(...railEndpointXs)).toBeCloseTo(railEndX)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
