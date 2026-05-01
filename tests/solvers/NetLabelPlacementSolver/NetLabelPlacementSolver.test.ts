import { test, expect } from "bun:test"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Build a minimal InputProblem with two chips whose port-only net labels
 * would normally collide if placed without collision detection.
 *
 * Layout (Y grows up, X grows right):
 *   C1 at x=-1, pins at (−1, 0.5) [VCC, y+] and (−1, -0.5) [GND, y-]
 *   C2 at x= 1, pins at ( 1, 0.5) [VCC, y+] and ( 1, -0.5) [GND, y-]
 *
 * Both VCC pins want y+ placement (upward), both GND pins want y- (downward).
 * Without port-only-first ordering + collision detection the second VCC and
 * second GND label would be placed at the same position as the first.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: -1, y: 0 },
      width: 0.4,
      height: 1.2,
      pins: [
        { pinId: "C1.1", x: -1, y: 0.6 },
        { pinId: "C1.2", x: -1, y: -0.6 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 1, y: 0 },
      width: 0.4,
      height: 1.2,
      pins: [
        { pinId: "C2.1", x: 1, y: 0.6 },
        { pinId: "C2.2", x: 1, y: -0.6 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VCC", pinIds: ["C1.1", "C2.1"] },
    { netId: "GND", pinIds: ["C1.2", "C2.2"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
}

test("port-only net labels are placed first (ordering)", () => {
  const solver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: {},
  })
  solver.solve()

  const placements = solver.netLabelPlacements
  // Should have 4 placements: VCC at C1.1, VCC at C2.1, GND at C1.2, GND at C2.2
  expect(placements.length).toBe(4)

  const vccPlacements = placements.filter((p) => p.netId === "VCC")
  const gndPlacements = placements.filter((p) => p.netId === "GND")
  expect(vccPlacements.length).toBe(2)
  expect(gndPlacements.length).toBe(2)
})

test("net labels for same net do not overlap each other", () => {
  const solver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: {},
  })
  solver.solve()

  const placements = solver.netLabelPlacements

  // Check that no two label rects overlap
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i]!
      const b = placements[j]!
      const aMinX = a.center.x - a.width / 2
      const aMaxX = a.center.x + a.width / 2
      const aMinY = a.center.y - a.height / 2
      const aMaxY = a.center.y + a.height / 2
      const bMinX = b.center.x - b.width / 2
      const bMaxX = b.center.x + b.width / 2
      const bMinY = b.center.y - b.height / 2
      const bMaxY = b.center.y + b.height / 2

      const overlapX = Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX)
      const overlapY = Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY)
      const overlaps = overlapX > 1e-3 && overlapY > 1e-3

      if (overlaps) {
        throw new Error(
          `Labels "${a.netId}" (pin ${a.pinIds[0]}) and "${b.netId}" (pin ${b.pinIds[0]}) overlap:\n` +
            `  a: center=(${a.center.x.toFixed(3)}, ${a.center.y.toFixed(3)}) size=${a.width}x${a.height}\n` +
            `  b: center=(${b.center.x.toFixed(3)}, ${b.center.y.toFixed(3)}) size=${b.width}x${b.height}`,
        )
      }
    }
  }
})
