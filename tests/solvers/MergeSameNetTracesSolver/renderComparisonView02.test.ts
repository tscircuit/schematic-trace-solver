import { test, expect } from "bun:test"
import { MergeSameNetTracesSolver } from "lib/solvers/MergeSameNetTracesSolver/MergeSameNetTracesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import "tests/fixtures/matcher"

/**
 * This test renders a visual comparison of the MergeSameNetTracesSolver:
 * - Two parallel horizontal trace segments from the same net, close in Y
 * - After solving, they should be aligned to the same Y coordinate
 */
test("MergeSameNetTracesSolver - renderComparisonView02: merge parallel horizontal traces", async () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const inputTracePaths: SolvedTracePath[] = [
    {
      mspPairId: "h_pair1",
      globalConnNetId: "net_A",
      dcConnNetId: "net_A",
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
        { x: 5, y: 2 }, // horizontal segment at Y=2
        { x: 5, y: 4 },
      ],
      mspConnectionPairIds: ["h_pair1"],
      pinIds: ["h1", "h2"],
      pins: [] as any,
    },
    {
      mspPairId: "h_pair2",
      globalConnNetId: "net_A",
      dcConnNetId: "net_A",
      tracePath: [
        { x: 1, y: 0 },
        { x: 1, y: 2.5 },
        { x: 4, y: 2.5 }, // horizontal segment at Y=2.5 (close to Y=2)
        { x: 4, y: 4 },
      ],
      mspConnectionPairIds: ["h_pair2"],
      pinIds: ["h3", "h4"],
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
