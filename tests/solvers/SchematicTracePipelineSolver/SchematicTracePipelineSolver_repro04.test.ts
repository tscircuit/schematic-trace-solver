import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * Regression test for issue #79:
 * Pins connected only via netConnections (net-label-only) must NOT produce
 * physical trace lines.
 *
 * Root cause: `directConnMap.netMap` was passed by reference to `netConnMap`.
 * `ConnectivityMap.addConnections()` pushes into the existing arrays, so the
 * shared arrays in `directConnMap.netMap` ended up containing net-label pins,
 * causing `queuedDcNetIds` to queue nets that had no direct connections and
 * therefore generating spurious physical traces.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "chip_C",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 0.5,
      pins: [{ pinId: "C.1", x: 0, y: 0.25 }],
    },
    {
      chipId: "chip_D",
      center: { x: 0.5, y: 0 },
      width: 0.5,
      height: 0.5,
      pins: [{ pinId: "D.1", x: 0.5, y: 0.25 }],
    },
  ],
  // No direct connections — only a net label links C.1 and D.1
  directConnections: [],
  netConnections: [{ netId: "VCC", pinIds: ["C.1", "D.1"] }],
  availableNetLabelOrientations: { VCC: ["x-", "x+"] },
  // Chips are only 0.5 apart, well within the pair distance
  maxMspPairDistance: 5,
}

test("net-label-only connections do not produce physical traces (issue #79)", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.schematicTraceLinesSolver!.solvedTracePaths.length).toBe(0)
})
