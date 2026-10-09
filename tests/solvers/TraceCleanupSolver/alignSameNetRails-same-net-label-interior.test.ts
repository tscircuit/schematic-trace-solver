import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { placeGroundRailLabelsAtOuterEnd } from "lib/solvers/SameNetJunctionAlignmentSolver/placeGroundRailLabelsAtOuterEnd"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import {
  align,
  createTrace,
  getVerticalRailTraces,
  verticalProblem,
} from "./fixtures/alignSameNetRails"

const sides = ["left", "right", "top", "bottom"] as const

const createFixture = (
  side: (typeof sides)[number],
  atOuterEnd: boolean,
  netId = "GND",
) => {
  // Schematic world coordinates: rotate/reflect the left-side fixture to
  // exercise vertical and horizontal rails on all four component sides.
  const vertical = side === "left" || side === "right"
  const sign = side === "left" || side === "bottom" ? 1 : -1
  const point = ({ x, y }: { x: number; y: number }) =>
    vertical ? { x: sign * x, y } : { x: y, y: sign * x }
  const facing = { left: "x-", right: "x+", top: "y+", bottom: "y-" } as const
  const inputProblem = structuredClone(verticalProblem)
  const chip = inputProblem.chips[0]!
  chip.width = vertical ? 2 : 6
  chip.height = vertical ? 6 : 2
  chip.pins = chip.pins.map((pin) => ({
    ...pin,
    ...point(pin),
    _facingDirection: facing[side],
  }))
  inputProblem.netConnections = [
    {
      netId,
      isGround: true,
      pinIds: chip.pins.map((pin) => pin.pinId),
      netLabelWidth: 0.4,
      netLabelHeight: 0.2,
    },
  ]
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const globalConnNetId = netConnMap.getNetConnectedToId(netId)!
  const traces = getVerticalRailTraces()
  for (const trace of traces) {
    trace.globalConnNetId = globalConnNetId
    trace.userNetId = netId
    trace.tracePath = trace.tracePath.map(point)
    for (const pin of trace.pins) {
      Object.assign(pin, point(pin), { _facingDirection: facing[side] })
    }
  }
  const label: NetLabelPlacement = {
    globalConnNetId,
    netId,
    mspConnectionPairIds: ["upper"],
    pinIds: traces[0]!.pinIds,
    orientation: vertical
      ? atOuterEnd
        ? "y+"
        : "y-"
      : atOuterEnd
        ? "x+"
        : "x-",
    anchorPoint: point({ x: -2, y: atOuterEnd ? 2 : 0 }),
    center: point({ x: -2, y: atOuterEnd ? 2.1 : -0.1 }),
    width: vertical ? 0.4 : 0.2,
    height: vertical ? 0.2 : 0.4,
  }
  const blocker: NetLabelPlacement = {
    globalConnNetId: "signal-net",
    netId: "SIGNAL",
    mspConnectionPairIds: [],
    pinIds: [],
    orientation: vertical ? "x+" : "y+",
    anchorPoint: point({ x: -2.3, y: -2.2 }),
    center: point({ x: -2, y: -2.2 }),
    width: vertical ? 0.6 : 0.2,
    height: vertical ? 0.2 : 0.6,
  }
  return { inputProblem, traces, label, blocker, point }
}

test.each([...sides])(
  "does not extend the %s rail through a ground label when the end is blocked",
  (side) => {
    const { inputProblem, traces, label, blocker } = createFixture(side, false)
    const result = align(traces, {
      inputProblem,
      netLabelPlacements: [label, blocker],
    })

    expect(result.traces).toEqual(traces)
    expect(result.alignedRailGroupCount).toBe(0)
    expect(
      result.traces.some((trace) =>
        pathIntersectsRenderedLabel(trace.tracePath, {
          ...label,
          width: label.width - 0.002,
          height: label.height - 0.002,
        }),
      ),
    ).toBe(false)
  },
)

test.each([...sides])(
  "still aligns the %s rail when it only touches the label anchor boundary",
  (side) => {
    const { inputProblem, traces, label, point } = createFixture(side, true)
    const result = align(traces, { inputProblem, netLabelPlacements: [label] })

    expect(result.alignedRailGroupCount).toBe(1)
    expect(result.traces[1]!.tracePath).toEqual(
      [
        { x: -1, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: -2 },
        { x: -1, y: -2 },
      ].map(point),
    )
    expect(result.traces[0]).toEqual(traces[0])
  },
)

test.each(["left", "right"] as const)(
  "allows the %s ground rail to align when its label can move to the clear lower end",
  (side) => {
    const { inputProblem, traces, label, point } = createFixture(side, false)
    const result = align(traces, { inputProblem, netLabelPlacements: [label] })
    expect(result.alignedRailGroupCount).toBe(1)
    expect(result.traces[1]!.tracePath).toEqual(
      [
        { x: -1, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: -2 },
        { x: -1, y: -2 },
      ].map(point),
    )
    const [placedLabel] = placeGroundRailLabelsAtOuterEnd({
      inputProblem,
      traces: result.traces,
      netLabelPlacements: [label],
    })
    expect(placedLabel!.anchorPoint).toEqual(point({ x: -2, y: -2 }))
  },
)

test.each(["AGND", "source_net_7"])(
  "uses isGround metadata when aligning a clear %s rail",
  (netId) => {
    const { inputProblem, traces, label } = createFixture("left", false, netId)
    const result = align(traces, { inputProblem, netLabelPlacements: [label] })
    expect(result.alignedRailGroupCount).toBe(1)
    const [placedLabel] = placeGroundRailLabelsAtOuterEnd({
      inputProblem,
      traces: result.traces,
      netLabelPlacements: [label],
    })
    expect(placedLabel!.anchorPoint).toEqual({ x: -2, y: -2 })
  },
)

for (const labelNetId of ["RETURN", undefined]) {
  for (const blocked of [true, false]) {
    test(`resolves a ground alias with label netId=${labelNetId} and blocked=${blocked}`, () => {
      const { inputProblem, traces, label, blocker } = createFixture(
        "left",
        false,
        "AGND",
      )
      inputProblem.netConnections.push({
        netId: "RETURN",
        pinIds: ["U1.2"],
      })
      const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
      const globalConnNetId = netConnMap.getNetConnectedToId("RETURN")!
      expect(globalConnNetId).toBe(netConnMap.getNetConnectedToId("AGND")!)
      label.netId = labelNetId
      label.globalConnNetId = globalConnNetId
      for (const trace of traces) trace.globalConnNetId = globalConnNetId
      const netLabelPlacements = blocked ? [label, blocker] : [label]
      const before = structuredClone({
        inputProblem,
        traces,
        netLabelPlacements,
      })

      const result = align(traces, { inputProblem, netLabelPlacements })
      expect(result.alignedRailGroupCount).toBe(blocked ? 0 : 1)
      if (blocked) expect(result.traces).toEqual(traces)
      const [placedLabel] = placeGroundRailLabelsAtOuterEnd({
        inputProblem,
        traces: result.traces,
        netLabelPlacements,
      })
      expect(placedLabel!.anchorPoint).toEqual({ x: -2, y: blocked ? 0 : -2 })
      expect({ inputProblem, traces, netLabelPlacements }).toEqual(before)
    })
  }
}

test.each(["unmarked net", "non-ground net", "direct connection"])(
  "does not infer ground from GND declared as %s",
  (declaration) => {
    const { inputProblem, traces, label, blocker } = createFixture(
      "left",
      false,
    )
    delete inputProblem.netConnections[0]!.isGround
    if (declaration === "non-ground net")
      inputProblem.netConnections[0]!.isGround = false
    if (declaration === "direct connection") {
      inputProblem.netConnections = []
      inputProblem.directConnections = traces.map((trace) => ({
        netId: "GND",
        pinIds: [trace.pins[0].pinId, trace.pins[1].pinId],
      }))
    }
    const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
    const globalConnNetId = netConnMap.getNetConnectedToId("GND")!
    label.globalConnNetId = globalConnNetId
    for (const trace of traces) trace.globalConnNetId = globalConnNetId

    const result = align(traces, {
      inputProblem,
      netLabelPlacements: [label, blocker],
    })
    expect(result.alignedRailGroupCount).toBe(1)
    expect(
      placeGroundRailLabelsAtOuterEnd({
        inputProblem,
        traces: result.traces,
        netLabelPlacements: [label],
      }),
    ).toEqual([label])
  },
)

test("does not apply ground handling to an unconnected net with ground display text", () => {
  const { inputProblem, traces, label, blocker } = createFixture(
    "left",
    false,
    "RETURN",
  )
  delete inputProblem.netConnections[0]!.isGround
  const groundChip = structuredClone(inputProblem.chips[0]!)
  groundChip.chipId = "U2"
  groundChip.center.x += 10
  groundChip.pins = groundChip.pins.map((pin, index) => ({
    ...pin,
    pinId: `U2.${index + 1}`,
    x: pin.x + 10,
  }))
  inputProblem.chips.push(groundChip)
  inputProblem.netConnections.push({
    netId: "AGND",
    isGround: true,
    pinIds: groundChip.pins.map((pin) => pin.pinId),
  })
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const globalConnNetId = netConnMap.getNetConnectedToId("RETURN")!
  expect(globalConnNetId).not.toBe(netConnMap.getNetConnectedToId("AGND"))
  label.globalConnNetId = globalConnNetId
  label.netLabelText = "GND"
  for (const trace of traces) trace.globalConnNetId = globalConnNetId

  const result = align(traces, {
    inputProblem,
    netLabelPlacements: [label, blocker],
  })
  expect(result.alignedRailGroupCount).toBe(1)
  expect(
    placeGroundRailLabelsAtOuterEnd({
      inputProblem,
      traces: result.traces,
      netLabelPlacements: [label],
    }),
  ).toEqual([label])
})

test("a separate ground branch in the same column is not a label destination", () => {
  const { inputProblem, traces, label } = createFixture("left", false)
  traces.push(
    createTrace(
      "separate-ground",
      [
        { x: -2, y: -4 },
        { x: -2, y: -6 },
      ],
      [
        { pinId: "X1.1", chipId: "X1", x: -2, y: -4 },
        { pinId: "X2.1", chipId: "X2", x: -2, y: -6 },
      ],
      label.globalConnNetId,
    ),
  )
  const before = structuredClone({ inputProblem, traces, label })
  const [placedLabel] = placeGroundRailLabelsAtOuterEnd({
    inputProblem,
    traces,
    netLabelPlacements: [label],
  })
  expect(placedLabel!.anchorPoint).toEqual(label.anchorPoint)
  expect({ inputProblem, traces, label }).toEqual(before)
})
