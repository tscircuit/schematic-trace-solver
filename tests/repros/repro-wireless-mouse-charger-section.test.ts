import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import inputProblem from "./assets/repro-wireless-mouse-charger-section.input.json"
import "tests/fixtures/matcher"

// Generated from @tscircuit/core 0.0.1817 at commit 45888ed648781adfd34e7078c4d4b336133cbbe9.
// The circuit reproduces the wireless mouse's MCP73831 charger, charge LED
// loop, programming resistor, VBAT capacitor, and protected battery connector.
// The fixture is the solverParams payload emitted by core's solver:started event.
test("repro wireless mouse charger section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    for (
      let otherTraceIndex = traceIndex + 1;
      otherTraceIndex < traces.length;
      otherTraceIndex++
    ) {
      const otherTrace = traces[otherTraceIndex]!
      if (trace.globalConnNetId === otherTrace.globalConnNetId) continue

      expect(
        findPerpendicularPathCrossings(trace.tracePath, otherTrace.tracePath, {
          includeTerminalSegments: true,
        }),
      ).toEqual([])
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
