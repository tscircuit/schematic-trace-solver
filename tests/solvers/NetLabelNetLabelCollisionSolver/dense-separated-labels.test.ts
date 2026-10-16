import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"

test("scans dense separated labels without repeatedly reading their geometry", () => {
  let geometryReads = 0
  const labels = Array.from({ length: 500 }, (_, index): NetLabelPlacement => {
    const center = { x: index * 2, y: 0 }
    return {
      netId: `net-${index}`,
      globalConnNetId: `net-${index}`,
      pinIds: [],
      mspConnectionPairIds: [],
      anchorPoint: { x: center.x - 0.5, y: 0 },
      get center() {
        geometryReads++
        return center
      },
      width: 1,
      height: 0.2,
      orientation: "x+",
    }
  })
  const movableLabels = labels.slice(0, 250)
  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    traces: [],
    netLabelPlacements: movableLabels,
    fixedNetLabelPlacements: labels.slice(250),
    useRenderedLabelBounds: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(geometryReads).toBeLessThanOrEqual(labels.length * 2)
  expect(solver.getOutput().netLabelPlacements).toEqual(movableLabels)
})
