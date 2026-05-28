import { expect, test } from "bun:test"
import { TraceSegmentMergeSolver } from "lib/solvers/TraceSegmentMergeSolver/TraceSegmentMergeSolver"
import { makeTrace } from "./TraceSegmentMergeSolver.helpers"

test("renders a focused trace segment merge snapshot", async () => {
  const solver = new TraceSegmentMergeSolver({
    inputTracePaths: [
      makeTrace("A-B", "net-1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("C-D", "net-1", [
        { x: 1, y: 0.08 },
        { x: 3, y: 0.08 },
      ]),
      makeTrace("E-F", "net-2", [
        { x: 5, y: 0 },
        { x: 5, y: 1.5 },
      ]),
    ],
  })

  solver.solve()

  await expect(solver).toMatchSolverSnapshot(
    import.meta.path,
    "TraceSegmentMergeSolver",
  )
})

test("renders a focused blocked collision snapshot", async () => {
  const solver = new TraceSegmentMergeSolver({
    inputTracePaths: [
      makeTrace("A-B", "net-1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("C-D", "net-1", [
        { x: 0, y: 0.08 },
        { x: 4, y: 0.08 },
      ]),
      makeTrace("E-F", "net-2", [
        { x: 1, y: 0.04 },
        { x: 3, y: 0.04 },
      ]),
    ],
  })

  solver.solve()

  await expect(solver).toMatchSolverSnapshot(
    import.meta.path,
    "TraceSegmentMergeSolver-blocked-collision",
  )
})
