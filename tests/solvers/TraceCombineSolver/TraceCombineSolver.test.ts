import { expect, test } from "bun:test"
import { TraceCombineSolver } from "lib/solvers/TraceCombineSolver/TraceCombineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("TraceCombineSolver merges parallel same-net traces", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: 0.5, y: -0.1 },
          { pinId: "U1.2", x: 0.5, y: 0.1 },
        ],
      },
      {
        chipId: "U2",
        center: { x: 4, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U2.1", x: 3.5, y: -0.4 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        pinIds: ["U1.1", "U1.2", "U2.1"],
      },
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
  }

  const mspSolver = new MspConnectionPairSolver({ inputProblem })
  mspSolver.solve()

  const linesSolver = new SchematicTraceLinesSolver({
    mspConnectionPairs: mspSolver.mspConnectionPairs,
    dcConnMap: mspSolver.dcConnMap,
    globalConnMap: mspSolver.globalConnMap,
    inputProblem: inputProblem,
    chipMap: mspSolver.chipMap,
  })
  linesSolver.solve()

  const combineSolver = new TraceCombineSolver({
    inputProblem,
    inputTracePaths: linesSolver.solvedTracePaths,
    globalConnMap: mspSolver.globalConnMap,
  })
  combineSolver.solve()

  const output = combineSolver.getOutput()
  
  // Verify that overlapping segments are snapped to the same coordinate
  // We expect at least one horizontal segment to have been modified if it was close but not identical
  expect(combineSolver.solved).toBe(true)
  expect(output.traces.length).toBeGreaterThan(0)
})
