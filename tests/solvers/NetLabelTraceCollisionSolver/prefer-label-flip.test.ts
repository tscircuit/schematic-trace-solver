import { expect, test } from "bun:test"
import { NetLabelTraceCollisionSolver } from "lib/solvers/NetLabelTraceCollisionSolver/NetLabelTraceCollisionSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeInputProblem = (
  availableNetLabelOrientations: InputProblem["availableNetLabelOrientations"] = {},
  allowInlineNetLabel = true,
): InputProblem => ({
  chips: [
    {
      chipId: "far-away-chip",
      center: { x: 100, y: 100 },
      width: 1,
      height: 1,
      pins: [],
    },
  ],
  directConnections: [
    {
      netId: "LABEL",
      pinIds: ["label-pin-1", "label-pin-2"],
      allowInlineNetLabel,
    },
  ],
  netConnections: [],
  availableNetLabelOrientations,
  textBoxes: [],
})

const hostTrace: SolvedTracePath = {
  mspPairId: "label-host",
  dcConnNetId: "label-global",
  globalConnNetId: "label-global",
  userNetId: "LABEL",
  pins: [
    { pinId: "label-pin-1", chipId: "test-chip", x: 0, y: 0 },
    { pinId: "label-pin-2", chipId: "test-chip", x: 2, y: 0 },
  ],
  tracePath: [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ],
  mspConnectionPairIds: ["label-host"],
  pinIds: ["label-pin-1", "label-pin-2"],
}

const crossingTrace: SolvedTracePath = {
  mspPairId: "crossing-trace",
  dcConnNetId: "crossing-global",
  globalConnNetId: "crossing-global",
  userNetId: "CROSSING",
  pins: [
    { pinId: "crossing-pin-1", chipId: "test-chip", x: 0, y: 0.3 },
    { pinId: "crossing-pin-2", chipId: "test-chip", x: 2, y: 0.3 },
  ],
  tracePath: [
    { x: 0, y: 0.3 },
    { x: 2, y: 0.3 },
  ],
  mspConnectionPairIds: ["crossing-trace"],
  pinIds: ["crossing-pin-1", "crossing-pin-2"],
}

const collidingLabel: NetLabelPlacement = {
  globalConnNetId: "label-global",
  dcConnNetId: "label-global",
  netId: "LABEL",
  mspConnectionPairIds: ["label-host"],
  pinIds: ["label-pin-1", "label-pin-2"],
  orientation: "y+",
  anchorPoint: { x: 1, y: 0 },
  center: { x: 1, y: 0.3 },
  width: 0.2,
  height: 0.6,
}

test("flips a clear anchored label before rerouting the colliding trace", () => {
  const solver = new NetLabelTraceCollisionSolver({
    inputProblem: makeInputProblem(),
    traces: [hostTrace, crossingTrace],
    netLabelPlacements: [collidingLabel],
  })

  solver.solve()

  expect(solver.outputNetLabelPlacements[0]).toMatchObject({
    orientation: "y-",
    anchorPoint: { x: 1, y: 0 },
    center: { x: 1, y: -0.3 },
  })
  expect(solver.outputTraces[1]!.tracePath).toEqual(crossingTrace.tracePath)
  expect(solver.completedReroutes).toHaveLength(0)
})

test("does not flip a label against its orientation constraint", () => {
  const solver = new NetLabelTraceCollisionSolver({
    inputProblem: makeInputProblem({ LABEL: ["y+"] }),
    traces: [hostTrace, crossingTrace],
    netLabelPlacements: [collidingLabel],
  })

  solver.step()

  expect(solver.outputNetLabelPlacements[0]!.orientation).toBe("y+")
  expect(solver.activeSubSolver).not.toBeNull()
})

test("does not flip a label into another anchored label", () => {
  const blockingLabel: NetLabelPlacement = {
    ...collidingLabel,
    globalConnNetId: "blocking-label-global",
    dcConnNetId: "blocking-label-global",
    netId: "BLOCKING_LABEL",
    mspConnectionPairIds: [],
    pinIds: ["blocking-label-pin"],
    orientation: "y-",
    center: { x: 1, y: -0.3 },
  }
  const solver = new NetLabelTraceCollisionSolver({
    inputProblem: makeInputProblem(),
    traces: [hostTrace, crossingTrace],
    netLabelPlacements: [collidingLabel, blockingLabel],
  })

  solver.step()

  expect(solver.outputNetLabelPlacements[0]!.orientation).toBe("y+")
  expect(solver.activeSubSolver).not.toBeNull()
})

test("does not flip a retained conventional label", () => {
  const solver = new NetLabelTraceCollisionSolver({
    inputProblem: makeInputProblem({}, false),
    traces: [hostTrace, crossingTrace],
    netLabelPlacements: [collidingLabel],
  })

  solver.step()

  expect(solver.outputNetLabelPlacements[0]!.orientation).toBe("y+")
  expect(solver.activeSubSolver).not.toBeNull()
})
