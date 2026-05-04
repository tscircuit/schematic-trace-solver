import { expect, test } from "bun:test"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("Untangle double crossing traces", () => {
  const inputProblem: InputProblem = {
    connections: [
      { name: "net1", endpoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      { name: "net2", endpoints: [{ x: 0, y: 2 }, { x: 10, y: 2 }] },
    ],
    chips: [],
  } as any

  // Initial traces that "tangle" by crossing twice
  // net1: (0,0) -> (5,2) -> (10,0)
  // net2: (0,2) -> (5,0) -> (10,2)
  // They cross at roughly (2.5, 1) and (7.5, 1)
  const allTraces: SolvedTracePath[] = [
    {
      mspPairId: "net1",
      tracePath: [{ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 0 }],
    },
    {
      mspPairId: "net2",
      tracePath: [{ x: 0, y: 2 }, { x: 5, y: 0 }, { x: 10, y: 2 }],
    },
  ]

  const solver = new TraceCleanupSolver({
    inputProblem,
    allTraces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    targetTraceIds: new Set(["net1", "net2"]),
  } as any)

  solver.solve()

  const output = solver.getOutput().traces
  
  // We expect net1 and net2 to be simplified to straight lines or at least not cross
  // A perfect untangling would result in paths that don't intersect.
  
  const path1 = output.find(t => t.mspPairId === "net1")?.tracePath
  const path2 = output.find(t => t.mspPairId === "net2")?.tracePath

  console.log("Path 1:", JSON.stringify(path1))
  console.log("Path 2:", JSON.stringify(path2))

  // Basic check: paths should still connect endpoints
  expect(path1![0]).toEqual({ x: 0, y: 0 })
  expect(path1![path1!.length - 1]).toEqual({ x: 10, y: 0 })
  expect(path2![0]).toEqual({ x: 0, y: 2 })
  expect(path2![path2!.length - 1]).toEqual({ x: 10, y: 2 })
})
