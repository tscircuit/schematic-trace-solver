import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"

test("does not recover a pair already joined by intersecting same-net traces", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "A",
        center: { x: -0.1, y: 0 },
        width: 0.2,
        height: 0.2,
        pins: [{ pinId: "A.1", x: 0, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "B",
        center: { x: 1.1, y: 0 },
        width: 0.2,
        height: 0.2,
        pins: [{ pinId: "B.1", x: 1, y: 0, _facingDirection: "x-" }],
      },
      {
        chipId: "C",
        center: { x: 0.5, y: -1.1 },
        width: 0.2,
        height: 0.2,
        pins: [{ pinId: "C.1", x: 0.5, y: -1, _facingDirection: "y+" }],
      },
      {
        chipId: "D",
        center: { x: 0.5, y: 1.1 },
        width: 0.2,
        height: 0.2,
        pins: [{ pinId: "D.1", x: 0.5, y: 1, _facingDirection: "y-" }],
      },
    ],
    directConnections: [],
    netConnections: [{ netId: "SIGNAL", pinIds: ["A.1", "B.1", "C.1", "D.1"] }],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 2,
  }
  const getPin = (chipId: string) => ({
    ...inputProblem.chips.find((chip) => chip.chipId === chipId)!.pins[0]!,
    chipId,
  })
  const [a, b, c, d] = ["A", "B", "C", "D"].map(getPin)
  const makeTrace = (
    mspPairId: string,
    pins: MspConnectionPair["pins"],
  ): SolvedTracePath => ({
    mspPairId,
    mspConnectionPairIds: [mspPairId],
    dcConnNetId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    pins,
    pinIds: pins.map((pin) => pin.pinId),
    tracePath: pins,
  })
  const connectionPair: MspConnectionPair = {
    mspPairId: "A.1-D.1",
    dcConnNetId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    pins: [a!, d!],
  }
  const alreadySolvedTraces = [
    makeTrace("A.1-B.1", [a!, b!]),
    makeTrace("C.1-D.1", [c!, d!]),
  ]

  const solver = new UnroutedTraceRecoverySolver({
    inputProblem,
    failedConnectionPairs: [connectionPair],
    alreadySolvedTraces,
  })
  solver.solve()

  expect(solver.solvedUnroutedTraces).toHaveLength(0)
})
