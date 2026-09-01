import { expect, test } from "bun:test"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { restoreReroutesAroundSupersededLabels } from "lib/solvers/InlineNetLabelSolver/restoreReroutesAroundSupersededLabels"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { CompletedTraceReroute } from "lib/solvers/TraceElbowTransitionSimplificationSolver/types"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
  textBoxes: [],
}

const initialPath = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
]

const reroutedPath = [
  { x: 0, y: 0 },
  { x: 1.8, y: 0 },
  { x: 1.8, y: 0.5 },
  { x: 2.2, y: 0.5 },
  { x: 2.2, y: 0 },
  { x: 4, y: 0 },
]

const initialTrace: SolvedTracePath = {
  mspPairId: "ground-trace",
  dcConnNetId: "ground-global",
  globalConnNetId: "ground-global",
  userNetId: "GND",
  pins: [
    { pinId: "ground-pin-1", chipId: "left", x: 0, y: 0 },
    { pinId: "ground-pin-2", chipId: "right", x: 4, y: 0 },
  ],
  tracePath: initialPath,
  mspConnectionPairIds: ["ground-trace"],
  pinIds: ["ground-pin-1", "ground-pin-2"],
}

const supersededLabel: NetLabelPlacement = {
  globalConnNetId: "label-global",
  dcConnNetId: "label-global",
  netId: "CC2",
  mspConnectionPairIds: ["label-host"],
  pinIds: ["label-pin-1", "label-pin-2"],
  orientation: "y+",
  anchorPoint: { x: 2, y: -0.2 },
  center: { x: 2, y: 0 },
  width: 0.2,
  height: 0.4,
}

const clearInlineLabel: InlineNetLabelPlacement = {
  globalConnNetId: "label-global",
  netId: "CC2",
  mspPairId: "label-host",
  pinIds: ["label-pin-1", "label-pin-2"],
  axis: "x",
  anchorPoint: { x: 2, y: -0.5 },
  center: { x: 2, y: -0.6 },
  width: 0.4,
  height: 0.1,
  side: "y-",
}

const completedReroute: CompletedTraceReroute = {
  initialTrace,
  reroutedTracePath: reroutedPath,
  label: supersededLabel,
  detourCount: 0,
}

const makeReroutedTrace = (tracePath = reroutedPath): SolvedTracePath => ({
  ...initialTrace,
  tracePath,
})

const restore = ({
  traces = [makeReroutedTrace()],
  netLabelPlacements = [],
  inlineNetLabelPlacements = [clearInlineLabel],
}: {
  traces?: SolvedTracePath[]
  netLabelPlacements?: NetLabelPlacement[]
  inlineNetLabelPlacements?: InlineNetLabelPlacement[]
} = {}) =>
  restoreReroutesAroundSupersededLabels({
    inputProblem,
    traces,
    netLabelPlacements,
    inlineNetLabelPlacements,
    completedReroutes: [completedReroute],
  })

test("restores the exact route after its blocking label is superseded", () => {
  const result = restore()

  expect(result.restoredTraceCount).toBe(1)
  expect(result.traces[0]!.tracePath).toEqual(initialPath)
})

test("keeps the detour when inline conversion did not supersede the label", () => {
  const result = restore({ inlineNetLabelPlacements: [] })

  expect(result.restoredTraceCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(reroutedPath)
})

test("keeps the detour when the final inline label occupies the old route", () => {
  const result = restore({
    inlineNetLabelPlacements: [
      {
        ...clearInlineLabel,
        anchorPoint: { x: 2, y: 0 },
        center: { x: 2, y: 0 },
      },
    ],
  })

  expect(result.restoredTraceCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(reroutedPath)
})

test("keeps the detour when another trace crosses the old route", () => {
  const blockingTrace: SolvedTracePath = {
    ...initialTrace,
    mspPairId: "blocking-trace",
    dcConnNetId: "blocking-global",
    globalConnNetId: "blocking-global",
    userNetId: "BLOCKING",
    tracePath: [
      { x: 2, y: -1 },
      { x: 2, y: 1 },
    ],
  }
  const result = restore({ traces: [makeReroutedTrace(), blockingTrace] })

  expect(result.restoredTraceCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(reroutedPath)
})

test("allows an unchanged pre-existing trace crossing", () => {
  const existingCrossing: SolvedTracePath = {
    ...initialTrace,
    mspPairId: "existing-crossing",
    dcConnNetId: "existing-crossing-global",
    globalConnNetId: "existing-crossing-global",
    userNetId: "EXISTING_CROSSING",
    tracePath: [
      { x: 1, y: -1 },
      { x: 1, y: 1 },
    ],
  }
  const result = restore({ traces: [makeReroutedTrace(), existingCrossing] })

  expect(result.restoredTraceCount).toBe(1)
  expect(result.traces[0]!.tracePath).toEqual(initialPath)
})

test("keeps the detour when a retained anchored label occupies the old route", () => {
  const retainedLabel: NetLabelPlacement = {
    ...supersededLabel,
    globalConnNetId: "retained-label-global",
    dcConnNetId: "retained-label-global",
    netId: "RETAINED",
  }
  const result = restore({ netLabelPlacements: [retainedLabel] })

  expect(result.restoredTraceCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(reroutedPath)
})

test("does not overwrite a trace changed after the recorded reroute", () => {
  const changedPath = reroutedPath.map((point) => ({ ...point }))
  changedPath[2]!.y = 0.6
  changedPath[3]!.y = 0.6
  const result = restore({ traces: [makeReroutedTrace(changedPath)] })

  expect(result.restoredTraceCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(changedPath)
})
