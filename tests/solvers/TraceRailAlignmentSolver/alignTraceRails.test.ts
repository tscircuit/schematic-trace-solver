import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignTraceRails } from "lib/solvers/TraceRailAlignmentSolver/alignTraceRails"
import type { InputProblem } from "lib/types/InputProblem"

const emptyProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  textBoxes: [],
  availableNetLabelOrientations: {},
}

const createTrace = (
  mspPairId: string,
  tracePath: Array<{ x: number; y: number }>,
  globalConnNetId = "power-net",
  traceRole: SolvedTracePath["traceRole"] = "routed",
): SolvedTracePath => ({
  mspPairId,
  globalConnNetId,
  dcConnNetId: mspPairId,
  userNetId: "POWER",
  pins: [
    { pinId: `${mspPairId}.start`, chipId: "start", ...tracePath[0]! },
    { pinId: `${mspPairId}.end`, chipId: "end", ...tracePath.at(-1)! },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.start`, `${mspPairId}.end`],
  traceRole,
})

const verticalRailTraces = () => [
  createTrace("upper", [
    { x: 0, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 0 },
    { x: 0, y: 0 },
  ]),
  createTrace("lower", [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: -2 },
    { x: 0, y: -2 },
  ]),
]

test("aligns vertical rails geometrically without component assumptions", () => {
  const result = alignTraceRails({
    inputProblem: emptyProblem,
    traces: verticalRailTraces(),
    netLabelPlacements: [],
  })

  expect(result).toMatchObject({
    alignedRailGroupCount: 1,
    alignedTraceCount: 1,
  })
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
      { x: 0, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: -2 },
      { x: 0, y: -2 },
    ],
  ])
})

test("applies the same alignment rule to horizontal rails", () => {
  const traces = [
    createTrace("left", [
      { x: -2, y: 0 },
      { x: -2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
    ]),
    createTrace("right", [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 2, y: 3 },
      { x: 2, y: 0 },
    ]),
  ]

  const result = alignTraceRails({
    inputProblem: emptyProblem,
    traces,
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(1)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 0 },
  ])
})

test("chooses another existing rail when the shortest candidate overlaps a different net", () => {
  const traces = [
    ...verticalRailTraces(),
    createTrace("bottom", [
      { x: 0, y: -2 },
      { x: 4, y: -2 },
      { x: 4, y: -4 },
      { x: 0, y: -4 },
    ]),
    createTrace(
      "signal",
      [
        { x: 2, y: -1.5 },
        { x: 2, y: -0.5 },
      ],
      "signal-net",
    ),
  ]

  const result = alignTraceRails({
    inputProblem: emptyProblem,
    traces,
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(1)
  expect(result.traces[0]!.tracePath[1]!.x).toBe(3)
  expect(result.traces[1]!.tracePath[1]!.x).toBe(3)
  expect(result.traces[2]!.tracePath[1]!.x).toBe(3)
})

test("does not combine rails whose corridor crosses a component", () => {
  const traces = verticalRailTraces()
  const result = alignTraceRails({
    inputProblem: {
      ...emptyProblem,
      chips: [
        {
          chipId: "barrier",
          center: { x: 2.5, y: 0 },
          width: 0.4,
          height: 0.4,
          pins: [],
        },
      ],
    },
    traces,
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("does not collapse distant parallel routes into an artificial rail", () => {
  const traces = [
    createTrace("upper", [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
      { x: 0, y: 0 },
    ]),
    createTrace("lower", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: -2 },
      { x: 0, y: -2 },
    ]),
  ]

  const result = alignTraceRails({
    inputProblem: emptyProblem,
    traces,
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("preserves existing label anchors instead of moving labels as a side effect", () => {
  const traces = verticalRailTraces()
  const labels: NetLabelPlacement[] = [
    {
      globalConnNetId: "power-net",
      netId: "POWER",
      mspConnectionPairIds: ["upper"],
      pinIds: ["upper.start", "upper.end"],
      orientation: "x+",
      anchorPoint: { x: 2, y: 1 },
      center: { x: 2.2, y: 1 },
      width: 0.4,
      height: 0.2,
    },
    {
      globalConnNetId: "power-net",
      netId: "POWER",
      mspConnectionPairIds: ["lower"],
      pinIds: ["lower.start", "lower.end"],
      orientation: "x+",
      anchorPoint: { x: 3, y: -1 },
      center: { x: 3.2, y: -1 },
      width: 0.4,
      height: 0.2,
    },
  ]

  const result = alignTraceRails({
    inputProblem: emptyProblem,
    traces,
    netLabelPlacements: labels,
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("does not use generated net-label connectors as alignment rails", () => {
  const realTrace = verticalRailTraces()[0]!
  const connector = createTrace(
    "label-connector",
    [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: -2 },
      { x: 0, y: -2 },
    ],
    "power-net",
    "net-label-connector",
  )

  const result = alignTraceRails({
    inputProblem: emptyProblem,
    traces: [realTrace, connector],
    netLabelPlacements: [],
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual([realTrace, connector])
})

test("pipeline does not stretch a real loop toward a generated label connector", () => {
  const inputProblem: InputProblem = {
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
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const traces = solver.traceRailAlignmentSolver!.getOutput().traces
  const realTrace = traces.find((trace) => trace.traceRole === "routed")!
  const labelConnector = traces.find(
    (trace) => trace.traceRole === "net-label-connector",
  )!
  expect(realTrace.tracePath).toEqual([
    { x: 1.4, y: -0.3 },
    { x: 1.5999999999999999, y: -0.3 },
    { x: 1.5999999999999999, y: -0.5 },
    { x: 1.4, y: -0.5 },
  ])
  expect(labelConnector.mspPairId).toBe("available-net-orientation-0-V3_3")
  expect(solver.traceRailAlignmentSolver!.stats).toMatchObject({
    alignedRailGroupCount: 0,
    alignedTraceCount: 0,
  })
})
