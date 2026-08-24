import { expect, test } from "bun:test"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { NetLabelTraceJunctionSolver } from "lib/solvers/NetLabelTraceJunctionSolver/NetLabelTraceJunctionSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeFixture = ({
  targetY = 0,
  targetX = 4.5,
  sourceSectionId,
  targetSectionId,
  blockerTrace,
  blockerLabel,
  blockerInlineLabel,
}: {
  targetY?: number
  targetX?: number
  sourceSectionId?: string
  targetSectionId?: string
  blockerTrace?: SolvedTracePath
  blockerLabel?: NetLabelPlacement
  blockerInlineLabel?: InlineNetLabelPlacement
} = {}) => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "source-chip",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        sectionId: sourceSectionId,
        pins: [{ pinId: "source", x: 0.5, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "source-other-chip",
        center: { x: 1, y: -2 },
        width: 1,
        height: 1,
        sectionId: sourceSectionId,
        pins: [
          {
            pinId: "source-other",
            x: 1,
            y: -1.5,
            _facingDirection: "y+",
          },
        ],
      },
      {
        chipId: "target-chip",
        center: { x: targetX, y: targetY - 1 },
        width: 1,
        height: 1,
        sectionId: targetSectionId,
        pins: [
          {
            pinId: "target",
            x: targetX,
            y: targetY - 0.5,
            _facingDirection: "y+",
          },
        ],
      },
      {
        chipId: "target-other-chip",
        center: { x: targetX + 1.5, y: targetY },
        width: 1,
        height: 1,
        sectionId: targetSectionId,
        pins: [
          {
            pinId: "target-other",
            x: targetX + 1,
            y: targetY,
            _facingDirection: "x-",
          },
        ],
      },
    ],
    directConnections: [
      { pinIds: ["source", "source-other"], netId: "SOURCE_BRANCH" },
      { pinIds: ["target", "target-other"], netId: "TARGET_BRANCH" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const sourceTrace: SolvedTracePath = {
    mspPairId: "source-trace",
    dcConnNetId: "source-direct-net",
    globalConnNetId: "shared-global-net",
    pins: [
      {
        pinId: "source-other",
        x: 1,
        y: -1.5,
        chipId: "source-other-chip",
        _facingDirection: "y+",
      },
      {
        pinId: "source",
        x: 0.5,
        y: 0,
        chipId: "source-chip",
        _facingDirection: "x+",
      },
    ],
    tracePath: [
      { x: 1, y: -1.5 },
      { x: 1, y: 0 },
      { x: 0.5, y: 0 },
    ],
    mspConnectionPairIds: ["source-trace"],
    pinIds: ["source-other", "source"],
  }
  const targetTrace: SolvedTracePath = {
    mspPairId: "target-trace",
    dcConnNetId: "target-direct-net",
    globalConnNetId: "shared-global-net",
    pins: [
      {
        pinId: "target",
        x: targetX,
        y: targetY - 0.5,
        chipId: "target-chip",
        _facingDirection: "y+",
      },
      {
        pinId: "target-other",
        x: targetX + 1,
        y: targetY,
        chipId: "target-other-chip",
        _facingDirection: "x-",
      },
    ],
    tracePath: [
      { x: targetX, y: targetY - 0.5 },
      { x: targetX, y: targetY },
      { x: targetX + 1, y: targetY },
    ],
    mspConnectionPairIds: ["target-trace"],
    pinIds: ["target", "target-other"],
  }
  const sourceLabel: NetLabelPlacement = {
    globalConnNetId: "shared-global-net",
    dcConnNetId: "source-direct-net",
    netId: "SOURCE_BRANCH",
    mspConnectionPairIds: ["source-trace"],
    pinIds: ["source-other", "source"],
    orientation: "x-",
    anchorPoint: { x: 1, y: -1 },
    center: { x: 0.6, y: -1 },
    width: 0.8,
    height: 0.2,
  }
  const targetLabel: NetLabelPlacement = {
    globalConnNetId: "shared-global-net",
    dcConnNetId: "target-direct-net",
    netId: "TARGET_BRANCH",
    mspConnectionPairIds: ["target-trace"],
    pinIds: ["target", "target-other"],
    orientation: "y+",
    anchorPoint: { x: targetX + 0.7, y: targetY },
    center: { x: targetX + 0.7, y: targetY + 0.4 },
    width: 0.2,
    height: 0.8,
  }

  return {
    inputProblem,
    traces: [sourceTrace, targetTrace, ...(blockerTrace ? [blockerTrace] : [])],
    netLabelPlacements: [
      sourceLabel,
      targetLabel,
      ...(blockerLabel ? [blockerLabel] : []),
    ],
    inlineNetLabelPlacements: blockerInlineLabel ? [blockerInlineLabel] : [],
    sourceLabel,
    targetLabel,
  }
}

const makePortOnlySourceFixture = (
  options: Parameters<typeof makeFixture>[0] = {},
) => {
  const fixture = makeFixture({ targetX: 2, ...options })
  const sourceLabel: NetLabelPlacement = {
    ...fixture.sourceLabel,
    mspConnectionPairIds: [],
    pinIds: ["source"],
    orientation: "x+",
    anchorPoint: { x: 0.5, y: 0 },
    center: { x: 0.9, y: 0 },
  }
  return {
    ...fixture,
    traces: fixture.traces.filter(
      (trace) => trace.mspPairId !== "source-trace",
    ),
    netLabelPlacements: fixture.netLabelPlacements.map((label) =>
      label === fixture.sourceLabel ? sourceLabel : label,
    ),
    sourceLabel,
  }
}

test("joins an aligned labeled trace branch to a disconnected same-net trace", () => {
  const fixture = makeFixture()
  const solver = new NetLabelTraceJunctionSolver(fixture)

  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.recoveredTraces).toHaveLength(1)
  expect(solver.recoveredTraces[0]!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 4.5, y: 0 },
  ])
  expect(solver.getOutput().netLabelPlacements).toEqual([fixture.targetLabel])
})

test("does not add reciprocal duplicate junctions", () => {
  const solver = new NetLabelTraceJunctionSolver(makeFixture())

  solver.solve()

  expect(solver.stats.candidateCount).toBeGreaterThan(1)
  expect(solver.recoveredTraces).toHaveLength(1)
})

test("joins a port-only fallback label directly to an existing same-net trace", () => {
  const fixture = makePortOnlySourceFixture()
  const solver = new NetLabelTraceJunctionSolver(fixture)

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(1)
  expect(solver.recoveredTraces[0]!.pinIds[0]).toBe("source")
  expect(solver.recoveredTraces[0]!.tracePath).toEqual([
    { x: 0.5, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(solver.getOutput().netLabelPlacements).toEqual([fixture.targetLabel])
})

test("does not join a port-only label to a trace on another global net", () => {
  const fixture = makePortOnlySourceFixture()
  fixture.traces[0] = {
    ...fixture.traces[0]!,
    globalConnNetId: "different-global-net",
  }
  const solver = new NetLabelTraceJunctionSolver(fixture)

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toContain(fixture.sourceLabel)
})

test("does not join a port-only label across an unrelated trace", () => {
  const blockerTrace: SolvedTracePath = {
    mspPairId: "port-blocker-trace",
    dcConnNetId: "port-blocker-net",
    globalConnNetId: "port-blocker-net",
    pins: [
      { pinId: "port-blocker-a", x: 1.25, y: -1, chipId: "blocker-a" },
      { pinId: "port-blocker-b", x: 1.25, y: 1, chipId: "blocker-b" },
    ],
    tracePath: [
      { x: 1.25, y: -1 },
      { x: 1.25, y: 1 },
    ],
    mspConnectionPairIds: ["port-blocker-trace"],
    pinIds: ["port-blocker-a", "port-blocker-b"],
  }
  const fixture = makePortOnlySourceFixture({ blockerTrace })
  const solver = new NetLabelTraceJunctionSolver(fixture)

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toContain(fixture.sourceLabel)
})

test("keeps a distant port as a label instead of drawing a long junction", () => {
  const fixture = makePortOnlySourceFixture({ targetX: 5 })
  const solver = new NetLabelTraceJunctionSolver(fixture)

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toContain(fixture.sourceLabel)
})

test("rejects a near-aligned branch in another schematic section", () => {
  const solver = new NetLabelTraceJunctionSolver(
    makeFixture({ sourceSectionId: "left", targetSectionId: "right" }),
  )

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
})

test("rejects a branch whose continuation is not closely aligned", () => {
  const solver = new NetLabelTraceJunctionSolver(makeFixture({ targetY: 0.7 }))

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
})

test("rejects a junction that crosses an unrelated trace", () => {
  const blockerTrace: SolvedTracePath = {
    mspPairId: "blocker-trace",
    dcConnNetId: "blocker-net",
    globalConnNetId: "blocker-net",
    pins: [
      { pinId: "blocker-a", x: 2.5, y: -1, chipId: "blocker-a" },
      { pinId: "blocker-b", x: 2.5, y: 1, chipId: "blocker-b" },
    ],
    tracePath: [
      { x: 2.5, y: -1 },
      { x: 2.5, y: 1 },
    ],
    mspConnectionPairIds: ["blocker-trace"],
    pinIds: ["blocker-a", "blocker-b"],
  }
  const fixture = makeFixture({ blockerTrace })
  const solver = new NetLabelTraceJunctionSolver(fixture)

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toContain(fixture.sourceLabel)
})

test("rejects a junction that crosses an unrelated anchored label", () => {
  const blockerLabel: NetLabelPlacement = {
    globalConnNetId: "blocker-net",
    netId: "BLOCKER",
    mspConnectionPairIds: ["blocker-trace"],
    pinIds: ["blocker"],
    orientation: "y+",
    anchorPoint: { x: 2.5, y: 0 },
    center: { x: 2.5, y: 0 },
    width: 0.6,
    height: 0.6,
  }
  const fixture = makeFixture({ blockerLabel })
  const solver = new NetLabelTraceJunctionSolver(fixture)

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
})

test("rejects a junction that crosses an inline label", () => {
  const blockerInlineLabel: InlineNetLabelPlacement = {
    globalConnNetId: "blocker-net",
    netId: "INLINE_BLOCKER",
    pinIds: ["blocker"],
    axis: "x",
    anchorPoint: { x: 2.5, y: 0 },
    center: { x: 2.5, y: 0 },
    width: 0.6,
    height: 0.6,
    side: "y+",
  }
  const solver = new NetLabelTraceJunctionSolver(
    makeFixture({ blockerInlineLabel }),
  )

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
})
