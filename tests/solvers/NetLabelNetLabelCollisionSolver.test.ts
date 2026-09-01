import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "far-away-chip",
      center: { x: 100, y: 100 },
      width: 1,
      height: 1,
      pins: [],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: { B: ["y+"] },
  textBoxes: [],
})

const label = (overrides: Partial<NetLabelPlacement>): NetLabelPlacement => ({
  globalConnNetId: "A-global",
  netId: "A",
  mspConnectionPairIds: [],
  pinIds: ["A-pin"],
  orientation: "y-",
  anchorPoint: { x: 0, y: 0 },
  center: { x: 0, y: -0.3 },
  width: 0.2,
  height: 0.6,
  ...overrides,
})

const hostTrace: SolvedTracePath = {
  mspPairId: "B-trace",
  dcConnNetId: "B-global",
  globalConnNetId: "B-global",
  userNetId: "B",
  pins: [
    { pinId: "B-pin-1", chipId: "test-chip", x: 0, y: 0 },
    { pinId: "B-pin-2", chipId: "test-chip", x: 1, y: 0 },
  ],
  tracePath: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  mspConnectionPairIds: ["B-trace"],
  pinIds: ["B-pin-1", "B-pin-2"],
}

const boundsOf = (placement: NetLabelPlacement) => ({
  minX: placement.center.x - placement.width / 2,
  maxX: placement.center.x + placement.width / 2,
  minY: placement.center.y - placement.height / 2,
  maxY: placement.center.y + placement.height / 2,
})

const overlaps = (
  a: ReturnType<typeof boundsOf>,
  b: ReturnType<typeof boundsOf>,
) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

test("prefers a configured orientation when it has free space", () => {
  const fixedLabel = label({
    orientation: "y+",
    center: { x: 0, y: 0.3 },
  })
  const constrainedLabel = label({
    globalConnNetId: "B-global",
    netId: "B",
    mspConnectionPairIds: ["B-trace"],
    pinIds: ["B-pin-1", "B-pin-2"],
    orientation: "y+",
    center: { x: 0, y: 0.3 },
  })
  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem: inputProblem(),
    traces: [hostTrace],
    netLabelPlacements: [fixedLabel, constrainedLabel],
  })

  solver.solve()

  const movedLabel = solver.outputNetLabelPlacements[1]!
  expect(movedLabel.orientation).toBe("y+")
  expect(movedLabel.anchorPoint.x).toBeGreaterThan(0)
  expect(overlaps(boundsOf(fixedLabel), boundsOf(movedLabel))).toBe(false)
})

test("falls back when every configured-orientation candidate is obstructed", () => {
  const fixedLabel = label({
    orientation: "y+",
    center: { x: 0, y: 0.3 },
  })
  const constrainedLabel = label({
    globalConnNetId: "B-global",
    netId: "B",
    mspConnectionPairIds: ["B-trace"],
    pinIds: ["B-pin-1", "B-pin-2"],
    orientation: "y+",
    center: { x: 0, y: 0.3 },
  })
  const blockingTrace: SolvedTracePath = {
    ...hostTrace,
    mspPairId: "blocking-trace",
    dcConnNetId: "blocking-global",
    globalConnNetId: "blocking-global",
    userNetId: "BLOCKING",
    tracePath: [
      { x: -1, y: 0.3 },
      { x: 2, y: 0.3 },
    ],
    pins: [
      { pinId: "blocking-pin-1", chipId: "test-chip", x: -1, y: 0.3 },
      { pinId: "blocking-pin-2", chipId: "test-chip", x: 2, y: 0.3 },
    ],
    mspConnectionPairIds: ["blocking-trace"],
    pinIds: ["blocking-pin-1", "blocking-pin-2"],
  }
  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem: inputProblem(),
    traces: [hostTrace, blockingTrace],
    netLabelPlacements: [fixedLabel, constrainedLabel],
  })

  solver.solve()

  const movedLabel = solver.outputNetLabelPlacements[1]!
  expect(movedLabel.orientation).toBe("y-")
  expect(overlaps(boundsOf(fixedLabel), boundsOf(movedLabel))).toBe(false)
})
