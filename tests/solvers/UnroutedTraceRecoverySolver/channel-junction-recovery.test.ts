import { expect, test } from "bun:test"
import {
  countPathIntersections,
  getPathLength,
} from "lib/solvers/Example28Solver/geometry"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"

// Transpose the repro's supply topology so recovery joins a vertical rail.
const getRecoveryFixture = () => {
  const railStart: MspConnectionPair["pins"][number] = {
    pinId: "supply-output",
    chipId: "supply",
    x: 0.12,
    y: -1.22,
    _facingDirection: "y+",
  }
  const railEnd: MspConnectionPair["pins"][number] = {
    pinId: "rail-end",
    chipId: "rail-end-component",
    x: 0,
    y: 0,
    _facingDirection: "x+",
  }
  const branchPin: MspConnectionPair["pins"][number] = {
    pinId: "branch-pin",
    chipId: "branch-component",
    x: 1.3225,
    y: 0.325,
    _facingDirection: "x+",
  }
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "supply",
        center: { x: 0.12, y: -1.32 },
        width: 0.2,
        height: 0.2,
        pins: [railStart],
      },
      {
        chipId: "rail-end-component",
        center: { x: -0.38, y: 0.195 },
        width: 0.76,
        height: 1.04,
        pins: [railEnd],
      },
      {
        chipId: "branch-component",
        center: { x: 1.0225, y: 0.5425 },
        width: 0.6,
        height: 1.085,
        pins: [branchPin],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "VCC",
        pinIds: [railStart.pinId, railEnd.pinId, branchPin.pinId],
      },
    ],
    textBoxes: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 2.4,
  }
  const connectionPair: MspConnectionPair = {
    mspPairId: "branch-pair",
    dcConnNetId: "VCC",
    globalConnNetId: "VCC",
    pins: [railEnd, branchPin],
  }
  const existingRail: SolvedTracePath = {
    mspPairId: "existing-rail",
    mspConnectionPairIds: ["existing-rail"],
    dcConnNetId: "VCC",
    globalConnNetId: "VCC",
    pins: [railStart, railEnd],
    pinIds: [railStart.pinId, railEnd.pinId],
    tracePath: [railStart, { x: 0.12, y: 0 }, railEnd],
  }
  return {
    inputProblem,
    failedConnectionPairs: [connectionPair],
    alreadySolvedTraces: [existingRail],
  }
}

test("joins a vertical same-net rail without an extra endpoint detour", () => {
  const fixture = getRecoveryFixture()
  const solver = new UnroutedTraceRecoverySolver(fixture)
  solver.solve()

  const recoveredPath = solver.solvedUnroutedTraces[0]!.tracePath
  expect(recoveredPath).toHaveLength(4)
  expect(getPathLength(recoveredPath)).toBeCloseTo(2.1275)
  expect(recoveredPath.at(-1)).toEqual({ x: 0.12, y: -0.2 })
  expect(
    tracePathContainsPoint(
      fixture.alreadySolvedTraces[0]!.tracePath,
      recoveredPath.at(-1)!,
    ),
  ).toBe(true)
})

test("keeps a recovered channel junction clear of text", () => {
  const fixture = getRecoveryFixture()
  fixture.inputProblem.textBoxes!.push({
    center: { x: 1, y: -0.2 },
    width: 0.1,
    height: 0.1,
  })
  const solver = new UnroutedTraceRecoverySolver(fixture)
  solver.solve()

  expect(solver.solvedUnroutedTraces).toHaveLength(1)
  const recoveredPath = solver.solvedUnroutedTraces[0]!.tracePath
  expect(getPathLength(recoveredPath)).toBeGreaterThan(2.1275)
  expect(
    findFirstCollision(recoveredPath, [
      { minX: 0.95, maxX: 1.05, minY: -0.25, maxY: -0.15 },
    ]),
  ).toBeNull()
})

test("keeps a recovered channel junction clear of another net", () => {
  const fixture = getRecoveryFixture()
  const blockingTrace: SolvedTracePath = {
    mspPairId: "blocking-pair",
    mspConnectionPairIds: ["blocking-pair"],
    dcConnNetId: "OTHER",
    globalConnNetId: "OTHER",
    pins: [
      { pinId: "blocker-start", chipId: "blocker", x: 1, y: -0.3 },
      { pinId: "blocker-end", chipId: "blocker", x: 1, y: -0.1 },
    ],
    pinIds: ["blocker-start", "blocker-end"],
    tracePath: [
      { x: 1, y: -0.3 },
      { x: 1, y: -0.1 },
    ],
  }
  fixture.alreadySolvedTraces.push(blockingTrace)
  const solver = new UnroutedTraceRecoverySolver(fixture)
  solver.solve()

  expect(solver.solvedUnroutedTraces).toHaveLength(1)
  const recoveredPath = solver.solvedUnroutedTraces[0]!.tracePath
  expect(getPathLength(recoveredPath)).toBeGreaterThan(2.1275)
  expect(countPathIntersections(recoveredPath, blockingTrace.tracePath)).toBe(0)
})
