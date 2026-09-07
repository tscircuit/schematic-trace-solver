import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import ip from "./assets/repro-same-net-trace-missing-large-distance.input.json"
import "tests/fixtures/matcher"

/**
 * Repro for: Same-net traces not visually merged in schematic (JP6→R1 connection missing)
 * https://github.com/tscircuit/schematic-trace-solver/issues/86
 *
 * Three pins share the same VCC net:
 *   - JP6.2 at x=-3.2 and JP6.3 at x=-3.2 (close together, within maxMspPairDistance=2.4)
 *   - R1.2 at x=2.95 (far away, ~6.15 units from JP6 pins)
 *
 * The MSP solver connects JP6.2↔JP6.3 (short hop). R1.2 is left unconnected.
 * The LongDistancePairSolver finds the R1.2↔JP6.2 candidate pair and solves a
 * valid path, but doesTraceOverlapWithExistingTraces() rejects it because the
 * new trace shares the JP6.2 endpoint with the existing JP6.3↔JP6.2 trace.
 *
 * Expected: solver.longDistancePairSolver!.solvedLongDistanceTraces.length > 0
 *           (R1.2 is connected to the JP6 pins via a long-distance trace)
 * Actual:   solver.longDistancePairSolver!.solvedLongDistanceTraces.length === 0
 *           (R1.2 is visually disconnected — the trace segment is missing)
 */
test("same-net trace segment should connect R1.2 to JP6 even when far apart", () => {
  const solver = new SchematicTracePipelineSolver(ip as any)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
