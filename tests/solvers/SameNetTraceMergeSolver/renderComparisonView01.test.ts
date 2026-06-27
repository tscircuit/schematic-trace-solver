import { test, expect } from "bun:test"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
} from "graphics-debug"
import { SameNetTraceMergeSolver } from "lib/SameNetTraceMergeSolver"

/**
 * Reproduces the coordinate mismatch from example19 (Issue #34):
 *   - t1: x=3.6,   y=0  → y=5   (slight right)
 *   - t2: x=3.5256, y=4 → y=10  (slight left)
 * These two nearly-collinear segments produce a visual "jog" where they overlap.
 * After SameNetTraceMergeSolver they should snap to x=3.6 and merge into one
 * continuous segment: x=3.6, y=0 → y=10.
 */
test("SameNetTraceMergeSolver before/after comparison snapshot", () => {
  const unmergedTraces = [
    { id: "t1", net_id: "net_A", x1: 3.6, y1: 0, x2: 3.6, y2: 5 },
    { id: "t2", net_id: "net_A", x1: 3.5256, y1: 4, x2: 3.5256, y2: 10 },
  ]

  // --- BEFORE ---
  const beforeSolver = new SameNetTraceMergeSolver({
    inputProblem: {} as any,
    traces: structuredClone(unmergedTraces),
  })
  // Do NOT solve — visualize the raw jogged input
  const beforeGraphics = beforeSolver.visualize()

  // --- AFTER ---
  const afterSolver = new SameNetTraceMergeSolver({
    inputProblem: {} as any,
    traces: structuredClone(unmergedTraces),
  })
  afterSolver.solve()
  const afterGraphics = afterSolver.visualize()

  const sideBySide = getSvgFromGraphicsObject(
    stackGraphicsHorizontally([beforeGraphics, afterGraphics], {
      titles: ["Before (jogged traces)", "After (SameNetTraceMergeSolver)"],
    }),
    { backgroundColor: "white" },
  )

  expect(sideBySide).toMatchSvgSnapshot(import.meta.path)
})
