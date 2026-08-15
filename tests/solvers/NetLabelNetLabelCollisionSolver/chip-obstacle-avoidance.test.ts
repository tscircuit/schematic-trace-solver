import { test, expect } from "bun:test"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

test("NetLabelNetLabelCollisionSolver relocates net labels placed inside chip bodies (#655)", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [
          {
            pinId: "U1.pin1",
            center: { x: -1, y: 0 },
            facingDirection: "x-",
          },
        ],
      },
    ],
    connections: [],
  }

  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair-1" as any,
      tracePath: [
        { x: -1, y: 0 },
        { x: -3, y: 0 },
      ],
    },
  ]

  // Label initially placed at (0, 0) inside chip U1 with bounds [-0.5, -0.25, 0.5, 0.25]
  const initialPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "net_VCC",
      anchorPoint: { x: -1, y: 0 },
      center: { x: 0, y: 0 },
      width: 1,
      height: 0.5,
      orientation: "x+",
      mspConnectionPairIds: ["pair-1" as any],
    },
  ]

  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem,
    traces,
    netLabelPlacements: initialPlacements,
  })

  solver.solve()

  const { netLabelPlacements } = solver.getOutput()
  expect(netLabelPlacements.length).toBe(1)

  const placed = netLabelPlacements[0]!
  const bounds = getRectBounds(placed.center, placed.width, placed.height)

  // Verify the label has been moved out of the chip body (center was 0, 0)
  const isInsideChip =
    bounds.minX < 1 && bounds.maxX > -1 && bounds.minY < 1 && bounds.maxY > -1
  expect(isInsideChip).toBe(false)
})
