import { expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTraceCrossings } from "tests/fixtures/traceCrossings"

/**
 * Different-net trace crossings, measured across every imported bug report.
 *
 * These are the current values, not a target — several of these boards are
 * open bugs. The point is that the numbers are pinned: a routing or cleanup
 * change that makes any board worse fails here instead of sliding into a
 * regenerated SVG snapshot where a crossing is easy to miss.
 *
 * If a change legitimately improves a board, lower the number in the same PR.
 */
const EXPECTED_CROSSINGS: Record<string, number> = {
  "bug-report-20260706T213649Z": 4,
  "bug-report-20260706T220324Z": 4,
  "bug-report-20260721T221026Z": 2,
  "bug-report-20260716T144856Z": 0,
  "bug-report-20260717T022934Z": 0,
  "bug-report-20260707T134549Z": 2,
  "bug-report-20260708T055430Z": 1,
  // 3, not 2: #727 (TraceOverlapShiftSolver) moved this board from 2 to 3
  // while fixing the RP2040 USB-C overlap. This PR's connector check does not
  // reach that crossing — reported on #727.
  "bug-report-20260707T092615Z": 3,
  "bug-report-20260707T230831Z": 2,
  "bug-report-20260707T140410Z": 1,
  "bug-report-20260707T020342Z": 1,
  "bug-report-20260717T031704Z": 0,
  "bug-report-20260708T053736Z": 0,
  "bug-report-20260707T134722Z": 0,
  "bug-report-20260707T141025Z": 0,
  "bug-report-20260708T095725Z": 0,
  "bug-report-20260707T141421Z": 0,
  "bug-report-20260717T042845Z": 0,
  "bug-report-20260724T175257Z": 0,
}

const BUG_REPORTS_DIR = path.join(import.meta.dir, "bug-reports")

const countCrossings = (board: string) => {
  const inputPath = path.join(BUG_REPORTS_DIR, board, `${board}.json`)
  const inputProblem = JSON.parse(fs.readFileSync(inputPath, "utf8"))

  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  // `netLabelNetLabelCollisionSolver` is the last pipeline step but only
  // adjusts labels, so the final trace geometry comes from the cleanup pass
  // feeding it.
  const traces =
    solver.traceCleanupSolver2?.getOutput().traces ??
    solver.traceLabelOverlapAvoidanceSolver?.getOutput().traces ??
    []

  return getTraceCrossings(traces).length
}

test("every pinned board still exists", () => {
  const onDisk = fs
    .readdirSync(BUG_REPORTS_DIR)
    .filter((d) => fs.existsSync(path.join(BUG_REPORTS_DIR, d, `${d}.json`)))
    .sort()

  // A newly imported bug report should be added above rather than silently
  // going unmeasured.
  expect(onDisk).toEqual(Object.keys(EXPECTED_CROSSINGS).sort())
})

for (const [board, expected] of Object.entries(EXPECTED_CROSSINGS)) {
  test(`${board} has ${expected} different-net trace crossings`, () => {
    expect(countCrossings(board)).toBe(expected)
  })
}
