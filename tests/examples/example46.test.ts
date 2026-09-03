import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example46.json"
import "tests/fixtures/matcher"

test("example46", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const rawLoop = output.traces.find(
    (trace) => trace.pinIds.includes("U2.3") && trace.pinIds.includes("U2.1"),
  )!
  const rawLabel = output.netLabelPlacements.find(
    (label) => label.netId === "RAW",
  )!
  const nearbyGroundLabel = output.netLabelPlacements.find(
    (label) => label.netId === "GND" && Math.abs(label.center.x + 1.386) < 1e-6,
  )!

  expect(rawLoop.tracePath).toEqual([
    { x: -1.2850000000000001, y: -0.2 },
    { x: -1.485, y: -0.2 },
    { x: -1.485, y: 0.2 },
    { x: -1.2850000000000001, y: 0.2 },
  ])
  expect(rawLabel.orientation).toBe("x-")
  expect(rawLabel.anchorPoint).toEqual({ x: -1.485, y: -0.2 })
  expect(nearbyGroundLabel.orientation).toBe("y-")
  expect(nearbyGroundLabel.anchorPoint.y).toBeCloseTo(-0.601)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
