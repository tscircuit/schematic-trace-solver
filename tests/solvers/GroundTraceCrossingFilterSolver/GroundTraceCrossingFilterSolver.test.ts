import { expect, test } from "bun:test"
import {
  getGroundTracesToReplaceWithLabels,
  tracePathsHaveInteriorIntersection,
} from "lib/solvers/GroundTraceCrossingFilterSolver/getGroundTracesToReplaceWithLabels"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { FacingDirection } from "lib/utils/dir"

const createTrace = ({
  mspPairId,
  globalConnNetId,
  userNetId,
  pinIds,
  firstFacingDirection,
  secondFacingDirection,
  tracePath,
}: {
  mspPairId: string
  globalConnNetId: string
  userNetId: string
  pinIds: [string, string]
  firstFacingDirection: FacingDirection
  secondFacingDirection: FacingDirection
  tracePath: SolvedTracePath["tracePath"]
}): SolvedTracePath => {
  const firstPin = {
    pinId: pinIds[0],
    chipId: "U1",
    x: tracePath[0]!.x,
    y: tracePath[0]!.y,
    _facingDirection: firstFacingDirection,
  }
  const secondPin = {
    pinId: pinIds[1],
    chipId: "U1",
    x: tracePath.at(-1)!.x,
    y: tracePath.at(-1)!.y,
    _facingDirection: secondFacingDirection,
  }
  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId,
    pins: [firstPin, secondPin],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [firstPin.pinId, secondPin.pinId],
  }
}

const groundTrace = createTrace({
  mspPairId: "ground-pair",
  globalConnNetId: "ground-net",
  userNetId: "GND",
  pinIds: ["ground-first-pin", "ground-second-pin"],
  firstFacingDirection: "y+",
  secondFacingDirection: "y-",
  tracePath: [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ],
})

const signalTrace = createTrace({
  mspPairId: "signal-pair",
  globalConnNetId: "signal-net",
  userNetId: "SIG",
  pinIds: ["signal-first-pin", "signal-second-pin"],
  firstFacingDirection: "x+",
  secondFacingDirection: "x-",
  tracePath: [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ],
})

test("finds only interior trace crossings", () => {
  expect(
    tracePathsHaveInteriorIntersection({
      firstTracePath: groundTrace.tracePath,
      secondTracePath: signalTrace.tracePath,
    }),
  ).toBe(true)
  expect(
    tracePathsHaveInteriorIntersection({
      firstTracePath: groundTrace.tracePath,
      secondTracePath: [
        { x: -1, y: 1 },
        { x: 0, y: 1 },
      ],
    }),
  ).toBe(false)
})

test("selects crossing GND traces for label replacement", () => {
  expect(
    getGroundTracesToReplaceWithLabels({
      traces: [groundTrace, signalTrace],
    }),
  ).toEqual([groundTrace])
})

test("selects same-side crossing GND traces", () => {
  const sameSideGroundTrace = createTrace({
    mspPairId: "same-side-ground-pair",
    globalConnNetId: "ground-net",
    userNetId: "GND",
    pinIds: ["same-side-first-pin", "same-side-second-pin"],
    firstFacingDirection: "y-",
    secondFacingDirection: "y-",
    tracePath: groundTrace.tracePath,
  })

  expect(
    getGroundTracesToReplaceWithLabels({
      traces: [sameSideGroundTrace, signalTrace],
    }),
  ).toEqual([sameSideGroundTrace])
})
