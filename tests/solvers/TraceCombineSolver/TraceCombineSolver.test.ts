import { expect, test } from "bun:test"
import { TraceCombineSolver } from "lib/solvers/TraceCombineSolver/TraceCombineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("TraceCombineSolver should merge close parallel segments of the same net", () => {
  const mockTraces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      userNetId: "GND",
      dcConnNetId: "net0",
      globalConnNetId: "net0",
      pins: [
        { pinId: "p1a", x: 0, y: 0, chipId: "c1" },
        { pinId: "p1b", x: 10, y: 0, chipId: "c1" },
      ] as any,
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 }, // Point supplémentaire
        { x: 10, y: 0 },
      ],
      mspConnectionPairIds: ["p1"],
      pinIds: ["p1a", "p1b"],
    },
    {
      mspPairId: "trace2",
      userNetId: "GND",
      dcConnNetId: "net0",
      globalConnNetId: "net0",
      pins: [
        { pinId: "p2a", x: 0, y: 0.1, chipId: "c1" },
        { pinId: "p2b", x: 10, y: 0.1, chipId: "c1" },
      ] as any,
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 10, y: 0.1 },
      ],
      mspConnectionPairIds: ["p2"],
      pinIds: ["p2a", "p2b"],
    },
  ]

  const solver = new TraceCombineSolver({
    allTraces: mockTraces,
    distanceThreshold: 0.2,
  })
  
  solver.solve()
  const output = solver.getOutput()
  
  // Ce test doit échouer avec l'algorithme actuel 
  // car a.tracePath.length (3) !== b.tracePath.length (2)
  expect(output.traces.length).toBe(1)
})
