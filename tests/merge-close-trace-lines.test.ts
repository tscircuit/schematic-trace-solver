import { describe, it, expect } from "bun:test"
import { mergeCloseTraceLines } from "../lib/solvers/TraceMergerSolver"

describe("mergeCloseTraceLines", () => {
  it("merges two horizontal lines on the same Y with overlapping X ranges", () => {
    const result = mergeCloseTraceLines([
      { x1: 0, y1: 1.0, x2: 3, y2: 1.0, netId: "VCC" },
      { x1: 2, y1: 1.0, x2: 5, y2: 1.0, netId: "VCC" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0)
    expect(result[0].x2).toBeCloseTo(5)
  })

  it("merges two horizontal lines that are very close in Y (within threshold)", () => {
    const result = mergeCloseTraceLines([
      { x1: 0, y1: 1.000, x2: 4, y2: 1.000, netId: "GND" },
      { x1: 1, y1: 1.010, x2: 5, y2: 1.010, netId: "GND" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0)
    expect(result[0].x2).toBeCloseTo(5)
  })

  it("does NOT merge lines far apart in Y", () => {
    const result = mergeCloseTraceLines([
      { x1: 0, y1: 0, x2: 5, y2: 0, netId: "VCC" },
      { x1: 0, y1: 1, x2: 5, y2: 1, netId: "VCC" },
    ])
    expect(result).toHaveLength(2)
  })

  it("does NOT merge lines on different nets", () => {
    const result = mergeCloseTraceLines([
      { x1: 0, y1: 1.0, x2: 4, y2: 1.0, netId: "VCC" },
      { x1: 2, y1: 1.0, x2: 6, y2: 1.0, netId: "GND" },
    ])
    expect(result).toHaveLength(2)
  })

  it("merges two vertical lines on the same X with overlapping Y ranges", () => {
    const result = mergeCloseTraceLines([
      { x1: 2.0, y1: 0, x2: 2.0, y2: 3, netId: "VCC" },
      { x1: 2.0, y1: 2, x2: 2.0, y2: 6, netId: "VCC" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].y1).toBeCloseTo(0)
    expect(result[0].y2).toBeCloseTo(6)
  })

  it("merges multiple overlapping segments into one", () => {
    const result = mergeCloseTraceLines([
      { x1: 0, y1: 0, x2: 2, y2: 0, netId: "PWR" },
      { x1: 1, y1: 0, x2: 3, y2: 0, netId: "PWR" },
      { x1: 2, y1: 0, x2: 5, y2: 0, netId: "PWR" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].x2).toBeCloseTo(5)
  })
})
