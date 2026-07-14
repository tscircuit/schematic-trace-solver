import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignSameNetRails } from "lib/solvers/TraceCleanupSolver/alignSameNetRails"
import type { InputPin, InputProblem } from "lib/types/InputProblem"

const verticalProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 6,
      pins: [
        { pinId: "U1.1", x: -1, y: 2, _facingDirection: "x-" },
        { pinId: "U1.2", x: -1, y: 0, _facingDirection: "x-" },
        { pinId: "U1.3", x: -1, y: -2, _facingDirection: "x-" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [],
  textBoxes: [],
  availableNetLabelOrientations: {},
}

const pin = (pinId: string): InputPin & { chipId: string } => {
  const inputPin = verticalProblem.chips[0]!.pins.find(
    (candidate) => candidate.pinId === pinId,
  )!
  return { ...inputPin, chipId: "U1" }
}

const createTrace = (
  mspPairId: string,
  tracePath: Array<{ x: number; y: number }>,
  pins: SolvedTracePath["pins"],
  globalConnNetId = "power-net",
): SolvedTracePath => ({
  mspPairId,
  globalConnNetId,
  dcConnNetId: mspPairId,
  userNetId: "POWER",
  pins,
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: pins.map((item) => item.pinId),
})

const verticalRailTraces = () => [
  createTrace(
    "upper",
    [
      { x: -1, y: 2 },
      { x: -2, y: 2 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ],
    [pin("U1.1"), pin("U1.2")],
  ),
  createTrace(
    "lower",
    [
      { x: -1, y: 0 },
      { x: -3, y: 0 },
      { x: -3, y: -2 },
      { x: -1, y: -2 },
    ],
    [pin("U1.2"), pin("U1.3")],
  ),
]

const align = (
  traces: SolvedTracePath[],
  options: {
    inputProblem?: InputProblem
    netLabelPlacements?: NetLabelPlacement[]
    eligibleTraceIds?: ReadonlySet<string>
  } = {},
) =>
  alignSameNetRails({
    inputProblem: options.inputProblem ?? verticalProblem,
    traces,
    netLabelPlacements: options.netLabelPlacements ?? [],
    eligibleTraceIds:
      options.eligibleTraceIds ??
      new Set(traces.map((trace) => trace.mspPairId)),
  })

test("aligns same-net rails on one component side", () => {
  const result = align(verticalRailTraces())

  expect(result).toMatchObject({
    alignedRailGroupCount: 1,
    alignedTraceCount: 1,
  })
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    [
      { x: -1, y: 2 },
      { x: -2, y: 2 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ],
    [
      { x: -1, y: 0 },
      { x: -2, y: 0 },
      { x: -2, y: -2 },
      { x: -1, y: -2 },
    ],
  ])
})

test("applies the same component-side rule to horizontal rails", () => {
  const inputProblem: InputProblem = {
    ...verticalProblem,
    chips: [
      {
        chipId: "U2",
        center: { x: 0, y: 0 },
        width: 6,
        height: 2,
        pins: [
          { pinId: "U2.1", x: -2, y: 1, _facingDirection: "y+" },
          { pinId: "U2.2", x: 0, y: 1, _facingDirection: "y+" },
          { pinId: "U2.3", x: 2, y: 1, _facingDirection: "y+" },
        ],
      },
    ],
  }
  const inputPins = inputProblem.chips[0]!.pins.map((inputPin) => ({
    ...inputPin,
    chipId: "U2",
  }))
  const traces = [
    createTrace(
      "left",
      [
        { x: -2, y: 1 },
        { x: -2, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 1 },
      ],
      [inputPins[0]!, inputPins[1]!],
    ),
    createTrace(
      "right",
      [
        { x: 0, y: 1 },
        { x: 0, y: 3 },
        { x: 2, y: 3 },
        { x: 2, y: 1 },
      ],
      [inputPins[1]!, inputPins[2]!],
    ),
  ]

  const result = align(traces, { inputProblem })

  expect(result.alignedRailGroupCount).toBe(1)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 1 },
  ])
})

test("does not combine rails from different component sides", () => {
  const traces = verticalRailTraces()
  traces[1] = {
    ...traces[1]!,
    pins: traces[1]!.pins.map((item) => ({ ...item, chipId: "U2" })) as [
      SolvedTracePath["pins"][0],
      SolvedTracePath["pins"][1],
    ],
  }
  const inputProblem: InputProblem = {
    ...verticalProblem,
    chips: [
      ...verticalProblem.chips,
      {
        ...verticalProblem.chips[0]!,
        chipId: "U2",
        pins: verticalProblem.chips[0]!.pins.map((item) => ({
          ...item,
          pinId: item.pinId.replace("U1", "U2"),
        })),
      },
    ],
  }

  const result = align(traces, { inputProblem })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("does not align through an obstacle", () => {
  const traces = verticalRailTraces()
  const result = align(traces, {
    inputProblem: {
      ...verticalProblem,
      chips: [
        ...verticalProblem.chips,
        {
          chipId: "barrier",
          center: { x: -2.5, y: 0 },
          width: 0.4,
          height: 0.4,
          pins: [],
        },
      ],
    },
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("keeps the baseline when alignment would only lengthen visible geometry", () => {
  const traces = verticalRailTraces()
  traces[1] = createTrace(
    "lower",
    [
      { x: -1, y: 0 },
      { x: -10, y: 0 },
      { x: -10, y: -2 },
      { x: -1, y: -2 },
    ],
    [pin("U1.2"), pin("U1.3")],
  )
  const result = align(traces, {
    inputProblem: {
      ...verticalProblem,
      chips: [
        ...verticalProblem.chips,
        {
          chipId: "blocks-short-candidate",
          center: { x: -2, y: -1 },
          width: 0.2,
          height: 0.4,
          pins: [],
        },
      ],
    },
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("preserves existing label anchors", () => {
  const traces = verticalRailTraces()
  const labels: NetLabelPlacement[] = [
    {
      globalConnNetId: "power-net",
      netId: "POWER",
      mspConnectionPairIds: ["upper"],
      pinIds: ["U1.1", "U1.2"],
      orientation: "x+",
      anchorPoint: { x: -2, y: 1 },
      center: { x: -1.8, y: 1 },
      width: 0.4,
      height: 0.2,
    },
    {
      globalConnNetId: "power-net",
      netId: "POWER",
      mspConnectionPairIds: ["lower"],
      pinIds: ["U1.2", "U1.3"],
      orientation: "x+",
      anchorPoint: { x: -3, y: -1 },
      center: { x: -2.8, y: -1 },
      width: 0.4,
      height: 0.2,
    },
  ]

  const result = align(traces, { netLabelPlacements: labels })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("uses routed-trace provenance to exclude generated label connectors", () => {
  const realTrace = verticalRailTraces()[0]!
  const connector = createTrace(
    "label-connector",
    [
      { x: -1, y: 0 },
      { x: -5, y: 0 },
      { x: -5, y: -2 },
      { x: -1, y: -2 },
    ],
    [pin("U1.2"), pin("U1.3")],
  )

  const result = align([realTrace, connector], {
    eligibleTraceIds: new Set([realTrace.mspPairId]),
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

  const traces = solver.finalTraceCleanupSolver!.getOutput().traces
  const realTrace = traces.find((trace) => trace.mspPairId === "U3.3-U3.7")!
  const labelConnector = traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  expect(realTrace.tracePath).toEqual([
    { x: 1.4, y: -0.3 },
    { x: 1.5999999999999999, y: -0.3 },
    { x: 1.5999999999999999, y: -0.5 },
    { x: 1.4, y: -0.5 },
  ])
  expect(labelConnector.mspPairId).toBe("available-net-orientation-0-V3_3")
  expect(solver.finalTraceCleanupSolver!.stats).toMatchObject({
    alignedRailGroupCount: 0,
    alignedTraceCount: 0,
  })
})
