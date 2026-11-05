import { expect, test } from "bun:test"
import { doesSegmentIntersectRect } from "@tscircuit/math-utils"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-fixed-gnd-label-trace-overlap.input.json"

// solver:started input from core PR #3919 at deb549e8, reduced from SparkFun
// VEML7700. Only symbolName/netLabelText are added for readable snapshots;
// routing geometry is unchanged. Core omits the fixed GND label from input.
test("VEML7700 ground route overlaps a fixed label omitted from solver input", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  const { traces } = solver.netLabelToTraceSolver!.getOutput()
  const groundTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_2") &&
      trace.pinIds.includes("schematic_port_7"),
  )!

  // Current integration bug: the U1-to-D1 route crosses the fixed GND label's
  // bounds (anchor -1.1, 1.1; width 0.42, height 0.48, extending downward).
  // The label is absent from solver input and therefore from its snapshot.
  // Record the crossing without injecting label geometry into solver output.
  const fixedGroundLabelBounds = {
    minX: -1.31,
    maxX: -0.89,
    minY: 0.62,
    maxY: 1.1,
  }
  expect(
    groundTrace.tracePath
      .slice(1)
      .some((end, index) =>
        doesSegmentIntersectRect(
          groundTrace.tracePath[index]!,
          end,
          fixedGroundLabelBounds,
        ),
      ),
  ).toBe(true)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
