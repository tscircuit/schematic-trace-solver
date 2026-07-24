import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "../bug-reports/bug-report-20260716-long-trace-670/input.json"

// Reproduction for https://github.com/tscircuit/schematic-trace-solver/issues/670
//
// Rail nets with declared net-label orientations (V3_3 y+, GND y-) should be
// rendered with net labels at distant pins. Instead, LongDistancePairSolver
// connects pins like JP1.2-JP2.2 (10+ units apart, both already labeled) with
// 9-13 unit orthogonal bus traces snaking across the schematic:
//
//   JP1.2-JP2.2  net=V3_3  len=12.7
//   D2.2-JP6.1   net=GND   len=11.3
//   U1.2-JP6.2   net=V3_3  len=9.8
//
// This test pins the CURRENT (buggy) behavior so the bug is tracked by CI.
// A fix should flip the assertion to .toEqual([]).
test("repro #670: labeled rail nets get long bus traces instead of net labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const labeledNets = new Set(
    Object.keys((inputProblem as any).availableNetLabelOrientations),
  )
  // Pins belonging to labeled nets (LongDistancePairSolver doesn't set
  // userNetId on its traces, so membership is derived from netConnections)
  const labeledPinIds = new Set(
    (inputProblem as any).netConnections
      .filter((connection: any) => labeledNets.has(connection.netId))
      .flatMap((connection: any) => connection.pinIds),
  )

  const longRailTraces = traces.filter((trace) => {
    if (!trace.pinIds?.some((pinId) => labeledPinIds.has(pinId))) return false
    let length = 0
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      length +=
        Math.abs(trace.tracePath[i + 1]!.x - trace.tracePath[i]!.x) +
        Math.abs(trace.tracePath[i + 1]!.y - trace.tracePath[i]!.y)
    }
    return length > 5
  })

  // BUG: three long bus traces exist on labeled rails
  expect(longRailTraces.map((trace) => trace.mspPairId).sort()).toEqual([
    "D2.2-JP6.1",
    "JP1.2-JP2.2",
    "U1.2-JP6.2",
  ])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
