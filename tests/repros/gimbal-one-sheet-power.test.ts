import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import "tests/fixtures/matcher"
import inputProblem from "./assets/gimbal-one-sheet-power.input.json"

// Exact sheet_Power input captured from the auto-layout Gimbal One controller.
test("gimbal one power sheet trace routing", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: false,
    },
  )
  solver.solve()
  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const vmBranch = traces.find((trace) =>
    trace.pinIds.includes("schematic_port_22"),
  )!
  const vmHost = traces.find((trace) =>
    trace.pinIds.includes("schematic_port_15"),
  )!
  expect(
    tracePathContainsPoint(vmHost.tracePath, vmBranch.tracePath.at(-1)!),
  ).toBe(true)
  const junction = vmBranch.tracePath.at(-1)!
  expect(vmHost.tracePath).toHaveLength(3)
  expect(junction).toEqual(vmHost.tracePath[1]!)
  expect(vmBranch.tracePath.at(-2)!.x).toBeCloseTo(junction.x)
  expect(vmBranch.tracePath.at(-2)!.y).toBeGreaterThan(junction.y)
  expect(vmHost.tracePath[0]!.y).toBeLessThan(junction.y)
  expect(vmHost.tracePath.at(-1)!.y).toBeCloseTo(junction.y)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
