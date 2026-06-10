import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: 0, y: 0 }],
    },
    {
      chipId: "U2",
      center: { x: 1, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 1, y: 0 }],
    },
    {
      chipId: "U3",
      center: { x: 2, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U3.1", x: 2, y: 0 }],
    },
  ],
  directConnections: [{ pinIds: ["U1.1", "U2.1"], netId: "SIG" }],
  netConnections: [{ pinIds: ["U3.1"], netId: "SIG" }],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
}

const primaryMspConnectionPairs: MspConnectionPair[] = [
  {
    mspPairId: "U1.1-U2.1",
    dcConnNetId: "SIG",
    globalConnNetId: "SIG",
    userNetId: "SIG",
    pins: [
      { pinId: "U1.1", x: 0, y: 0, chipId: "U1" },
      { pinId: "U2.1", x: 1, y: 0, chipId: "U2" },
    ],
  },
]

const alreadySolvedTraces: SolvedTracePath[] = [
  {
    mspPairId: "U1.1-U2.1",
    dcConnNetId: "SIG",
    globalConnNetId: "SIG",
    pins: primaryMspConnectionPairs[0]!.pins,
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    mspConnectionPairIds: ["U1.1-U2.1"],
    pinIds: ["U1.1", "U2.1"],
  },
]

test("long-distance solver does not route same-net label-only pins", () => {
  const solver = new LongDistancePairSolver({
    inputProblem,
    alreadySolvedTraces,
    primaryMspConnectionPairs,
  })

  expect((solver as any).queuedCandidatePairs).toHaveLength(0)
})
