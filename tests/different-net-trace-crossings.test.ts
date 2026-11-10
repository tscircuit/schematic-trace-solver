import { expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import {
  getTraceCrossings,
  getTraceOverlaps,
} from "tests/fixtures/traceCrossings"

/**
 * Different-net trace crossings and collinear overlaps, measured across every
 * imported bug report.
 *
 * These are the current values, not a target — several of these boards are
 * open bugs. The point is that the numbers are pinned: a routing or cleanup
 * change that makes any board worse fails here instead of sliding into a
 * regenerated SVG snapshot where a crossing is easy to miss.
 *
 * Both numbers are pinned because either one alone is gameable. Two nets that
 * cross can always be "fixed" by making them run along each other instead, and
 * an overlap can always be "fixed" by introducing a crossing. Neither is
 * strictly better, so a change that trades one for the other should be visible
 * and deliberate rather than scored as an improvement by a one-sided count.
 *
 * If a change legitimately improves a board, lower the number in the same PR.
 */
const EXPECTED: Record<string, { crossings: number; overlaps: number }> = {
  "bug-report-20260706T213649Z": { crossings: 11, overlaps: 0 },
  "bug-report-20260706T220324Z": { crossings: 6, overlaps: 0 },
  "bug-report-20260721T221026Z": { crossings: 5, overlaps: 0 },
  "bug-report-20260716T144856Z": { crossings: 4, overlaps: 0 },
  "bug-report-20260717T022934Z": { crossings: 3, overlaps: 0 },
  "bug-report-20260707T134549Z": { crossings: 3, overlaps: 0 },
  "bug-report-20260708T055430Z": { crossings: 2, overlaps: 0 },
  // #727 moved this board from 2 crossings / 1 overlap to 3 crossings / 0
  // overlaps. Both numbers involve the same pair of segments
  // (`C_SENSE.2-C1.2` and `available-net-orientation-13-BAT_POS`), so that
  // change separated two nets that had been drawn on top of each other over a
  // 0.141-length span and left them crossing at a point instead. That is a
  // deliberate trade in the right direction, not a regression — which is only
  // visible because both quantities are pinned here.
  "bug-report-20260707T092615Z": { crossings: 3, overlaps: 0 },
  "bug-report-20260707T230831Z": { crossings: 2, overlaps: 0 },
  "bug-report-20260707T140410Z": { crossings: 1, overlaps: 0 },
  "bug-report-20260707T020342Z": { crossings: 1, overlaps: 0 },
  "bug-report-20260717T031704Z": { crossings: 0, overlaps: 0 },
  "bug-report-20260708T053736Z": { crossings: 0, overlaps: 0 },
  "bug-report-20260707T134722Z": { crossings: 0, overlaps: 0 },
  "bug-report-20260707T141025Z": { crossings: 0, overlaps: 0 },
  "bug-report-20260708T095725Z": { crossings: 0, overlaps: 0 },
  "bug-report-20260707T141421Z": { crossings: 0, overlaps: 0 },
  "bug-report-20260717T042845Z": { crossings: 0, overlaps: 0 },
  "bug-report-20260724T175257Z": { crossings: 0, overlaps: 0 },
}

const BUG_REPORTS_DIR = path.join(import.meta.dir, "bug-reports")

const measure = (board: string) => {
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

  return {
    crossings: getTraceCrossings(traces).length,
    overlaps: getTraceOverlaps(traces).length,
  }
}

test("every pinned board still exists", () => {
  const onDisk = fs
    .readdirSync(BUG_REPORTS_DIR)
    .filter((d) => fs.existsSync(path.join(BUG_REPORTS_DIR, d, `${d}.json`)))
    .sort()

  // A newly imported bug report should be added above rather than silently
  // going unmeasured.
  expect(onDisk).toEqual(Object.keys(EXPECTED).sort())
})

for (const [board, expected] of Object.entries(EXPECTED)) {
  test(`${board} has ${expected.crossings} different-net trace crossings and ${expected.overlaps} overlaps`, () => {
    expect(measure(board)).toEqual(expected)
  })
}
