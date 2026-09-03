import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "Y1",
      center: { x: 0, y: 0 },
      width: 1.08,
      height: 1.42,
      pins: [
        { pinId: "Y1.4", x: 0, y: 0.71, _facingDirection: "y+" },
        { pinId: "Y1.2", x: -0.02, y: -0.71, _facingDirection: "y-" },
        { pinId: "Y1.1", x: -0.54, y: -0.01, _facingDirection: "x-" },
        { pinId: "Y1.3", x: 0.54, y: -0.01, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "C3",
      center: { x: -0.885, y: -1.61 },
      width: 0.92,
      height: 0.76,
      pins: [
        { pinId: "C3.1", x: -1.02, y: -1.23, _facingDirection: "y+" },
        { pinId: "C3.2", x: -1.02, y: -1.99, _facingDirection: "y-" },
      ],
    },
    {
      chipId: "C4",
      center: { x: 1.155, y: -1.61 },
      width: 0.92,
      height: 0.76,
      pins: [
        { pinId: "C4.1", x: 1.02, y: -1.23, _facingDirection: "y+" },
        { pinId: "C4.2", x: 1.02, y: -1.99, _facingDirection: "y-" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      isGround: true,
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: ["Y1.4", "Y1.2", "C3.2", "C4.2"],
    },
    {
      netId: "A1",
      allowInlineNetLabel: true,
      netLabelWidth: 0.36,
      anchoredNetLabelWidth: 0.36,
      inlineNetLabelHeight: 0.12,
      inlineNetLabelWidth: 0.24,
      pinIds: ["Y1.1", "C3.1"],
    },
    {
      netId: "A0",
      allowInlineNetLabel: true,
      netLabelWidth: 0.36,
      anchoredNetLabelWidth: 0.36,
      inlineNetLabelHeight: 0.12,
      inlineNetLabelWidth: 0.24,
      pinIds: ["Y1.3", "C4.1"],
    },
  ],
  textBoxes: [
    { chipId: "Y1", center: { x: 0.52, y: 0.51 }, width: 0.24, height: 0.18 },
    { chipId: "Y1", center: { x: 1.12, y: 0.25 }, width: 1.44, height: 0.18 },
  ],
  availableNetLabelOrientations: {
    A1: ["x-", "x+"],
    GND: ["y-"],
    A0: ["x-", "x+"],
  },
  maxMspPairDistance: 2.4,
}

const countCrossings = (traces: SolvedTracePath[]) => {
  let count = 0
  for (let firstIndex = 0; firstIndex < traces.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < traces.length;
      secondIndex++
    ) {
      const firstTrace = traces[firstIndex]!
      const secondTrace = traces[secondIndex]!
      if (firstTrace.globalConnNetId === secondTrace.globalConnNetId) continue
      count += findPerpendicularPathCrossings(
        firstTrace.tracePath,
        secondTrace.tracePath,
        { includeTerminalSegments: true },
      ).length
    }
  }
  return count
}

test("routes a four-pin crystal without crossing its signal traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  expect(countCrossings(traces)).toBe(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
