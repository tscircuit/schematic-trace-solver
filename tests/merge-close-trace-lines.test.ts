import { describe, expect, it } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"

describe("SameNetTraceMergeSolver", () => {
  it("merges close horizontal same-net traces into a single line", () => {
    const solver = new SameNetTraceMergeSolver({
      traces: [
        {
          mspPairId: "A",
          netId: "VCC",
          points: [
            { x: 0, y: 1 },
            { x: 4, y: 1 },
          ],
        },
        {
          mspPairId: "B",
          netId: "VCC",
          points: [
            { x: 2, y: 1.01 },
            { x: 6, y: 1.01 },
          ],
        },
      ],
    })

    const result = solver.solve()
    expect(result.traces).toHaveLength(1)
    expect(result.traces[0]!.points).toEqual([
      { x: 0, y: 1.005 },
      { x: 6, y: 1.005 },
    ])
  })

  it("does not merge different nets", () => {
    const solver = new SameNetTraceMergeSolver({
      traces: [
        {
          mspPairId: "A",
          netId: "VCC",
          points: [
            { x: 0, y: 1 },
            { x: 4, y: 1 },
          ],
        },
        {
          mspPairId: "B",
          netId: "GND",
          points: [
            { x: 2, y: 1 },
            { x: 6, y: 1 },
          ],
        },
      ],
    })

    const result = solver.solve()
    expect(result.traces).toHaveLength(2)
  })
})
