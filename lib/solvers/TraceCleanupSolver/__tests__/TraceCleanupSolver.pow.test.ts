import { TraceCleanupSolver } from "../TraceCleanupSolver"

describe("POW: TraceCleanupSolver snapshot", () => {
  it("shows BEFORE and AFTER cleaned trace", () => {
    // Minimal test trace
    const input = {
      chips: [],
      labels: [],
      allTraces: [
        {
          id: "pow-demo",
          mspPairId: "pow-test",
          tracePath: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
            { x: 20, y: 20 },
          ],
        },
      ],
    }

    const solver = new TraceCleanupSolver(input)
    const result = solver.solve()

    // POW = Print Original & With-changes
    expect({
      BEFORE: input.allTraces,
      AFTER: result.cleanedTraces,
    }).toMatchSnapshot()
  })
})
