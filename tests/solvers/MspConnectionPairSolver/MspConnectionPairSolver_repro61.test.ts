/**
 * Regression test for issue #79:
 * When two components are connected ONLY via netConnections (net labels like
 * VCC / GND), no routed traces should be generated between them.
 * Net labels already represent the electrical connection visually — drawing
 * a wire trace between net-label-only pins produces a spurious extra line.
 */
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Two decoupling capacitors whose pins are connected only via VCC / GND net
// labels.  There are no directConnections at all.
const repro61Input: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: -2, y: 0 },
      width: 0.4,
      height: 0.6,
      pins: [
        { pinId: "C1.1", x: -1.8, y: 0 },
        { pinId: "C1.2", x: -2.2, y: 0 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 2, y: 0 },
      width: 0.4,
      height: 0.6,
      pins: [
        { pinId: "C2.1", x: 1.8, y: 0 },
        { pinId: "C2.2", x: 2.2, y: 0 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VCC", pinIds: ["C1.1", "C2.1"], netLabelWidth: 0.3 },
    { netId: "GND", pinIds: ["C1.2", "C2.2"], netLabelWidth: 0.3 },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
}

test("MspConnectionPairSolver_repro61 - no MSP pairs for net-label-only nets", () => {
  const solver = new MspConnectionPairSolver({ inputProblem: repro61Input })
  solver.solve()

  // Pins connected only via net labels should NOT produce any MSP pairs.
  // Before the fix, pairs were created for VCC and GND, generating spurious traces.
  expect(solver.mspConnectionPairs.length).toBe(0)
})

test("SchematicTracePipelineSolver_repro61 - no traces for net-label-only circuits", () => {
  const solver = new SchematicTracePipelineSolver(repro61Input)
  solver.solve()

  expect(solver.solved).toBe(true)

  // The pipeline should have produced zero MSP pairs and therefore zero traces.
  const pairs = solver.mspConnectionPairSolver!.mspConnectionPairs
  expect(pairs.length).toBe(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
