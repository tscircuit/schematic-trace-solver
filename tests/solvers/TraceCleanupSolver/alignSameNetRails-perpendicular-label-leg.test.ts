import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getComponentSideRailSegments } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getComponentSideRailSegments"
import { getFixedLabelCoordinate } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getFixedLabelCoordinate"
import type { InputProblem } from "lib/types/InputProblem"
import { align, createTrace } from "./fixtures/alignSameNetRails"

const sides = ["left", "right", "top", "bottom"] as const

const createFixture = (side: (typeof sides)[number]) => {
  const vertical = side === "left" || side === "right"
  const sign = side === "left" || side === "bottom" ? 1 : -1
  const point = (x: number, y: number) =>
    vertical ? { x: sign * x, y } : { x: y, y: sign * x }
  const facing = {
    left: "x-",
    right: "x+",
    top: "y+",
    bottom: "y-",
  } as const
  const pins = [
    {
      pinId: "U1.1",
      chipId: "U1",
      ...point(-1, 2),
      _facingDirection: facing[side],
    },
    {
      pinId: "U1.2",
      chipId: "U1",
      ...point(-1, 0),
      _facingDirection: facing[side],
    },
    {
      pinId: "U1.3",
      chipId: "U1",
      ...point(0, -3),
      _facingDirection: vertical ? ("y-" as const) : ("x-" as const),
    },
  ]
  const problem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: point(0, 0),
        width: vertical ? 2 : 6,
        height: vertical ? 6 : 2,
        pins,
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const branch = createTrace(
    "branch",
    [point(-1, 2), point(-2, 2), point(-2, 0), point(-1, 0)],
    [pins[0]!, pins[1]!],
  )
  const backbone = createTrace(
    "backbone",
    [point(0, -3), point(0, -4), point(-3, -4), point(-3, 0), point(-1, 0)],
    [pins[2]!, pins[1]!],
  )
  const label: NetLabelPlacement = {
    globalConnNetId: "power-net",
    netId: "POWER",
    mspConnectionPairIds: ["backbone"],
    pinIds: backbone.pinIds,
    orientation: vertical ? "y-" : "x-",
    anchorPoint: point(0, -4),
    center: point(0, -4.1),
    width: vertical ? 0.4 : 0.2,
    height: vertical ? 0.2 : 0.4,
  }
  return { problem, branch, backbone, label, point }
}

test.each([...sides])(
  "aligns the %s rail to a backbone labeled on its perpendicular leg",
  (side) => {
    const { problem, branch, backbone, label, point } = createFixture(side)
    const result = align([branch, backbone], {
      inputProblem: problem,
      netLabelPlacements: [label],
    })
    expect(result.traces[0]!.tracePath).toEqual([
      point(-1, 2),
      point(-3, 2),
      point(-3, 0),
      point(-1, 0),
    ])
    expect(result.traces[1]).toEqual(backbone)
  },
)

test.each([...sides])(
  "keeps the %s branch clear of an obstacle on the backbone coordinate",
  (side) => {
    const { problem, branch, backbone, label, point } = createFixture(side)
    problem.chips.push({
      chipId: "obstacle",
      center: point(-3, 1),
      width: 0.4,
      height: 0.4,
      pins: [],
    })
    const result = align([branch, backbone], {
      inputProblem: problem,
      netLabelPlacements: [label],
    })
    expect(result.traces).toEqual([branch, backbone])
  },
)

test.each([...sides])(
  "does not fix the %s rail to a label on a terminal pin leg",
  (side) => {
    const { problem, branch, backbone, label, point } = createFixture(side)
    label.anchorPoint = point(-2, 0)
    const chipMap = new Map(problem.chips.map((chip) => [chip.chipId, chip]))
    const branchSegment = getComponentSideRailSegments(branch, chipMap)[0]!
    const group = [branch, backbone]
      .flatMap((trace) => getComponentSideRailSegments(trace, chipMap))
      .filter(
        (segment) =>
          segment.componentFacingDirection ===
          branchSegment.componentFacingDirection,
      )

    expect(getFixedLabelCoordinate(group, [label], [branch, backbone])).toBe(
      null,
    )
  },
)

test.each([...sides])(
  "does not fix the %s rail to a label on a nonadjacent segment",
  (side) => {
    const { problem, branch, backbone, label, point } = createFixture(side)
    label.anchorPoint = point(0, -3.5)
    const chipMap = new Map(problem.chips.map((chip) => [chip.chipId, chip]))
    const branchSegment = getComponentSideRailSegments(branch, chipMap)[0]!
    const group = [branch, backbone]
      .flatMap((trace) => getComponentSideRailSegments(trace, chipMap))
      .filter(
        (segment) =>
          segment.componentFacingDirection ===
          branchSegment.componentFacingDirection,
      )

    expect(getFixedLabelCoordinate(group, [label], [branch, backbone])).toBe(
      null,
    )
  },
)

test.each([...sides])(
  "aligns the %s rail when the labeled backbone is reversed",
  (side) => {
    const { problem, branch, backbone, label, point } = createFixture(side)
    backbone.tracePath.reverse()
    backbone.pins.reverse()
    backbone.pinIds.reverse()
    const result = align([branch, backbone], {
      inputProblem: problem,
      netLabelPlacements: [label],
    })

    expect(result.traces[0]!.tracePath).toEqual([
      point(-1, 2),
      point(-3, 2),
      point(-3, 0),
      point(-1, 0),
    ])
    expect(result.traces[1]).toEqual(backbone)
  },
)

test.each([...sides])(
  "aligns the %s rail when the labeled leg has collinear subdivisions",
  (side) => {
    const { problem, branch, backbone, label, point } = createFixture(side)
    const originalPath = [...backbone.tracePath]
    backbone.tracePath.splice(2, 0, point(-1, -4), point(-2, -4))
    const result = align([branch, backbone], {
      inputProblem: problem,
      netLabelPlacements: [label],
    })

    expect(result.traces[0]!.tracePath).toEqual([
      point(-1, 2),
      point(-3, 2),
      point(-3, 0),
      point(-1, 0),
    ])
    expect(result.traces[1]!.tracePath).toEqual(originalPath)
  },
)
