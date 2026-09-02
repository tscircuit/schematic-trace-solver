import { expect, test } from "bun:test"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "left-chip",
      center: { x: -2, y: 2 },
      width: 1,
      height: 1,
      pins: [{ pinId: "left-ground", x: -1.5, y: 2 }],
    },
    {
      chipId: "right-chip",
      center: { x: 2, y: 2 },
      width: 1,
      height: 1,
      pins: [{ pinId: "right-ground", x: 1.5, y: 2 }],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "ground",
      pinIds: ["left-ground", "right-ground"],
      isGround: true,
    },
  ],
  availableNetLabelOrientations: { ground: ["y-"] },
}

const groundTrace: SolvedTracePath = {
  mspPairId: "ground-trace",
  dcConnNetId: "ground",
  globalConnNetId: "ground",
  userNetId: "ground",
  pins: [
    { pinId: "left-ground", chipId: "left-chip", x: -1.5, y: 2 },
    { pinId: "right-ground", chipId: "right-chip", x: 1.5, y: 2 },
  ],
  tracePath: [
    { x: -1.5, y: 2 },
    { x: 0, y: 2 },
    { x: 0, y: 0 },
    { x: 1.5, y: 0 },
    { x: 1.5, y: 2 },
  ],
  mspConnectionPairIds: ["ground-trace"],
  pinIds: ["left-ground", "right-ground"],
}

const otherGroundTrace: SolvedTracePath = {
  ...groundTrace,
  mspPairId: "other-ground-trace",
  tracePath: [
    { x: -1.5, y: 3 },
    { x: 1.5, y: 3 },
  ],
  mspConnectionPairIds: ["other-ground-trace"],
}

const groundLabel: NetLabelPlacement = {
  globalConnNetId: "ground",
  netId: "ground",
  mspConnectionPairIds: ["other-ground-trace", "ground-trace"],
  pinIds: ["left-ground", "right-ground"],
  orientation: "x+",
  anchorPoint: { x: 0, y: 0 },
  center: { x: 0.5, y: 0 },
  width: 1,
  height: 0.2,
}

test("extends a cross-component ground rail downward without a lateral branch", () => {
  const solver = new AvailableNetOrientationSolver({
    inputProblem,
    traces: [otherGroundTrace, groundTrace],
    netLabelPlacements: [groundLabel],
  })

  solver.solve()

  const output = solver.getOutput()
  const placedGroundLabel = output.netLabelPlacements[0]!
  const hostTrace = output.traces.find(
    (trace) => trace.mspPairId === "ground-trace",
  )!
  const everySegmentIsOrthogonal = hostTrace.tracePath.every(
    (point, index, path) =>
      index === 0 ||
      point.x === path[index - 1]!.x ||
      point.y === path[index - 1]!.y,
  )

  expect(placedGroundLabel.orientation).toBe("y-")
  expect(placedGroundLabel.anchorPoint.x).toBe(groundLabel.anchorPoint.x)
  expect(placedGroundLabel.anchorPoint.y).toBeLessThan(
    groundLabel.anchorPoint.y,
  )
  expect(output.traces).toHaveLength(2)
  expect(everySegmentIsOrthogonal).toBe(true)
})
