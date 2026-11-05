import { expect, test } from "bun:test"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "left",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "a", x: 0.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "right",
      center: { x: 3, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "b", x: 2.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [
    {
      netId: "connection",
      pinIds: ["a", "b"],
      showLabelOnFullyRoutedConnection: false,
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 100,
})

test("fully routed unlabeled connection creates no label obstacle", () => {
  const solver = new SchematicTracePipelineSolver(createInputProblem())
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.netLabelPlacementSolver!.netLabelPlacements).toHaveLength(0)
  expect(
    solver.netLabelToTraceSolver!.getOutput().traces[0]!.tracePath,
  ).toHaveLength(2)
})

test.each([true, undefined])(
  "preserves automatic labels when configured as %s",
  (showLabelOnFullyRoutedConnection) => {
    const inputProblem = createInputProblem()
    inputProblem.directConnections[0]!.showLabelOnFullyRoutedConnection =
      showLabelOnFullyRoutedConnection
    const solver = new SchematicTracePipelineSolver(inputProblem)
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.netLabelPlacementSolver!.netLabelPlacements).toHaveLength(1)
  },
)

test("unrouted endpoints retain labels without configured text or width", () => {
  const solver = new NetLabelPlacementSolver({
    inputProblem: createInputProblem(),
    inputTraceMap: {},
  })
  solver.solve()
  expect(solver.netLabelPlacements).toHaveLength(2)
  expect(
    solver.netLabelPlacements.flatMap((label) => label.pinIds).sort(),
  ).toEqual(["a", "b"])
})

test("a routed island retains its label when another endpoint is disconnected", () => {
  const inputProblem = createInputProblem()
  const pipeline = new SchematicTracePipelineSolver(inputProblem)
  pipeline.solve()
  inputProblem.chips.push({
    chipId: "isolated",
    center: { x: 6, y: 0 },
    width: 1,
    height: 1,
    pins: [{ pinId: "c", x: 5.5, y: 0, _facingDirection: "x-" }],
  })
  inputProblem.directConnections.push({
    netId: "connection",
    pinIds: ["b", "c"],
    showLabelOnFullyRoutedConnection: false,
  })
  const solver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: Object.fromEntries(
      pipeline.schematicTraceLinesSolver!.solvedTracePaths.map((trace) => [
        trace.mspPairId,
        trace,
      ]),
    ),
  })
  solver.solve()
  expect(solver.netLabelPlacements).toHaveLength(2)
  expect(
    solver.netLabelPlacements.map((label) => label.pinIds.length).sort(),
  ).toEqual([1, 2])
})

test("declared nets keep labels even when their direct connections disable them", () => {
  const inputProblem = createInputProblem()
  inputProblem.netConnections.push({
    netId: "connection",
    pinIds: ["a", "b"],
    netLabelWidth: 0.6,
  })
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.netLabelPlacementSolver!.netLabelPlacements).toHaveLength(1)
})
