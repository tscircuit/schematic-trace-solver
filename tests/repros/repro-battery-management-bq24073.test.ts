import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-battery-management-bq24073.input.json"

const EXPECTED_BOTTOM_GROUND_LABEL_X = 1.1

const getPinPair = (pinIds: string[]): [string, string] => {
  if (pinIds.length !== 2) {
    throw new Error(`Expected two pin IDs, received ${pinIds.length}`)
  }
  return [pinIds[0]!, pinIds[1]!]
}

const parseFacingDirection = (facingDirection: string): FacingDirection => {
  if (
    facingDirection === "x+" ||
    facingDirection === "x-" ||
    facingDirection === "y+" ||
    facingDirection === "y-"
  ) {
    return facingDirection
  }
  throw new Error(`Unexpected facing direction: ${facingDirection}`)
}

// Captured from tscircuit/ti's BatteryManagement_BQ24073 on main at
// b009960e using @tscircuit/core main at 01b67dbb.
test("repro BatteryManagement_BQ24073 schematic traces", () => {
  const solverInput: InputProblem = {
    ...inputProblem,
    chips: inputProblem.chips.map((chip) => ({
      ...chip,
      pins: chip.pins.map((pin) => {
        if ("_facingDirection" in pin) {
          return {
            ...pin,
            _facingDirection: parseFacingDirection(pin._facingDirection),
          }
        }
        return pin
      }),
    })),
    directConnections: inputProblem.directConnections.map((connection) => ({
      ...connection,
      pinIds: getPinPair(connection.pinIds),
    })),
    availableNetLabelOrientations: Object.fromEntries(
      Object.entries(inputProblem.availableNetLabelOrientations).map(
        ([netId, facingDirections]) => [
          netId,
          facingDirections.map(parseFacingDirection),
        ],
      ),
    ),
  }
  const solver = new SchematicTracePipelineSolver(solverInput)
  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundNetIds = new Set(
    solverInput.netConnections
      .filter((connection) => connection.isGround)
      .map((connection) => connection.netId),
  )
  const bottomGroundLabel = output.netLabelPlacements
    .filter(
      (label) => label.netId !== undefined && groundNetIds.has(label.netId),
    )
    .sort((first, second) => first.anchorPoint.y - second.anchorPoint.y)[0]!

  expect(solver.inlineNetLabelSolver!.stats.pushedAnchoredNetLabelCount).toBe(1)
  expect(bottomGroundLabel.anchorPoint.x).toBeCloseTo(
    EXPECTED_BOTTOM_GROUND_LABEL_X,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
