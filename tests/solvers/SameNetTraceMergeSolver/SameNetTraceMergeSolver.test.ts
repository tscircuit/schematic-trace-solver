import { describe, expect, it } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makePath = (
  id: string,
  netId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): SolvedTracePath =>
  ({
    mspPairId: id,
    mspConnectionPairIds: [id],
    globalConnNetId: netId,
    userNetId: netId,
    pinIds: [`${id}-pin1`, `${id}-pin2`],
    pins: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
    tracePath: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
  }) as unknown as SolvedTracePath

describe("SameNetTraceMergeSolver", () => {
  it("merges two overlapping collinear horizontal segments of the same net", () => {
    const traces: SolvedTracePath[] = [
      makePath("a", "net1", 0, 0, 3, 0),
      makePath("b", "net1", 2, 0, 5, 0),
    ]

    const solver = new SameNetTraceMergeSolver({ inputTracePaths: traces })
    solver.solve()

    expect(solver.mergedTracePaths).toHaveLength(1)
    const merged = solver.mergedTracePaths[0]!
    // Should span from 0 to 5 on y=0
    const xs = merged.tracePath.map((p) => p.x).sort((a, b) => a - b)
    expect(xs[0]).toBe(0)
    expect(xs[1]).toBe(5)
  })

  it("does not merge segments from different nets", () => {
    const traces: SolvedTracePath[] = [
      makePath("a", "net1", 0, 0, 3, 0),
      makePath("b", "net2", 2, 0, 5, 0),
    ]

    const solver = new SameNetTraceMergeSolver({ inputTracePaths: traces })
    solver.solve()

    // Each net retains its own segment
    expect(solver.mergedTracePaths).toHaveLength(2)
  })

  it("merges two adjacent vertical segments", () => {
    const traces: SolvedTracePath[] = [
      makePath("a", "net1", 1, 0, 1, 3),
      makePath("b", "net1", 1, 3, 1, 6),
    ]

    const solver = new SameNetTraceMergeSolver({ inputTracePaths: traces })
    solver.solve()

    expect(solver.mergedTracePaths).toHaveLength(1)
    const merged = solver.mergedTracePaths[0]!
    const ys = merged.tracePath.map((p) => p.y).sort((a, b) => a - b)
    expect(ys[0]).toBe(0)
    expect(ys[1]).toBe(6)
  })

  it("leaves non-overlapping segments of the same net separate", () => {
    const traces: SolvedTracePath[] = [
      makePath("a", "net1", 0, 0, 2, 0),
      makePath("b", "net1", 5, 0, 8, 0), // gap of 3 units
    ]

    const solver = new SameNetTraceMergeSolver({ inputTracePaths: traces })
    solver.solve()

    // They should NOT be merged since there's a gap
    expect(solver.mergedTracePaths).toHaveLength(2)
  })

  it("is marked solved after solve()", () => {
    const solver = new SameNetTraceMergeSolver({ inputTracePaths: [] })
    expect(solver.solved).toBe(false)
    solver.solve()
    expect(solver.solved).toBe(true)
  })
})
