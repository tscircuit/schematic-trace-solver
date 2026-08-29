import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const MAX_MSP_PAIR_DISTANCE = 2

const inputProblem: InputProblem = {
  chips: [-20, 0, 20].map((x, index) => ({
    chipId: `U${index + 1}`,
    center: { x, y: 0 },
    width: 1,
    height: 1,
    pins: [
      {
        pinId: `U${index + 1}.GND`,
        x: x + 0.5,
        y: 0,
        _facingDirection: "x+" as const,
      },
    ],
  })),
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.GND", "U2.GND", "U3.GND"],
      isGround: true,
      netLabelWidth: 0.72,
      netLabelHeight: 0.42,
    },
  ],
  availableNetLabelOrientations: { GND: ["x+"] },
  maxMspPairDistance: MAX_MSP_PAIR_DISTANCE,
}

test("repro 20-unit multi-pin ground trace despite 2-unit maxMspPairDistance", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const [longGroundTrace] = solver.longDistancePairSolver!.getOutput().newTraces
  expect(longGroundTrace).toBeDefined()

  const [start, end] = longGroundTrace!.pins
  const manhattanDistance =
    Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
  expect(manhattanDistance).toBe(20)
  expect(manhattanDistance).toBeGreaterThan(MAX_MSP_PAIR_DISTANCE)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
