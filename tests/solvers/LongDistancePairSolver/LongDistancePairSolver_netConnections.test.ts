import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"

const createThreePinProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "A",
      center: { x: 0, y: 0 },
      width: 0.2,
      height: 0.2,
      pins: [{ pinId: "A.1", x: 0, y: 0 }],
    },
    {
      chipId: "B",
      center: { x: 1, y: 0 },
      width: 0.2,
      height: 0.2,
      pins: [{ pinId: "B.1", x: 1, y: 0 }],
    },
    {
      chipId: "C",
      center: { x: 2, y: 0 },
      width: 0.2,
      height: 0.2,
      pins: [{ pinId: "C.1", x: 2, y: 0 }],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
})

const getPin = (
  inputProblem: InputProblem,
  pinId: string,
): InputPin & { chipId: string } => {
  for (const chip of inputProblem.chips) {
    const pin = chip.pins.find((candidate) => candidate.pinId === pinId)
    if (pin) return { ...pin, chipId: chip.chipId }
  }

  throw new Error(`Could not find pin ${pinId}`)
}

const getQueuedCandidatePinIds = (solver: LongDistancePairSolver): string[][] =>
  (
    solver as unknown as {
      queuedCandidatePairs: Array<
        [InputPin & { chipId: string }, InputPin & { chipId: string }]
      >
    }
  ).queuedCandidatePairs.map((pair) => pair.map((pin) => pin.pinId).sort())

test("long-distance solver does not route pure net-label-only connections", () => {
  const inputProblem = createThreePinProblem()
  inputProblem.netConnections = [{ netId: "SIG", pinIds: ["A.1", "B.1"] }]

  const solver = new LongDistancePairSolver({
    inputProblem,
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
  })

  expect(getQueuedCandidatePinIds(solver)).toHaveLength(0)
})

test("long-distance solver does not route net-label-only pins attached to a direct net", () => {
  const inputProblem = createThreePinProblem()
  inputProblem.directConnections = [{ pinIds: ["A.1", "B.1"], netId: "SIG" }]
  inputProblem.netConnections = [{ netId: "SIG", pinIds: ["C.1"] }]

  const pinA = getPin(inputProblem, "A.1")
  const pinB = getPin(inputProblem, "B.1")
  const primaryPair: MspConnectionPair = {
    mspPairId: "A.1-B.1",
    dcConnNetId: "SIG",
    globalConnNetId: "SIG",
    userNetId: "SIG",
    pins: [pinA, pinB],
  }
  const solvedTrace: SolvedTracePath = {
    ...primaryPair,
    tracePath: [
      { x: pinA.x, y: pinA.y },
      { x: pinB.x, y: pinB.y },
    ],
    mspConnectionPairIds: [primaryPair.mspPairId],
    pinIds: [pinA.pinId, pinB.pinId],
  }

  const solver = new LongDistancePairSolver({
    inputProblem,
    alreadySolvedTraces: [solvedTrace],
    primaryMspConnectionPairs: [primaryPair],
  })

  expect(getQueuedCandidatePinIds(solver)).toHaveLength(0)
})
