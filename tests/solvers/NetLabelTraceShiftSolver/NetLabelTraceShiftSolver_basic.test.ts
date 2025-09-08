import { test, expect } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { NetLabelTraceShiftSolver } from "lib/solvers/NetLabelTraceShiftSolver/NetLabelTraceShiftSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

test("NetLabelTraceShiftSolver moves trace away from net label", () => {
  const trace: SolvedTracePath = {
    mspPairId: "t1",
    dcConnNetId: "d1",
    globalConnNetId: "g1",
    pins: [
      { pinId: "p1", chipId: "c1", x: 0, y: 0 },
      { pinId: "p2", chipId: "c2", x: 5, y: 2 },
    ],
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 5, y: 2 },
    ],
    mspConnectionPairIds: ["t1"],
    pinIds: ["p1", "p2"],
  }

  const label: NetLabelPlacement = {
    globalConnNetId: "g2",
    dcConnNetId: undefined,
    netId: undefined,
    mspConnectionPairIds: [],
    pinIds: [],
    orientation: "x+",
    anchorPoint: { x: 0, y: 0 },
    width: 1,
    height: 0.5,
    center: { x: 1.5, y: 1 },
  }

  const solver = new NetLabelTraceShiftSolver({
    inputProblem,
    inputTraceMap: { t1: trace },
    netLabelPlacements: [label],
  })

  solver.solve()

  const newPath = solver.correctedTraceMap["t1"].tracePath
  const rect = {
    minX: label.center.x - label.width / 2,
    maxX: label.center.x + label.width / 2,
    minY: label.center.y - label.height / 2,
    maxY: label.center.y + label.height / 2,
  }

  // Ensure the horizontal segment moved outside the label bounds
  expect(
    newPath[1].y < rect.minY || newPath[1].y > rect.maxY,
  ).toBe(true)

  // Ensure the final path no longer intersects the label rectangle
  let intersects = false
  for (let i = 0; i < newPath.length - 1; i++) {
    if (segmentIntersectsRect(newPath[i]!, newPath[i + 1]!, rect)) {
      intersects = true
      break
    }
  }
  expect(intersects).toBe(false)
})

