import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "../bug-reports/bug-report-20260716-long-trace-670/input.json"

// https://github.com/tscircuit/schematic-trace-solver/issues/670
// Rail nets with declared net-label orientations (V3_3 y+, GND y-) must be
// rendered with net labels at distant pins, not long bus traces snaking
// across the schematic. LongDistancePairSolver previously connected pins
// like JP1.2-JP2.2 (10+ units apart) on labeled rails with orthogonal
// traces up to 12.7 units long.
test("labeled rail nets use net labels instead of long traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const labeledNets = Object.keys(
    (inputProblem as any).availableNetLabelOrientations,
  )

  const longRailTraces = traces.filter((trace) => {
    if (!labeledNets.includes(trace.userNetId ?? "")) return false
    let length = 0
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      length +=
        Math.abs(trace.tracePath[i + 1]!.x - trace.tracePath[i]!.x) +
        Math.abs(trace.tracePath[i + 1]!.y - trace.tracePath[i]!.y)
    }
    return length > 5
  })

  expect(longRailTraces.map((trace) => trace.mspPairId)).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
