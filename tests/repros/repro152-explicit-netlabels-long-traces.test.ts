import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2.2,
      height: 0.6,
      pins: [
        { pinId: "U1.1", x: -1.1, y: -0.1 },
        { pinId: "U1.2", x: -1.1, y: 0.1 },
      ],
    },
    {
      chipId: "C1",
      center: { x: 5.1325, y: 0 },
      width: 1.165,
      height: 0.76,
      pins: [
        { pinId: "C1.1", x: 5, y: 0.38, _facingDirection: "y+" },
        { pinId: "C1.2", x: 5, y: -0.38, _facingDirection: "y-" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1", "C1.2"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
    },
    {
      netId: "V3_3",
      pinIds: ["U1.2", "C1.1"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.6,
    },
  ],
  availableNetLabelOrientations: { V3_3: ["y+"], GND: ["y-"] },
  maxMspPairDistance: 2.4,
  preExistingNetLabelPinIds: ["U1.1", "U1.2"],
}

test("repro152: distant net connections terminate at net labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const placements =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements

  expect(traces).toHaveLength(0)
  expect(placements.map((placement) => placement.pinIds[0]).sort()).toEqual([
    "C1.1",
    "C1.2",
  ])
  expect(solver.netLabelPlacementSolver?.failedGroups).toHaveLength(0)
  expect(solver.longDistancePairSolver?.getOutput().newTraces).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("unlabeled endpoints retain clear long-distance traces", () => {
  const unlabeledInput = structuredClone(inputProblem)
  delete unlabeledInput.preExistingNetLabelPinIds
  const solver = new SchematicTracePipelineSolver(unlabeledInput)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.longDistancePairSolver?.getOutput().newTraces).toHaveLength(2)
})
