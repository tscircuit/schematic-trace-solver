import { expect, test } from "bun:test"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { NetLabelToTraceSolver } from "lib/solvers/NetLabelToTraceSolver/NetLabelToTraceSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputChip, InputProblem } from "lib/types/InputProblem"

const makeChip = ({
  chipId,
  pinId,
  center,
  pin,
  facingDirection,
  sectionId,
}: {
  chipId: string
  pinId: string
  center: { x: number; y: number }
  pin: { x: number; y: number }
  facingDirection: "x+" | "x-" | "y+" | "y-"
  sectionId?: string
}): InputChip => ({
  chipId,
  center,
  width: 1,
  height: 1,
  sectionId,
  pins: [{ pinId, ...pin, _facingDirection: facingDirection }],
})

const makeProblem = ({
  leftSectionId,
  rightSectionId,
  rightPin = { x: 4.5, y: 0, facingDirection: "x-" as const },
  includeThird = false,
}: {
  leftSectionId?: string
  rightSectionId?: string
  rightPin?: {
    x: number
    y: number
    facingDirection: "x+" | "x-" | "y+" | "y-"
  }
  includeThird?: boolean
} = {}): InputProblem => {
  const chips = [
    makeChip({
      chipId: "left-chip",
      pinId: "left",
      center: { x: 0, y: 0 },
      pin: { x: 0.5, y: 0 },
      facingDirection: "x+",
      sectionId: leftSectionId,
    }),
    makeChip({
      chipId: "right-chip",
      pinId: "right",
      center: { x: rightPin.x === 5.5 ? 5 : 5, y: rightPin.y },
      pin: { x: rightPin.x, y: rightPin.y },
      facingDirection: rightPin.facingDirection,
      sectionId: rightSectionId,
    }),
    makeChip({
      chipId: "hub-chip",
      pinId: "hub",
      center: { x: 2.5, y: 3 },
      pin: { x: 2.5, y: 2.5 },
      facingDirection: "y-",
      sectionId: leftSectionId,
    }),
  ]
  if (includeThird) {
    chips.push(
      makeChip({
        chipId: "third-chip",
        pinId: "third",
        center: { x: 9, y: 0 },
        pin: { x: 8.5, y: 0 },
        facingDirection: "x-",
        sectionId: rightSectionId,
      }),
    )
  }

  return {
    chips,
    directConnections: [
      { pinIds: ["hub", "left"], netId: "LEFT_BRANCH" },
      { pinIds: ["hub", "right"], netId: "RIGHT_BRANCH" },
      ...(includeThird
        ? [
            {
              pinIds: ["hub", "third"] as [string, string],
              netId: "THIRD_BRANCH",
            },
          ]
        : []),
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
}

const makePortOnlyLabel = ({
  pinId,
  netId,
  globalConnNetId = "shared-global",
  anchorPoint,
  orientation,
}: {
  pinId: string
  netId: string
  globalConnNetId?: string
  anchorPoint: { x: number; y: number }
  orientation: "x+" | "x-" | "y+" | "y-"
}): NetLabelPlacement => {
  const isHorizontal = orientation === "x+" || orientation === "x-"
  const width = isHorizontal ? 0.8 : 0.2
  const height = isHorizontal ? 0.2 : 0.8
  const offset =
    orientation === "x+"
      ? { x: width / 2, y: 0 }
      : orientation === "x-"
        ? { x: -width / 2, y: 0 }
        : orientation === "y+"
          ? { x: 0, y: height / 2 }
          : { x: 0, y: -height / 2 }
  return {
    globalConnNetId,
    netId,
    mspConnectionPairIds: [],
    pinIds: [pinId],
    orientation,
    anchorPoint,
    width,
    height,
    center: {
      x: anchorPoint.x + offset.x,
      y: anchorPoint.y + offset.y,
    },
  }
}

const leftLabel = makePortOnlyLabel({
  pinId: "left",
  netId: "LEFT_BRANCH",
  anchorPoint: { x: 0.5, y: 0 },
  orientation: "x+",
})
const rightLabel = makePortOnlyLabel({
  pinId: "right",
  netId: "RIGHT_BRANCH",
  anchorPoint: { x: 4.5, y: 0 },
  orientation: "x-",
})

test("does not infer a trace between labels from different global nets", () => {
  const solver = new NetLabelToTraceSolver({
    inputProblem: makeProblem(),
    traces: [],
    netLabelPlacements: [
      { ...leftLabel, globalConnNetId: "left-global" },
      { ...rightLabel, globalConnNetId: "right-global" },
    ],
    inlineNetLabelPlacements: [],
  })

  solver.solve()

  expect(solver.stats.candidateCount).toBe(0)
  expect(solver.recoveredTraces).toHaveLength(0)
})

test("does not recover a geometrically clear path across schematic sections", () => {
  const solver = new NetLabelToTraceSolver({
    inputProblem: makeProblem({
      leftSectionId: "left-section",
      rightSectionId: "right-section",
    }),
    traces: [],
    netLabelPlacements: [leftLabel, rightLabel],
    inlineNetLabelPlacements: [],
  })

  solver.solve()

  expect(solver.stats.candidateCount).toBe(0)
  expect(solver.recoveredTraces).toHaveLength(0)
})

test("rejects a recovered route that would cross an unrelated anchored label", () => {
  const blockingLabel: NetLabelPlacement = {
    globalConnNetId: "blocking-global",
    netId: "BLOCKER",
    mspConnectionPairIds: ["blocking-trace"],
    pinIds: ["hub"],
    orientation: "x+",
    anchorPoint: { x: 2, y: 0 },
    center: { x: 2.5, y: 0 },
    width: 1,
    height: 0.4,
  }
  const solver = new NetLabelToTraceSolver({
    inputProblem: makeProblem(),
    traces: [],
    netLabelPlacements: [leftLabel, rightLabel, blockingLabel],
    inlineNetLabelPlacements: [],
  })

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toEqual([
    leftLabel,
    rightLabel,
    blockingLabel,
  ])
})

test("rejects a recovered route that would cross an inline label", () => {
  const blockingInlineLabel: InlineNetLabelPlacement = {
    globalConnNetId: "blocking-global",
    netId: "INLINE_BLOCKER",
    pinIds: ["hub"],
    axis: "x",
    anchorPoint: { x: 2.5, y: 0 },
    center: { x: 2.5, y: 0 },
    width: 1,
    height: 0.4,
    side: "y+",
  }
  const solver = new NetLabelToTraceSolver({
    inputProblem: makeProblem(),
    traces: [],
    netLabelPlacements: [leftLabel, rightLabel],
    inlineNetLabelPlacements: [blockingInlineLabel],
  })

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(0)
  expect(solver.getOutput().inlineNetLabelPlacements).toEqual([
    blockingInlineLabel,
  ])
})

test("accepts a clear route when both endpoint pins face the same direction", () => {
  const sameFacingRightLabel = makePortOnlyLabel({
    pinId: "right",
    netId: "RIGHT_BRANCH",
    anchorPoint: { x: 5.5, y: 0 },
    orientation: "x+",
  })
  const solver = new NetLabelToTraceSolver({
    inputProblem: makeProblem({
      rightPin: { x: 5.5, y: 0, facingDirection: "x+" },
    }),
    traces: [],
    netLabelPlacements: [leftLabel, sameFacingRightLabel],
    inlineNetLabelPlacements: [],
  })

  solver.solve()

  expect(solver.recoveredTraces).toHaveLength(1)
  expect(solver.recoveredTraces[0]!.tracePath.length).toBeGreaterThan(2)
})

test("candidate ordering is deterministic and never reuses an endpoint", () => {
  const thirdLabel = makePortOnlyLabel({
    pinId: "third",
    netId: "THIRD_BRANCH",
    anchorPoint: { x: 8.5, y: 0 },
    orientation: "x-",
  })
  const permutations = [
    [leftLabel, rightLabel, thirdLabel],
    [leftLabel, thirdLabel, rightLabel],
    [rightLabel, leftLabel, thirdLabel],
    [rightLabel, thirdLabel, leftLabel],
    [thirdLabel, leftLabel, rightLabel],
    [thirdLabel, rightLabel, leftLabel],
  ]

  for (const labels of permutations) {
    const solver = new NetLabelToTraceSolver({
      inputProblem: makeProblem({ includeThird: true }),
      traces: [],
      netLabelPlacements: labels,
      inlineNetLabelPlacements: [],
    })
    solver.solve()

    expect(solver.recoveredTraces).toHaveLength(1)
    expect(solver.recoveredTraces[0]!.pinIds.slice().sort()).toEqual([
      "left",
      "right",
    ])
    expect(
      solver
        .getOutput()
        .netLabelPlacements.map((label) => label.pinIds[0])
        .sort(),
    ).toEqual(["third"])
  }
})
