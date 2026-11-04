import { expect, test } from "bun:test"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import input from "../../bug-reports/bug-report-20261104T110624Z/bug-report-20261104T110624Z.json"

test("retains the upward rail when alternative placements are blocked", () => {
  const pipeline = new SchematicTracePipelineSolver(
    input as unknown as InputProblem,
  )
  pipeline.solveUntilPhase("availableNetOrientationSolver")
  pipeline.step()
  const params = pipeline.availableNetOrientationSolver!.getConstructorParams()
  const initial = params.netLabelPlacements.find(
    (label) => label.netId === "VREF",
  )!
  const solver = new AvailableNetOrientationSolver({
    ...params,
    netLabelPlacements: [initial],
    inputProblem: {
      ...params.inputProblem,
      textBoxes: [
        ...(params.inputProblem.textBoxes ?? []),
        // Block side placement while leaving the aligned column clear.
        {
          center: { x: -2.36, y: -1 },
          width: 10,
          height: 4.6,
          text: "obstacle",
        },
      ],
    },
  })
  solver.solve()
  const label = solver.getOutput().netLabelPlacements[0]!
  expect(label.orientation).toBe("y+")
  expect(label.anchorPoint.x).toBe(initial.anchorPoint.x)
  expect(label.anchorPoint.y).toBeGreaterThan(initial.anchorPoint.y)
  expect(
    solver.traces.some(
      (trace) =>
        solver.netLabelConnectorTraceIds.has(trace.mspPairId) &&
        tracePathContainsPoint(trace.tracePath, label.anchorPoint),
    ),
  ).toBe(true)
})
