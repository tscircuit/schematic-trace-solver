import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createGroundProblem = ({
  availableNetLabelOrientations,
}: Pick<InputProblem, "availableNetLabelOrientations">): InputProblem => ({
  chips: [
    {
      chipId: "C1",
      center: { x: -5, y: 4 },
      width: 1,
      height: 2,
      pins: [
        {
          pinId: "C1.neg",
          x: -5,
          y: 3,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 3,
      height: 2,
      pins: [
        {
          pinId: "U1.GND",
          x: -1.5,
          y: 0.5,
          _facingDirection: "x-",
        },
      ],
    },
    {
      chipId: "LED1",
      center: { x: 3, y: -4 },
      width: 1,
      height: 1,
      pins: [
        {
          pinId: "LED1.neg",
          x: 3,
          y: -4.5,
          _facingDirection: "y-",
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["C1.neg", "U1.GND", "LED1.neg"],
    },
  ],
  availableNetLabelOrientations,
  maxMspPairDistance: 1,
})

test("uses local labels instead of a long trace for a labeled ground net", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createGroundProblem({
      availableNetLabelOrientations: { GND: ["y-"] },
    }),
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
    failedConnectionPairs: [],
  })

  solver.solve()

  expect(solver.getOutput().newTraces).toHaveLength(0)
})

test("keeps fallback routing when ground labels cannot be placed", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createGroundProblem({
      availableNetLabelOrientations: {},
    }),
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
    failedConnectionPairs: [],
  })

  solver.solve()

  expect(solver.getOutput().newTraces.length).toBeGreaterThan(0)
})
