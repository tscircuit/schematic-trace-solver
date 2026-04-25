import { expect, test, describe } from "bun:test"
import { TraceMergerSolver } from "lib/solvers/TraceMergerSolver/TraceMergerSolver"

describe("TraceMergerSolver", () => {
  test("snaps two separate traces in the same net", () => {
    const solver = new TraceMergerSolver({
      allTraces: [
        {
          mspPairId: "trace1",
          globalConnNetId: "net1",
          tracePath: [
            { x: 0, y: 1.000 },
            { x: 5, y: 1.000 },
          ],
        } as any,
        {
          mspPairId: "trace2",
          globalConnNetId: "net1",
          tracePath: [
            { x: 1, y: 1.005 }, // Offset by 0.005, within 0.01 threshold
            { x: 6, y: 1.005 },
          ],
        } as any,
      ],
      threshold: 0.01,
    })
    solver.solve()
    const output = solver.getOutput().traces
    
    expect(output[0].tracePath[0].y).toBe(1.000)
    expect(output[1].tracePath[0].y).toBe(1.000) // Snapped!
  })
})
