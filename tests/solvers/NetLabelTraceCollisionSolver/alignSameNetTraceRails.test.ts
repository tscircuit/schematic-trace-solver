import { expect, test } from "bun:test"
import { alignSameNetTraceRails } from "lib/solvers/NetLabelTraceCollisionSolver/alignSameNetTraceRails"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 4,
      pins: [
        { pinId: "U1.1", x: -1, y: 1 },
        { pinId: "U1.2", x: -1, y: 0 },
        { pinId: "U1.3", x: -1, y: -1 },
        { pinId: "U1.4", x: 0, y: -2 },
        { pinId: "U1.5", x: 0.5, y: -2 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1", "U1.2", "U1.3", "U1.4", "U1.5"],
    },
  ],
  availableNetLabelOrientations: {},
}

const createTrace = (
  mspPairId: string,
  firstPinId: string,
  secondPinId: string,
  tracePath: Array<{ x: number; y: number }>,
  globalConnNetId = "gnd-net",
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: mspPairId,
    userNetId: "GND",
    pins: [
      inputProblem.chips[0]!.pins.find((pin) => pin.pinId === firstPinId)!,
      inputProblem.chips[0]!.pins.find((pin) => pin.pinId === secondPinId)!,
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [firstPinId, secondPinId],
  }) as SolvedTracePath

test("aligns related same-net detours to one exterior rail", () => {
  const traces = [
    createTrace("gnd-1", "U1.1", "U1.2", [
      { x: -1, y: 1 },
      { x: -1.4, y: 1 },
      { x: -1.4, y: 0.4 },
      { x: -2, y: 0.4 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ]),
    createTrace("gnd-2", "U1.2", "U1.3", [
      { x: -1, y: 0 },
      { x: -1.5, y: 0 },
      { x: -1.5, y: -1 },
      { x: -1, y: -1 },
    ]),
  ]

  const result = alignSameNetTraceRails({
    inputProblem,
    traces,
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(1)
  expect(result.alignedTraceCount).toBe(2)
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    [
      { x: -1, y: 1 },
      { x: -2, y: 1 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ],
    [
      { x: -1, y: 0 },
      { x: -2, y: 0 },
      { x: -2, y: -1 },
      { x: -1, y: -1 },
    ],
  ])
})

test("keeps independent rails when alignment would overlap another net", () => {
  const traces = [
    createTrace("gnd-1", "U1.1", "U1.2", [
      { x: -1, y: 1 },
      { x: -1.8, y: 1 },
      { x: -1.8, y: 0 },
      { x: -1, y: 0 },
    ]),
    createTrace("gnd-2", "U1.2", "U1.3", [
      { x: -1, y: 0 },
      { x: -1.5, y: 0 },
      { x: -1.5, y: -1 },
      { x: -1, y: -1 },
    ]),
    createTrace(
      "signal",
      "U1.1",
      "U1.3",
      [
        { x: -1.8, y: -0.8 },
        { x: -1.8, y: -0.2 },
      ],
      "signal-net",
    ),
  ]

  const result = alignSameNetTraceRails({
    inputProblem,
    traces,
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.alignedTraceCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("preserves earlier side alignment when aligning an orthogonal rail", () => {
  const traces = [
    createTrace("gnd-left", "U1.1", "U1.2", [
      { x: -1, y: 1 },
      { x: -2, y: 1 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ]),
    createTrace("gnd-corner", "U1.2", "U1.4", [
      { x: -1, y: 0 },
      { x: -1.5, y: 0 },
      { x: -1.5, y: -2.5 },
      { x: 0, y: -2.5 },
      { x: 0, y: -2 },
    ]),
    createTrace("gnd-bottom", "U1.4", "U1.5", [
      { x: 0, y: -2 },
      { x: 0, y: -3 },
      { x: 0.5, y: -3 },
      { x: 0.5, y: -2 },
    ]),
  ]

  const result = alignSameNetTraceRails({
    inputProblem,
    traces,
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(2)
  expect(result.alignedTraceCount).toBe(3)
  expect(
    result.traces.find((trace) => trace.mspPairId === "gnd-corner")!.tracePath,
  ).toEqual([
    { x: -1, y: 0 },
    { x: -2, y: 0 },
    { x: -2, y: -3 },
    { x: 0, y: -3 },
    { x: 0, y: -2 },
  ])
})

test("does not align real traces to generated net-label connectors", () => {
  const realTrace = createTrace("gnd-real", "U1.1", "U1.2", [
    { x: -1, y: 1 },
    { x: -1.5, y: 1 },
    { x: -1.5, y: 0 },
    { x: -1, y: 0 },
  ])
  const labelConnector = {
    ...createTrace("gnd-label-connector", "U1.1", "U1.2", [
      { x: -1.5, y: 1 },
      { x: -2.5, y: 1 },
      { x: -2.5, y: 1.5 },
    ]),
    isNetLabelConnector: true,
  }

  const result = alignSameNetTraceRails({
    inputProblem,
    traces: [realTrace, labelConnector],
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.alignedTraceCount).toBe(0)
  expect(result.traces).toEqual([realTrace, labelConnector])
})

test("pipeline keeps a same-chip rail direct when its label needs a connector", () => {
  const pipelineInput: InputProblem = {
    chips: [
      {
        chipId: "U3",
        center: { x: 0, y: 0 },
        width: 2.8,
        height: 1.4,
        pins: [
          { pinId: "U3.3", x: 1.4, y: -0.3 },
          { pinId: "U3.7", x: 1.4, y: -0.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "V3_3",
        pinIds: ["U3.3", "U3.7"],
        netLabelWidth: 0.42,
        netLabelHeight: 0.6,
      },
    ],
    textBoxes: [],
    availableNetLabelOrientations: { V3_3: ["y+"] },
    maxMspPairDistance: 2.4,
  }
  const solver = new SchematicTracePipelineSolver(pipelineInput)

  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const realTrace = traces.find((trace) => trace.mspPairId === "U3.3-U3.7")!
  const labelConnector = traces.find((trace) => trace.isNetLabelConnector)!
  expect(realTrace.tracePath).toEqual([
    { x: 1.4, y: -0.3 },
    { x: 1.5999999999999999, y: -0.3 },
    { x: 1.5999999999999999, y: -0.5 },
    { x: 1.4, y: -0.5 },
  ])
  expect(labelConnector.mspPairId).toBe("available-net-orientation-0-V3_3")
  expect(solver.netLabelTraceCollisionSolver!.stats).toMatchObject({
    alignedRailGroupCount: 0,
    alignedTraceCount: 0,
  })
})
