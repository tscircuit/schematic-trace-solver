import { expect, test } from "bun:test"
import { NET_LABEL_HORIZONTAL_WIDTH } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type {
  InputDirectConnection,
  InputProblem,
} from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inlineConnection = (
  netId: string,
  pinIds: [string, string],
  anchoredNetLabelWidth: number,
  inlineNetLabelWidth: number,
): InputDirectConnection => ({
  netId,
  pinIds,
  allowInlineNetLabel: true,
  anchoredNetLabelWidth,
  inlineNetLabelWidth,
  inlineNetLabelHeight: 0.12,
})

const routedInputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 3.29,
      height: 6.35,
      sectionId: "driver",
      pins: [
        { pinId: "U1.4", x: 2.045, y: 2.6, _facingDirection: "x+" },
        { pinId: "U1.6", x: 2.045, y: 2.4, _facingDirection: "x+" },
        { pinId: "U1.7", x: 2.045, y: 2.2, _facingDirection: "x+" },
        { pinId: "U1.9", x: 2.045, y: 2, _facingDirection: "x+" },
        { pinId: "U1.48", x: 2.045, y: 0.7, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "J4",
      center: { x: 7, y: -0.4 },
      width: 2.05,
      height: 4,
      sectionId: "driver",
      pins: [
        { pinId: "J4.1", x: 5.575, y: 1.4, _facingDirection: "x-" },
        { pinId: "J4.2", x: 5.575, y: 1.2, _facingDirection: "x-" },
        { pinId: "J4.3", x: 5.575, y: 1, _facingDirection: "x-" },
        { pinId: "J4.4", x: 5.575, y: 0.8, _facingDirection: "x-" },
        { pinId: "J4.5", x: 5.575, y: 0.6, _facingDirection: "x-" },
      ],
    },
  ],
  directConnections: [
    inlineConnection("OUT_A_P", ["J4.1", "U1.4"], 0.96, 0.64),
    inlineConnection("OUT_A_N", ["J4.2", "U1.6"], 0.96, 0.64),
    inlineConnection("OUT_B_N", ["J4.3", "U1.7"], 0.96, 0.64),
    inlineConnection("OUT_B_P", ["J4.4", "U1.9"], 0.96, 0.64),
    inlineConnection("SERIAL_IN", ["J4.5", "U1.48"], 1.2, 0.8),
  ],
  netConnections: [],
  textBoxes: [
    {
      chipId: "U1",
      center: { x: 2.405, y: 3.525 },
      width: 1.32,
      height: 0.18,
      text: "TB67S579FTG",
    },
    {
      chipId: "U1",
      center: { x: 1.865, y: 3.29 },
      width: 0.36,
      height: 0.25,
      text: "U1",
    },
    {
      chipId: "J4",
      center: { x: 6.095, y: 1.715 },
      width: 0.36,
      height: 0.25,
      text: "J4",
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 20,
}

test("anchored label width does not split routable inline connections", () => {
  const solver = new SchematicTracePipelineSolver(routedInputProblem)
  const inputWithoutAnchoredWidths = structuredClone(routedInputProblem)
  for (const connection of inputWithoutAnchoredWidths.directConnections) {
    delete connection.anchoredNetLabelWidth
  }
  const solverWithoutAnchoredWidths = new SchematicTracePipelineSolver(
    inputWithoutAnchoredWidths,
  )

  solver.solve()
  solverWithoutAnchoredWidths.solve()

  expect(solver.schematicTraceLinesSolver!.solvedTracePaths).toHaveLength(5)
  expect(solver.schematicTraceLinesSolver!.failedConnectionPairs).toHaveLength(
    0,
  )

  const output = solver.inlineNetLabelSolver!.getOutput()
  expect(output.traces).toHaveLength(5)
  expect(output.inlineNetLabelPlacements).toHaveLength(5)
  expect(
    output.inlineNetLabelPlacements.every(
      (placement) => placement.stubTracePath === undefined,
    ),
  ).toBe(true)
  expect(
    solver.netLabelPlacementSolver!.netLabelPlacements.every(
      (placement) =>
        Math.max(placement.width, placement.height) ===
        NET_LABEL_HORIZONTAL_WIDTH,
    ),
  ).toBe(true)
  expect(
    output.traces.map(({ mspPairId, tracePath }) => ({ mspPairId, tracePath })),
  ).toEqual(
    solverWithoutAnchoredWidths
      .inlineNetLabelSolver!.getOutput()
      .traces.map(({ mspPairId, tracePath }) => ({ mspPairId, tracePath })),
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("anchored label width sizes anchored labels when routing is skipped", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: -3, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U1.1", x: -2.5, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "U2",
        center: { x: 3, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U2.1", x: 2.5, y: 0, _facingDirection: "x-" }],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "SIGNAL",
        pinIds: ["U1.1", "U2.1"],
        allowInlineNetLabel: true,
        anchoredNetLabelWidth: 0.96,
        inlineNetLabelWidth: 0.64,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 1,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const [anchoredPlacement] = solver.netLabelPlacementSolver!.netLabelPlacements
  expect(anchoredPlacement).toBeDefined()
  expect(Math.max(anchoredPlacement!.width, anchoredPlacement!.height)).toBe(
    0.96,
  )
})
