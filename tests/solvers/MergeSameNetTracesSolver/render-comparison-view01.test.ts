import { expect, test } from "bun:test"
import { MergeSameNetTracesSolver } from "lib/solvers/MergeSameNetTracesSolver/MergeSameNetTracesSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

/**
 * This test renders a visual comparison of the MergeSameNetTracesSolver:
 * - Two parallel vertical trace segments from the same net, close in X
 * - After solving, they should be aligned to the same X coordinate
 */
test("MergeSameNetTracesSolver - renderComparisonView01: merge parallel vertical traces", async () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const inputTracePaths: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      globalConnNetId: "net_VCC",
      dcConnNetId: "net_VCC",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 5 }, // vertical segment at X=1
        { x: 5, y: 5 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["p1", "p2"],
      pins: [] as any,
    },
    {
      mspPairId: "pair2",
      globalConnNetId: "net_VCC",
      dcConnNetId: "net_VCC",
      tracePath: [
        { x: 0, y: 1 },
        { x: 1.3, y: 1 },
        { x: 1.3, y: 4 }, // vertical segment at X=1.3 (close to X=1)
        { x: 5, y: 4 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["p3", "p4"],
      pins: [] as any,
    },
    {
      mspPairId: "pair3",
      globalConnNetId: "net_GND",
      dcConnNetId: "net_GND",
      tracePath: [
        { x: 0, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 7 }, // vertical segment at X=3
        { x: 7, y: 7 },
      ],
      mspConnectionPairIds: ["pair3"],
      pinIds: ["p5", "p6"],
      pins: [] as any,
    },
    {
      mspPairId: "pair4",
      globalConnNetId: "net_GND",
      dcConnNetId: "net_GND",
      tracePath: [
        { x: 0, y: 3 },
        { x: 3.5, y: 3 },
        { x: 3.5, y: 6 }, // vertical segment at X=3.5 (close to X=3)
        { x: 7, y: 6 },
      ],
      mspConnectionPairIds: ["pair4"],
      pinIds: ["p7", "p8"],
      pins: [] as any,
    },
  ]

  const solver = new MergeSameNetTracesSolver({
    inputProblem,
    inputTracePaths,
  })

  solver.solve()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
