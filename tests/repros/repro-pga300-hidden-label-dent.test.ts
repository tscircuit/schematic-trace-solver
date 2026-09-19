import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("PGA300 ground connector stays straight without hidden direct-connection labels", async () => {
  const input: InputProblem = await Bun.file(
    new URL(
      "./assets/repro-pga300-redundant-ground-traces.input.json",
      import.meta.url,
    ),
  ).json()
  for (const connection of input.directConnections) {
    connection.labelFullyRoutedConnection = false
  }
  const solver = new SchematicTracePipelineSolver(input)
  solver.solve()
  expect(solver.solved).toBe(true)
  const groundLabel = solver
    .netLabelToTraceSolver!.getOutput()
    .netLabelPlacements.find((label) =>
      label.pinIds.includes("schematic_port_2"),
    )!
  expect(groundLabel).toBeDefined()
  const connector = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find((trace) =>
      trace.tracePath.some(
        (point) =>
          point.x === groundLabel.anchorPoint.x &&
          point.y === groundLabel.anchorPoint.y,
      ),
    )!
  expect(connector).toBeDefined()
  expect(connector.tracePath).toHaveLength(2)
  expect(connector.tracePath[0]!.y).toBeCloseTo(connector.tracePath[1]!.y)
  expect(
    solver.preAlignmentNetLabelTraceCollisionSolver!.completedReroutes,
  ).toHaveLength(0)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
