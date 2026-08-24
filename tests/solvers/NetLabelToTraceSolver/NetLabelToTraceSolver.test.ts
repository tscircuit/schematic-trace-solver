import { expect, test } from "bun:test"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { NetLabelToTraceSolver } from "lib/solvers/NetLabelToTraceSolver/NetLabelToTraceSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "left-chip",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "left", x: 0.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "right-chip",
      center: { x: 5, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "right", x: 4.5, y: 0, _facingDirection: "x-" }],
    },
    {
      chipId: "hub-chip",
      center: { x: 2.5, y: 3 },
      width: 1,
      height: 1,
      pins: [{ pinId: "hub", x: 2.5, y: 2.5, _facingDirection: "y-" }],
    },
  ],
  directConnections: [
    { pinIds: ["hub", "left"], netId: "LEFT_BRANCH" },
    { pinIds: ["hub", "right"], netId: "RIGHT_BRANCH" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makePortOnlyLabel = (
  pinId: string,
  netId: string,
  anchorPoint: { x: number; y: number },
  orientation: "x+" | "x-",
): NetLabelPlacement => ({
  globalConnNetId: "signal-global",
  netId,
  mspConnectionPairIds: [],
  pinIds: [pinId],
  orientation,
  anchorPoint,
  width: 0.8,
  height: 0.2,
  center: {
    x: anchorPoint.x + (orientation === "x+" ? 0.4 : -0.4),
    y: anchorPoint.y,
  },
})

const leftLabel = makePortOnlyLabel(
  "left",
  "LEFT_BRANCH",
  { x: 0.5, y: 0 },
  "x+",
)
const rightLabel = makePortOnlyLabel(
  "right",
  "RIGHT_BRANCH",
  { x: 4.5, y: 0 },
  "x-",
)

test("replaces a clear facing pair of port-only labels with a trace", () => {
  const solver = new NetLabelToTraceSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: [leftLabel, rightLabel],
    inlineNetLabelPlacements: [],
  })

  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.recoveredTraces).toHaveLength(1)
  expect(solver.recoveredTraces[0]!.pinIds.slice().sort()).toEqual([
    "left",
    "right",
  ])
  expect(solver.getOutput().netLabelPlacements).toHaveLength(0)
})

test("replaces non-facing port-only labels when the router finds a clear path", () => {
  const nonFacingInput: InputProblem = {
    ...inputProblem,
    chips: inputProblem.chips.map((chip) =>
      chip.chipId === "right-chip"
        ? {
            ...chip,
            center: { x: 4.5, y: 1 },
            pins: [
              {
                pinId: "right",
                x: 4.5,
                y: 0.5,
                _facingDirection: "y-" as const,
              },
            ],
          }
        : chip,
    ),
  }
  const nonFacingRightLabel: NetLabelPlacement = {
    ...rightLabel,
    orientation: "y-",
    anchorPoint: { x: 4.5, y: 0.5 },
    center: { x: 4.5, y: 0.1 },
  }
  const solver = new NetLabelToTraceSolver({
    inputProblem: nonFacingInput,
    traces: [],
    netLabelPlacements: [leftLabel, nonFacingRightLabel],
    inlineNetLabelPlacements: [],
  })

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(1)
  expect(solver.recoveredTraces[0]!.tracePath.length).toBeGreaterThan(2)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(0)
})

test("keeps labels when the recovered route would cross an existing trace", () => {
  const blockerPins = [
    {
      pinId: "blocker-a",
      x: 2.5,
      y: -1,
      chipId: "blocker-chip-a",
      _facingDirection: "y+" as const,
    },
    {
      pinId: "blocker-b",
      x: 2.5,
      y: 1,
      chipId: "blocker-chip-b",
      _facingDirection: "y-" as const,
    },
  ] as const
  const blockerTrace: SolvedTracePath = {
    mspPairId: "blocker",
    dcConnNetId: "blocker-net",
    globalConnNetId: "blocker-net",
    pins: [blockerPins[0], blockerPins[1]],
    tracePath: [blockerPins[0], blockerPins[1]],
    mspConnectionPairIds: ["blocker"],
    pinIds: ["blocker-a", "blocker-b"],
  }

  const solver = new NetLabelToTraceSolver({
    inputProblem,
    traces: [blockerTrace],
    netLabelPlacements: [leftLabel, rightLabel],
    inlineNetLabelPlacements: [],
  })

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().traces).toEqual([blockerTrace])
  expect(solver.getOutput().netLabelPlacements).toEqual([leftLabel, rightLabel])
})

test("preserves intentional, anchored, ground, and inline labels", () => {
  const anchoredLabel: NetLabelPlacement = {
    ...leftLabel,
    mspConnectionPairIds: ["existing-trace"],
  }
  const groundLabels = [
    { ...leftLabel, netId: "GND" },
    { ...rightLabel, netId: "GND" },
  ]
  const intentionalLabels = [
    {
      ...leftLabel,
      globalConnNetId: "intentional-global",
      netId: "INTENTIONAL",
    },
    {
      ...rightLabel,
      globalConnNetId: "intentional-global",
      netId: "INTENTIONAL",
    },
  ]
  const inlineLabel: InlineNetLabelPlacement = {
    globalConnNetId: "signal-global",
    netId: "INLINE",
    pinIds: ["left"],
    axis: "x",
    anchorPoint: { x: 2, y: 1 },
    center: { x: 2, y: 1.2 },
    width: 0.8,
    height: 0.2,
    side: "y+",
  }

  const solver = new NetLabelToTraceSolver({
    inputProblem: {
      ...inputProblem,
      directConnections: [
        { pinIds: ["hub", "left"], netId: "GND" },
        { pinIds: ["hub", "right"], netId: "GND" },
      ],
      netConnections: [{ pinIds: ["left", "right"], netId: "INTENTIONAL" }],
    },
    traces: [],
    netLabelPlacements: [anchoredLabel, ...groundLabels, ...intentionalLabels],
    inlineNetLabelPlacements: [inlineLabel],
  })

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toEqual([
    anchoredLabel,
    ...groundLabels,
    ...intentionalLabels,
  ])
  expect(solver.getOutput().inlineNetLabelPlacements).toEqual([inlineLabel])
})
