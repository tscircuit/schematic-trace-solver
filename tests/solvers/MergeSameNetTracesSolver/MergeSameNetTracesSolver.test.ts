import { test, expect } from "bun:test"
import { MergeSameNetTracesSolver } from "../../../lib/solvers/MergeSameNetTracesSolver/MergeSameNetTracesSolver"
import type { InputProblem } from "../../../lib/types/InputProblem"
import type { SolvedTracePath } from "../../../lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("MergeSameNetTracesSolver merges parallel traces of the same net", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const inputTracePaths: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
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
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      tracePath: [
        { x: 0, y: 1 },
        { x: 1.2, y: 1 },
        { x: 1.2, y: 4 }, // vertical segment at X=1.2 (close to X=1)
        { x: 5, y: 4 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["p3", "p4"],
      pins: [] as any,
    },
  ]

  const solver = new MergeSameNetTracesSolver({
    inputProblem,
    inputTracePaths,
  })

  solver.solve()
  const output = solver.getOutput()

  const mergedTraces = output.allTracesMerged

  // Verify that both vertical segments are now at the same X coordinate.
  // One of them should have been snapped to the other.
  const t1 = mergedTraces.find((t) => t.mspPairId === "pair1")!
  const t2 = mergedTraces.find((t) => t.mspPairId === "pair2")!

  // Check the vertical segment X coordinate
  expect(t1.tracePath[1].x).toBe(t1.tracePath[2].x)
  expect(t2.tracePath[1].x).toBe(t2.tracePath[2].x)

  // They should now share the same X coordinate
  expect(t1.tracePath[1].x).toBe(t2.tracePath[1].x)
})
