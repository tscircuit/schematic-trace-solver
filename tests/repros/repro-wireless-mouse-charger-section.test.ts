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
  const chargeStatusTrace = traces.find(
    (trace) => trace.mspPairId === "schematic_port_12-schematic_port_0",
  )!
  const vbatLabelConnector = traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-6-VBAT"),
  )!

  expect(chargeStatusTrace.tracePath).toEqual([
    { x: -28.36, y: 3 },
    { x: -28.16, y: 3 },
    { x: -28.16, y: 0.6709999999999999 },
    { x: -33.26049999999999, y: 0.6709999999999999 },
    { x: -33.26049999999999, y: -0.1 },
    { x: -37.62, y: -0.1 },
  ])
  expect(
    findPerpendicularPathCrossings(
      chargeStatusTrace.tracePath,
      vbatLabelConnector.tracePath,
      { includeTerminalSegments: true },
    ),
  ).toEqual([])
  expect(
    solver.availableNetOrientationSolver!.outputNetLabelPlacements[6]!
      .orientation,
  ).toBe("y+")

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
