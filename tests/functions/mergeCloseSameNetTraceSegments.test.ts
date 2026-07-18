import { describe, expect, test } from "bun:test"
import { mergeCloseSameNetTraceSegments } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"

describe("mergeCloseSameNetTraceSegments", () => {
  test("merges overlapping horizontal same-net segments", () => {
    const result = mergeCloseSameNetTraceSegments([
      { x1: 0, y1: 1, x2: 3, y2: 1, netId: "VCC" },
      { x1: 2, y1: 1, x2: 5, y2: 1, netId: "VCC" },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ x1: 0, y1: 1, x2: 5, y2: 1 })
  })

  test("merges vertical same-net segments whose fixed axis is within tolerance", () => {
    const result = mergeCloseSameNetTraceSegments([
      { x1: 2, y1: 0, x2: 2, y2: 3, netId: "GND" },
      { x1: 2.01, y1: 2, x2: 2.01, y2: 6, netId: "GND" },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]!.x1).toBeCloseTo(2)
    expect(result[0]!.x2).toBeCloseTo(2)
    expect(result[0]!.y1).toBeCloseTo(0)
    expect(result[0]!.y2).toBeCloseTo(6)
  })

  test("merges approximately straight same-net segments within tolerance", () => {
    const result = mergeCloseSameNetTraceSegments([
      { x1: 0, y1: 1, x2: 3, y2: 1.01, netId: "VCC" },
      { x1: 2, y1: 1.005, x2: 5, y2: 1.005, netId: "VCC" },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]!.x1).toBeCloseTo(0)
    expect(result[0]!.x2).toBeCloseTo(5)
    expect(result[0]!.y1).toBeCloseTo(result[0]!.y2)
  })

  test("does not merge segments on different nets", () => {
    const result = mergeCloseSameNetTraceSegments([
      { x1: 0, y1: 0, x2: 3, y2: 0, netId: "VCC" },
      { x1: 1, y1: 0, x2: 4, y2: 0, netId: "GND" },
    ])

    expect(result).toHaveLength(2)
  })
})
