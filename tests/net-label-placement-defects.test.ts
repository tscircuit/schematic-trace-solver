import { expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import {
  getLabelsInsideChips,
  getOverlappingLabelPairs,
} from "tests/fixtures/labelPlacementDefects"

/**
 * Net-label placement defects per board: labels rendered inside a chip body
 * (illegible — see #655) and labels overlapping each other.
 *
 * These are current values, not targets. Several are open bugs. Pinning them
 * means a placement change that makes a board worse fails a named assertion
 * instead of disappearing into a regenerated SVG snapshot.
 *
 * If a change legitimately improves a board, lower the number in the same PR.
 */
const EXPECTED: Record<
  string,
  { insideChips: number; overlappingPairs: number }
> = {
  "bug-report-20260706T213649Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260706T220324Z": { insideChips: 0, overlappingPairs: 1 },
  "bug-report-20260707T020342Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260707T092615Z": { insideChips: 1, overlappingPairs: 1 },
  "bug-report-20260707T134549Z": { insideChips: 0, overlappingPairs: 1 },
  "bug-report-20260707T134722Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260707T140410Z": { insideChips: 0, overlappingPairs: 1 },
  "bug-report-20260707T141025Z": { insideChips: 1, overlappingPairs: 0 },
  "bug-report-20260707T141421Z": { insideChips: 1, overlappingPairs: 1 },
  "bug-report-20260707T230831Z": { insideChips: 4, overlappingPairs: 0 },
  "bug-report-20260708T053736Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260708T055430Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260708T095725Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260716T144856Z": { insideChips: 1, overlappingPairs: 0 },
  "bug-report-20260717T022934Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260717T031704Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260717T042845Z": { insideChips: 0, overlappingPairs: 0 },
  "bug-report-20260721T221026Z": { insideChips: 0, overlappingPairs: 2 },
  "bug-report-20260724T175257Z": { insideChips: 0, overlappingPairs: 0 },
}

const BUG_REPORTS_DIR = path.join(import.meta.dir, "bug-reports")

const measure = (board: string) => {
  const inputPath = path.join(BUG_REPORTS_DIR, board, `${board}.json`)
  const inputProblem = JSON.parse(fs.readFileSync(inputPath, "utf8"))

  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  // The *output* copy — `netLabelPlacements` on the solver is its input.
  const labels =
    solver.netLabelNetLabelCollisionSolver?.getOutput().netLabelPlacements ?? []

  return {
    insideChips: getLabelsInsideChips(labels, solver.inputProblem).length,
    overlappingPairs: getOverlappingLabelPairs(labels).length,
  }
}

test("every pinned board still exists", () => {
  const onDisk = fs
    .readdirSync(BUG_REPORTS_DIR)
    .filter((d) => fs.existsSync(path.join(BUG_REPORTS_DIR, d, `${d}.json`)))
    .sort()

  expect(onDisk).toEqual(Object.keys(EXPECTED).sort())
})

for (const [board, expected] of Object.entries(EXPECTED)) {
  test(`${board} label placement defects`, () => {
    expect(measure(board)).toEqual(expected)
  })
}
