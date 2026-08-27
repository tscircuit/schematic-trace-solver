import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE } from "lib/utils/doesPathCoincideWithTraces"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "R11",
      center: { x: 3.445, y: 2.6 },
      width: 1.09,
      height: 0.6,
      pins: [
        { pinId: "R11.1", x: 3.35, y: 2.9, _facingDirection: "y+" },
        { pinId: "R11.2", x: 3.35, y: 2.3, _facingDirection: "y-" },
      ],
    },
    {
      chipId: "U2A",
      center: { x: 4.8, y: 3 },
      width: 1,
      height: 0.78,
      pins: [
        { pinId: "U2A.1", x: 4.3, y: 3.13, _facingDirection: "x-" },
        { pinId: "U2A.2", x: 4.3, y: 2.86, _facingDirection: "x-" },
        { pinId: "U2A.OUT", x: 5.3, y: 2.99, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "C3",
      center: { x: 2.5925, y: 2.56 },
      width: 1.285,
      height: 0.76,
      pins: [
        { pinId: "C3.1", x: 2.4, y: 2.94, _facingDirection: "y+" },
        { pinId: "C3.2", x: 2.4, y: 2.18, _facingDirection: "y-" },
      ],
    },
    {
      chipId: "R12",
      center: { x: 4.8, y: 2.3 },
      width: 0.72,
      height: 0.68,
      pins: [
        { pinId: "R12.1", x: 4.44, y: 2.3, _facingDirection: "x-" },
        { pinId: "R12.2", x: 5.16, y: 2.3, _facingDirection: "x+" },
      ],
    },
  ],
  directConnections: [
    { netId: "R11 feedback", pinIds: ["R11.1", "U2A.1"] },
    { netId: "R11 feedback", pinIds: ["R11.1", "R12.1"] },
    { netId: "alert feedback", pinIds: ["R12.2", "U2A.OUT"] },
  ],
  netConnections: [
    {
      netId: "LTV",
      netLabelWidth: 0.48,
      pinIds: ["C3.1", "U2A.2"],
    },
  ],
  textBoxes: [],
  availableNetLabelOrientations: { LTV: ["x-", "x+"] },
  maxMspPairDistance: 4,
  _hideRatsNet: false,
}

const getParallelCenterlineSeparation = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
) => {
  let closestSeparation = Number.POSITIVE_INFINITY

  for (
    let firstIndex = 0;
    firstIndex < firstTrace.tracePath.length - 1;
    firstIndex++
  ) {
    const firstStart = firstTrace.tracePath[firstIndex]!
    const firstEnd = firstTrace.tracePath[firstIndex + 1]!
    const firstHorizontal = Math.abs(firstStart.y - firstEnd.y) < 1e-6
    if (!firstHorizontal) continue

    for (
      let secondIndex = 0;
      secondIndex < secondTrace.tracePath.length - 1;
      secondIndex++
    ) {
      const secondStart = secondTrace.tracePath[secondIndex]!
      const secondEnd = secondTrace.tracePath[secondIndex + 1]!
      const secondHorizontal = Math.abs(secondStart.y - secondEnd.y) < 1e-6
      if (!secondHorizontal) continue

      const overlap =
        Math.min(
          Math.max(firstStart.x, firstEnd.x),
          Math.max(secondStart.x, secondEnd.x),
        ) -
        Math.max(
          Math.min(firstStart.x, firstEnd.x),
          Math.min(secondStart.x, secondEnd.x),
        )
      if (overlap <= 1e-6) continue

      closestSeparation = Math.min(
        closestSeparation,
        Math.abs(firstStart.y - secondStart.y),
      )
    }
  }

  return closestSeparation
}

test("TIDA-01141 comparator input traces keep visible clearance", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const traces = solver.inlineNetLabelSolver!.getOutput().traces
  const feedbackTrace = traces.find(
    (trace) =>
      trace.mspPairId.includes("R11.1") && trace.mspPairId.includes("U2A.1"),
  )!
  const thresholdTrace = traces.find(
    (trace) =>
      trace.mspPairId.includes("C3.1") && trace.mspPairId.includes("U2A.2"),
  )!

  expect(
    getParallelCenterlineSeparation(feedbackTrace, thresholdTrace),
  ).toBeGreaterThanOrEqual(SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
