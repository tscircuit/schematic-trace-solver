import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import input1036 from "tests/repros/assets/repro-pending-vertical-rail-exit-row-1036.input.json"
import input1114 from "tests/repros/assets/repro-pending-vertical-rail-exit-row-1114.input.json"

test.each([
  ["board#48 (#1036)", input1036],
  ["board#165 (#1114)", input1114],
])(
  "reserves exit rows for still-queued y+ vertical rail labels on %s",
  (_name, rawProblem) => {
    const problem: InputProblem = JSON.parse(JSON.stringify(rawProblem))
    const solver = new SchematicTracePipelineSolver(problem)
    solver.solve()

    const labels = solver.netLabelToTraceSolver!.getOutput().netLabelPlacements
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]!
      const allowed = label.netId
        ? problem.availableNetLabelOrientations[label.netId]
        : undefined
      if (allowed?.length) {
        expect(allowed).toContain(label.orientation)
      }
      for (let j = i + 1; j < labels.length; j++) {
        const other = labels[j]!
        expect(
          rectsOverlap(
            getRectBounds(label.center, label.width, label.height),
            getRectBounds(other.center, other.width, other.height),
          ),
        ).toBe(false)
      }
    }
  },
)
