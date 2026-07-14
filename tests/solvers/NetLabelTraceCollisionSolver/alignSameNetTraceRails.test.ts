import { expect, test } from "bun:test"
import { alignSameNetTraceRails } from "lib/solvers/NetLabelTraceCollisionSolver/alignSameNetTraceRails"
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
