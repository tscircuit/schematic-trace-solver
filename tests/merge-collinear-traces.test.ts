import { describe, expect, test } from "bun:test"
import { mergeCollinearTraces } from "../lib/utils/mergeCollinearTraces"

describe("mergeCollinearTraces", () => {
  test("merges two overlapping horizontal segments", () => {
    const r = mergeCollinearTraces([
      { x1: 0, y1: 5, x2: 4, y2: 5 },
      { x1: 3, y1: 5, x2: 8, y2: 5 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ x1: 0, y1: 5, x2: 8, y2: 5 })
  })

  test("merges two touching horizontal segments", () => {
    const r = mergeCollinearTraces([
      { x1: 0, y1: 5, x2: 4, y2: 5 },
      { x1: 4, y1: 5, x2: 8, y2: 5 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ x1: 0, y1: 5, x2: 8, y2: 5 })
  })

  test("does not merge segments on different Y", () => {
    const r = mergeCollinearTraces([
      { x1: 0, y1: 5, x2: 4, y2: 5 },
      { x1: 0, y1: 6, x2: 4, y2: 6 },
    ])
    expect(r).toHaveLength(2)
  })

  test("merges two overlapping vertical segments", () => {
    const r = mergeCollinearTraces([
      { x1: 3, y1: 0, x2: 3, y2: 4 },
      { x1: 3, y1: 3, x2: 3, y2: 8 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ x1: 3, y1: 0, x2: 3, y2: 8 })
  })

  test("does not merge diagonal segments", () => {
    const r = mergeCollinearTraces([
      { x1: 0, y1: 0, x2: 4, y2: 4 },
      { x1: 2, y1: 2, x2: 6, y2: 6 },
    ])
    expect(r).toHaveLength(2)
  })

  test("does not merge segments with a gap", () => {
    const r = mergeCollinearTraces([
      { x1: 0, y1: 5, x2: 3, y2: 5 },
      { x1: 5, y1: 5, x2: 8, y2: 5 },
    ])
    expect(r).toHaveLength(2)
  })

  test("merges 3 collinear segments into one", () => {
    const r = mergeCollinearTraces([
      { x1: 0, y1: 0, x2: 2, y2: 0 },
      { x1: 2, y1: 0, x2: 5, y2: 0 },
      { x1: 4, y1: 0, x2: 8, y2: 0 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ x1: 0, y1: 0, x2: 8, y2: 0 })
  })

  test("handles reversed segment direction", () => {
    const r = mergeCollinearTraces([
      { x1: 4, y1: 5, x2: 0, y2: 5 },
      { x1: 8, y1: 5, x2: 3, y2: 5 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ x1: 0, y1: 5, x2: 8, y2: 5 })
  })
})
