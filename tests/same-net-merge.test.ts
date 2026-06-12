import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "../lib/SameNetTraceMergeSolver"
import "tests/fixtures/matcher"

test("SameNetTraceMergeSolver fixes trace jog", () => {
  const unmergedTraces = [
    { id: "t1", net_id: "net_A", x1: 3.6, y1: 0, x2: 3.6, y2: 5 },
    { id: "t2", net_id: "net_A", x1: 3.5256, y1: 4, x2: 3.5256, y2: 10 }
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: {} as any,
    traces: unmergedTraces,
  })
  
  solver.solve() 

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})