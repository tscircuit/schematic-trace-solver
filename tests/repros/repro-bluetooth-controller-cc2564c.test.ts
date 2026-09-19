import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-bluetooth-controller-cc2564c.input.json"

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

// Captured from tscircuit/ti's BluetoothController_CC2564C at 54d747b using
// @tscircuit/core main at 90b47bc.
test("repro bluetooth controller cc2564c trace routing", () => {
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

  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const supplyRail = traces.find((trace) =>
    trace.pinIds.includes("schematic_port_81"),
  )!
  const regulatorRail = traces.find((trace) =>
    trace.pinIds.includes("schematic_port_79"),
  )!
  const minimumRailSeparation = 0.06
  expect(supplyRail.globalConnNetId).not.toBe(regulatorRail.globalConnNetId)
  expect(
    Math.abs(supplyRail.tracePath[1]!.y - regulatorRail.tracePath[1]!.y),
  ).toBeGreaterThanOrEqual(minimumRailSeparation)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
