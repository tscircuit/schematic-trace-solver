import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "../lib/SameNetTraceMergeSolver"
import "tests/fixtures/matcher" // Yeh important import tha!

test("SameNetTraceMergeSolver snapshot", () => {
  // Input: Do lines jo thodi si overlap aur tedhi (jog) hain
  const unmergedTraces = [
    { id: "t1", net_id: "net_A", x1: 3.6, y1: 0, x2: 3.6, y2: 5 },
    { id: "t2", net_id: "net_A", x1: 3.5256, y1: 4, x2: 3.5256, y2: 10 },
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: {} as any,
    traces: unmergedTraces,
  })

  solver.solve()

  // Yeh command image banayegi
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
