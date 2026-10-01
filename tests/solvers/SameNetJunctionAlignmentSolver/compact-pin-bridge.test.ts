import { expect, test } from "bun:test"
import { alignSameNetJunctions } from "lib/solvers/SameNetJunctionAlignmentSolver/alignSameNetJunctions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const sharedPin: SolvedTracePath["pins"][number] = {
  pinId: "upper",
  chipId: "connector",
  x: 0,
  y: 0,
  _facingDirection: "x+",
}
const lowerPin: SolvedTracePath["pins"][number] = {
  pinId: "lower",
  chipId: "connector",
  x: 0,
  y: -0.2,
  _facingDirection: "x+",
}
const loadPin: SolvedTracePath["pins"][number] = {
  pinId: "load",
  chipId: "load",
  x: 1.2,
  y: -0.05,
  _facingDirection: "x-",
}
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "connector",
      center: { x: -0.5, y: -0.1 },
      width: 1,
      height: 1,
      pins: [sharedPin, lowerPin],
    },
    {
      chipId: "load",
      center: { x: 1.7, y: -0.05 },
      width: 1,
      height: 1,
      pins: [loadPin],
    },
  ],
  directConnections: [
    { pinIds: ["upper", "lower"] },
    { pinIds: ["upper", "load"] },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
}
const traces: SolvedTracePath[] = [
  {
    mspPairId: "outgoing",
    dcConnNetId: "signal",
    globalConnNetId: "signal",
    pins: [sharedPin, loadPin],
    pinIds: ["upper", "load"],
    mspConnectionPairIds: ["outgoing"],
    tracePath: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: -0.05 },
      { x: 1.2, y: -0.05 },
    ],
  },
  {
    mspPairId: "bridge",
    dcConnNetId: "signal",
    globalConnNetId: "signal",
    pins: [lowerPin, sharedPin],
    pinIds: ["lower", "upper"],
    mspConnectionPairIds: ["bridge"],
    tracePath: [
      { x: 0, y: -0.2 },
      { x: 0.2, y: -0.2 },
      { x: 0.2, y: 0 },
      { x: 0, y: 0 },
    ],
  },
]

test("joins an opposing load at the compact same-chip pin bridge", () => {
  const result = alignSameNetJunctions({
    inputProblem,
    traces,
    netLabelPlacements: [],
    netLabelConnectorTraceIds: new Set(),
  })
  expect(result.traces[1]!.tracePath).toEqual(traces[1]!.tracePath)
  expect(result.traces[0]!.tracePath).toEqual([
    { x: 0.2, y: -0.05 },
    { x: 1.2, y: -0.05 },
  ])
})

test("keeps the compact bridge when its trace is visited first", () => {
  const result = alignSameNetJunctions({
    inputProblem,
    traces: [...traces].reverse(),
    netLabelPlacements: [],
    netLabelConnectorTraceIds: new Set(),
  })
  expect(
    result.traces.find((trace) => trace.mspPairId === "bridge")!.tracePath,
  ).toEqual(traces[1]!.tracePath)
  expect(
    result.traces.find((trace) => trace.mspPairId === "outgoing")!.tracePath,
  ).toEqual([
    { x: 0.2, y: -0.05 },
    { x: 1.2, y: -0.05 },
  ])
})

test("retains the routes when a component blocks the shorter bridge connection", () => {
  const result = alignSameNetJunctions({
    inputProblem: {
      ...inputProblem,
      chips: [
        ...inputProblem.chips,
        {
          chipId: "obstacle",
          center: { x: 0.35, y: -0.05 },
          width: 0.05,
          height: 0.02,
          pins: [],
        },
      ],
    },
    traces,
    netLabelPlacements: [],
    netLabelConnectorTraceIds: new Set(),
  })
  expect(result.traces[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.traces[1]!.tracePath).toEqual(traces[1]!.tracePath.slice(0, 3))
})

test("keeps a terminal bridge compact when pins are more than one pitch apart", () => {
  const distantPin = { ...lowerPin, y: -1 }
  const bridge = {
    ...traces[1]!,
    pins: [distantPin, sharedPin] satisfies SolvedTracePath["pins"],
    tracePath: [
      { x: 0, y: -1 },
      { x: 0.2, y: -1 },
      { x: 0.2, y: 0 },
      { x: 0, y: 0 },
    ],
  }
  const result = alignSameNetJunctions({
    inputProblem: {
      ...inputProblem,
      chips: [
        {
          ...inputProblem.chips[0]!,
          center: { x: -0.5, y: -0.5 },
          height: 2,
          pins: [sharedPin, distantPin],
        },
        inputProblem.chips[1]!,
      ],
    },
    traces: [traces[0]!, bridge],
    netLabelPlacements: [],
    netLabelConnectorTraceIds: new Set(),
  })
  expect(result.traces[1]!.tracePath).toEqual(bridge.tracePath)
  expect(result.traces[0]!.tracePath[0]).toEqual({ x: 0.2, y: -0.05 })
})

test("keeps a terminal bridge compact between separate components", () => {
  const separatePin = { ...lowerPin, chipId: "second-connector" }
  const result = alignSameNetJunctions({
    inputProblem: {
      ...inputProblem,
      chips: [
        {
          ...inputProblem.chips[0]!,
          center: { x: -0.5, y: 0 },
          height: 0.1,
          pins: [sharedPin],
        },
        inputProblem.chips[1]!,
        {
          chipId: "second-connector",
          center: { x: -0.5, y: -0.2 },
          width: 1,
          height: 0.1,
          pins: [separatePin],
        },
      ],
    },
    traces: [traces[0]!, { ...traces[1]!, pins: [separatePin, sharedPin] }],
    netLabelPlacements: [],
    netLabelConnectorTraceIds: new Set(),
  })
  expect(result.traces[1]!.tracePath).toEqual(traces[1]!.tracePath)
  expect(result.traces[0]!.tracePath[0]).toEqual({ x: 0.2, y: -0.05 })
})
