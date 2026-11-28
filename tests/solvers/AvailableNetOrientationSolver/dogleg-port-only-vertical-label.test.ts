import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import bugReport620 from "tests/bug-reports/bug-report-20260707T134549Z/bug-report-20260707T134549Z.json"

test("routes dogleg connectors for blocked port-only vertical labels on bug-report-20260707T134549Z (#620)", () => {
  const problem: InputProblem = JSON.parse(JSON.stringify(bugReport620))
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.netLabelToTraceSolver?.getOutput()
  expect(output).toBeDefined()
  if (!output) return

  const vinInputLabel = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("V_IN.1"),
  )
  const vinGroundLabel = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("V_IN.2"),
  )
  expect(vinInputLabel?.orientation).toBe("y+")
  expect(vinGroundLabel?.orientation).toBe("y-")

  for (let i = 0; i < output.netLabelPlacements.length; i++) {
    const first = output.netLabelPlacements[i]
    if (!first) continue
    const firstBounds = getRectBounds(first.center, first.width, first.height)
    for (let j = i + 1; j < output.netLabelPlacements.length; j++) {
      const second = output.netLabelPlacements[j]
      if (!second) continue
      const secondBounds = getRectBounds(
        second.center,
        second.width,
        second.height,
      )
      const overlaps =
        firstBounds.minX < secondBounds.maxX - 1e-6 &&
        firstBounds.maxX > secondBounds.minX + 1e-6 &&
        firstBounds.minY < secondBounds.maxY - 1e-6 &&
        firstBounds.maxY > secondBounds.minY + 1e-6
      expect(overlaps).toBe(false)
    }
  }
})
