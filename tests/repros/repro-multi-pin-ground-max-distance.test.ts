import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const MAX_MSP_PAIR_DISTANCE = 2.4

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U2",
      center: { x: 0, y: 0 },
      width: 1.4,
      height: 0.6,
      pins: [
        { pinId: "U2.IN", x: -1.1, y: 0.2, _facingDirection: "x-" },
        { pinId: "U2.EN", x: -1.1, y: 0, _facingDirection: "x-" },
        { pinId: "U2.GND", x: -1.1, y: -0.2, _facingDirection: "x-" },
        { pinId: "U2.OUT", x: 1.1, y: 0.2, _facingDirection: "x+" },
        { pinId: "U2.NC", x: 1.1, y: -0.2, _facingDirection: "x+" },
      ],
    },
    ...[-2.3, 2.6].map((x, index) => ({
      chipId: index === 0 ? "C1" : "C3",
      center: { x, y: 0 },
      width: 0.6,
      height: 0.2,
      pins: [
        {
          pinId: `${index === 0 ? "C1" : "C3"}.1`,
          x,
          y: 0.3,
          _facingDirection: "y+" as const,
        },
        {
          pinId: `${index === 0 ? "C1" : "C3"}.2`,
          x,
          y: -0.3,
          _facingDirection: "y-" as const,
        },
      ],
    })),
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U2.GND", "C1.2", "C3.2"],
      isGround: true,
      netLabelWidth: 0.72,
      netLabelHeight: 0.42,
    },
  ],
  availableNetLabelOrientations: { GND: ["x-", "y-"] },
  maxMspPairDistance: MAX_MSP_PAIR_DISTANCE,
}

test("repro SparkFun Qwiic Shim over-distance ground trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const [longGroundTrace] = solver.longDistancePairSolver!.getOutput().newTraces
  expect(longGroundTrace).toBeDefined()

  const [start, end] = longGroundTrace!.pins
  const manhattanDistance =
    Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
  expect(new Set(longGroundTrace!.pinIds)).toEqual(new Set(["C3.2", "U2.GND"]))
  expect(manhattanDistance).toBeCloseTo(3.8)
  expect(manhattanDistance).toBeGreaterThan(MAX_MSP_PAIR_DISTANCE)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
