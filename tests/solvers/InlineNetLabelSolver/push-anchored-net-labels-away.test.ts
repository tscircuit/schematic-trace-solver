import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pushAnchoredNetLabelsAwayFromInlineLabels } from "lib/solvers/InlineNetLabelSolver/pushAnchoredNetLabelsAwayFromInlineLabels"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"

test("pushes a regular endpoint label and its wick past nearby inline text", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        // The routing box includes component text, so the real pins can sit
        // inside it. A generated connector may legitimately cross that
        // expanded owner box on its way out from the pin.
        width: 2,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0.2, _facingDirection: "x-" },
          { pinId: "U1.2", x: -0.5, y: 0, _facingDirection: "x-" },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "regular-net",
      netId: "D_PLUS",
      mspConnectionPairIds: [],
      pinIds: ["U1.1"],
      orientation: "x-",
      anchorPoint: { x: -0.7, y: 0.2 },
      center: { x: -1.2, y: 0.2 },
      width: 1,
      height: 0.2,
    },
  ]
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "available-net-orientation-0-D_PLUS",
      dcConnNetId: "regular-net",
      globalConnNetId: "regular-net",
      pins: [] as any,
      tracePath: [
        { x: -0.5, y: 0.2 },
        { x: -0.7, y: 0.2 },
      ],
      mspConnectionPairIds: [],
      pinIds: ["U1.1"],
    },
  ]
  const inlineNetLabelPlacements: InlineNetLabelPlacement[] = [
    {
      globalConnNetId: "inline-net",
      netId: "SWCLK",
      pinIds: ["U1.2"],
      stubTracePath: [
        { x: -0.5, y: 0 },
        { x: -1.7, y: 0 },
      ],
      axis: "x",
      anchorPoint: { x: -1.1, y: 0 },
      center: { x: -1.1, y: 0.11 },
      width: 1.2,
      height: 0.12,
      side: "y+",
    },
  ]

  const output = pushAnchoredNetLabelsAwayFromInlineLabels({
    inputProblem,
    traces,
    netLabelPlacements,
    inlineNetLabelPlacements,
  })

  expect(output.movedLabelCount).toBe(1)
  expect(output.netLabelPlacements[0]!.anchorPoint.x).toBeCloseTo(-1.75)
  expect(output.netLabelPlacements[0]!.center.x).toBeCloseTo(-2.25)
  expect(output.traces[0]!.tracePath[0]).toEqual({ x: -0.5, y: 0.2 })
  expect(output.traces[0]!.tracePath[1]!.x).toBeCloseTo(-1.75)
  expect(output.traces[0]!.tracePath[1]!.y).toBeCloseTo(0.2)
})

test("leaves a label without a movable connector in place", () => {
  const label: NetLabelPlacement = {
    globalConnNetId: "regular-net",
    netId: "D_PLUS",
    mspConnectionPairIds: ["routed-pair"],
    pinIds: ["U1.1", "J1.1"],
    orientation: "x-",
    anchorPoint: { x: -0.7, y: 0.2 },
    center: { x: -1.2, y: 0.2 },
    width: 1,
    height: 0.2,
  }
  const inlineLabel: InlineNetLabelPlacement = {
    globalConnNetId: "inline-net",
    netId: "SWCLK",
    pinIds: ["U1.2"],
    axis: "x",
    anchorPoint: { x: -1.1, y: 0 },
    center: { x: -1.1, y: 0.11 },
    width: 1.2,
    height: 0.12,
    side: "y+",
  }

  const output = pushAnchoredNetLabelsAwayFromInlineLabels({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    traces: [],
    netLabelPlacements: [label],
    inlineNetLabelPlacements: [inlineLabel],
  })

  expect(output.movedLabelCount).toBe(0)
  expect(output.netLabelPlacements[0]).toEqual(label)
})

test("leaves a label in place when its connector would cross another net", () => {
  const label: NetLabelPlacement = {
    globalConnNetId: "label-net",
    netId: "LABEL",
    mspConnectionPairIds: [],
    pinIds: ["U1.label"],
    orientation: "y-",
    anchorPoint: { x: 0, y: 0 },
    center: { x: 0, y: -0.2 },
    width: 0.4,
    height: 0.4,
  }
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "label-route",
      dcConnNetId: "label-net",
      globalConnNetId: "label-net",
      pins: [
        { pinId: "U1.route", chipId: "U1", x: -1, y: 0 },
        { pinId: "U1.label", chipId: "U1", x: 0, y: 0 },
      ],
      tracePath: [
        { x: -1, y: 0 },
        { x: 0, y: 0 },
      ],
      mspConnectionPairIds: ["label-route"],
      pinIds: ["U1.route", "U1.label"],
    },
    {
      mspPairId: "crossing-route",
      dcConnNetId: "crossing-net",
      globalConnNetId: "crossing-net",
      pins: [
        { pinId: "J1.left", chipId: "J1", x: -0.5, y: -0.6 },
        { pinId: "J1.right", chipId: "J1", x: 0.5, y: -0.6 },
      ],
      tracePath: [
        { x: -0.5, y: -0.6 },
        { x: 0.5, y: -0.6 },
      ],
      mspConnectionPairIds: ["crossing-route"],
      pinIds: ["J1.left", "J1.right"],
    },
  ]
  const inlineLabel: InlineNetLabelPlacement = {
    globalConnNetId: "inline-net",
    netId: "INLINE",
    pinIds: ["U1.inline"],
    axis: "x",
    anchorPoint: { x: 0, y: -1 },
    center: { x: 0, y: -1 },
    width: 0.4,
    height: 0.12,
    side: "y+",
  }

  const output = pushAnchoredNetLabelsAwayFromInlineLabels({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    traces,
    netLabelPlacements: [label],
    inlineNetLabelPlacements: [inlineLabel],
  })

  expect(output.movedLabelCount).toBe(0)
  expect(output.netLabelPlacements[0]).toEqual(label)
  expect(output.traces).toEqual(traces)
})

test("moves a contiguous label row together and shoves an anchored obstacle", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0.2 },
        width: 1.4,
        height: 1,
        pins: [
          { pinId: "U1.minus", x: -0.7, y: 0.4, _facingDirection: "x-" },
          { pinId: "U1.plus", x: -0.7, y: 0.2, _facingDirection: "x-" },
          { pinId: "U1.inline", x: -0.7, y: 0, _facingDirection: "x-" },
          { pinId: "U1.gnd1", x: -0.7, y: 0.5, _facingDirection: "x-" },
          { pinId: "U1.gnd2", x: -2.5, y: 0.5, _facingDirection: "x+" },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "minus-net",
      netId: "D_MINUS",
      mspConnectionPairIds: [],
      pinIds: ["U1.minus"],
      orientation: "x-",
      anchorPoint: { x: -0.7, y: 0.4 },
      center: { x: -1.2, y: 0.4 },
      width: 1,
      height: 0.2,
    },
    {
      globalConnNetId: "plus-net",
      netId: "D_PLUS",
      mspConnectionPairIds: [],
      pinIds: ["U1.plus"],
      orientation: "x-",
      anchorPoint: { x: -0.7, y: 0.2 },
      center: { x: -1.2, y: 0.2 },
      width: 1,
      height: 0.2,
    },
    {
      globalConnNetId: "gnd-net",
      netId: "GND",
      mspConnectionPairIds: ["gnd-route"],
      pinIds: ["U1.gnd1", "U1.gnd2"],
      orientation: "y-",
      anchorPoint: { x: -2.5, y: 0.5 },
      center: { x: -2.5, y: 0.3 },
      width: 0.4,
      height: 0.4,
    },
  ]
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "gnd-route",
      dcConnNetId: "gnd-net",
      globalConnNetId: "gnd-net",
      pins: [] as any,
      tracePath: [
        { x: -0.7, y: 0.5 },
        { x: -2.5, y: 0.5 },
      ],
      mspConnectionPairIds: ["gnd-route"],
      pinIds: ["U1.gnd1", "U1.gnd2"],
    },
  ]
  const inlineNetLabelPlacements: InlineNetLabelPlacement[] = [
    {
      globalConnNetId: "inline-net",
      netId: "SWCLK",
      pinIds: ["U1.inline"],
      stubTracePath: [
        { x: -0.7, y: 0 },
        { x: -1.9, y: 0 },
      ],
      axis: "x",
      anchorPoint: { x: -1.3, y: 0 },
      center: { x: -1.1, y: 0.11 },
      width: 1.2,
      height: 0.12,
      side: "y+",
    },
  ]

  const output = pushAnchoredNetLabelsAwayFromInlineLabels({
    inputProblem,
    traces,
    netLabelPlacements,
    inlineNetLabelPlacements,
  })

  expect(output.movedLabelCount).toBe(3)
  expect(output.netLabelPlacements[0]!.anchorPoint.x).toBeCloseTo(-1.75)
  expect(output.netLabelPlacements[1]!.anchorPoint.x).toBeCloseTo(-1.75)
  expect(output.netLabelPlacements[2]!.center.x).toBeLessThan(-2.5)
  expect(
    output.traces.filter((trace) =>
      trace.mspPairId.startsWith("inline-net-label-clearance-"),
    ),
  ).toHaveLength(3)
})
