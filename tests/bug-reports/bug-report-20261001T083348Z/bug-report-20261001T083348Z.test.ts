import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20261001T083348Z.json"
import "tests/fixtures/matcher"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"

test("bug-report-20261001T083348Z", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const pinIds = new Set([
    "schematic_port_2", // CLKIN
    "schematic_port_3", // ADDR
    "schematic_port_5", // SD
    "schematic_port_7", // GND
  ])
  const traces = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.filter(
      (trace) =>
        trace.pins.length === 2 &&
        trace.pins.every((pin) => pinIds.has(pin.pinId)),
    )
  expect(traces).toHaveLength(3)
  const railCoordinates = traces.flatMap((trace) =>
    trace.tracePath.slice(1).flatMap((end, i) => {
      const start = trace.tracePath[i]!
      return Math.abs(start.x - end.x) < 1e-6 &&
        Math.abs(start.y - end.y) > 1e-6
        ? [start.x]
        : []
    }),
  )
  expect(railCoordinates).toHaveLength(3)
  for (const coordinate of railCoordinates)
    expect(coordinate).toBeCloseTo(railCoordinates[0]!, 6)
  for (const pin of solver.inputProblem.chips[0]!.pins.filter((pin) =>
    pinIds.has(pin.pinId),
  )) {
    expect(
      traces.some((trace) => tracePathContainsPoint(trace.tracePath, pin)),
    ).toBe(true)
  }
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
