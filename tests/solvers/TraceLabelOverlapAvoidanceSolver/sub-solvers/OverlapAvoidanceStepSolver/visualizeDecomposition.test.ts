import { test, expect } from "bun:test"
import { visualizeDecomposition } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/OverlapAvoidanceStepSolver/visualizeDecomposition"

test("visualizeDecomposition returns GraphicsObject", () => {
  const result = visualizeDecomposition({
    decomposedChildLabels: [],
    collidingTrace: {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [{ x: 0, y: 0 }],
      globalConnNetId: "net1",
    } as any,
    mergedLabel: {
      netId: "merged",
      globalConnNetId: "merged-group",
      center: { x: 5, y: 5 },
      width: 1,
      height: 1,
    } as any,
    graphics: { rects: [], texts: [] },
  })

  expect(result).toBeDefined()
  expect(result.rects).toBeDefined()
})

test("visualizeDecomposition adds rects for child labels", () => {
  const childLabels = [
    {
      netId: "net1",
      globalConnNetId: "net1",
      center: { x: 5, y: 5 },
      width: 0.5,
      height: 0.2,
    },
    {
      netId: "net2",
      globalConnNetId: "net2",
      center: { x: 6, y: 5 },
      width: 0.5,
      height: 0.2,
    },
  ]

  const result = visualizeDecomposition({
    decomposedChildLabels: childLabels as any,
    collidingTrace: {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [{ x: 0, y: 0 }],
      globalConnNetId: "net1",
    } as any,
    mergedLabel: {
      netId: "merged",
      globalConnNetId: "merged-group",
      center: { x: 5.5, y: 5 },
      width: 2,
      height: 1,
    } as any,
    graphics: { rects: [], texts: [] },
  })

  // Should add rects for each child label
  expect(result.rects?.length).toBeGreaterThanOrEqual(2)
})
