import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "../lib/SameNetTraceMergeSolver"

test("merges close same-net trace lines and removes jogs", () => {
  const unmergedTraces = [
    { id: "t1", net_id: "net_A", x1: 3.6, y1: 0, x2: 3.6, y2: 5 },
    { id: "t2", net_id: "net_A", x1: 3.5256, y1: 4, x2: 3.5256, y2: 10 },
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: {} as any,
    traces: unmergedTraces,
  })

  solver.step()
  const result = solver.getOutput().traces

  expect(result).toHaveLength(1)
  expect(result[0].net_id).toBe("net_A")
  expect(result[0].y1).toBe(0)
  expect(result[0].y2).toBe(10)
  expect(result[0].x1).toBe(3.6)
})
