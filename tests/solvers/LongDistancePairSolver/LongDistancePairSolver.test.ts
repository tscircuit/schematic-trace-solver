import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("LongDistancePairSolver respects maxMspPairDistance", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "chip1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "A", x: 0, y: 0 },
          { pinId: "B", x: 1, y: 0 },
          { pinId: "C", x: 5, y: 0 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [{ netId: "net1", pinIds: ["A", "B", "C"] }],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 2,
  }

  const [pinA, pinB] = inputProblem.chips[0]!.pins
  const primaryMspConnectionPairs: MspConnectionPair[] = [
    {
      mspPairId: "A-B",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { ...pinA!, chipId: "chip1" },
        { ...pinB!, chipId: "chip1" },
      ],
    },
  ]

  const solver = new LongDistancePairSolver({
    inputProblem,
    alreadySolvedTraces: [],
    primaryMspConnectionPairs,
  })

  expect((solver as any).queuedCandidatePairs).toHaveLength(0)
})
