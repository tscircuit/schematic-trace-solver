import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getSameNetLabelBoundaryDetour } from "lib/solvers/NetLabelTraceCollisionSolver/getSameNetLabelBoundaryDetour"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentOverlapsRectBoundary } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { FacingDirection } from "lib/utils/dir"

const LABEL_WIDTH = 0.6
const LABEL_HEIGHT = 0.4
const BOUNDARY_CLEARANCE = 0.05
const NEAR_SIDE_OFFSET = 0.005
const CLEARANCE_TEST_MARGIN = 0.01
const PIN_CONNECTION_LENGTH = 0.1
const EXIT_CONNECTION_LENGTH = 0.2
const BLOCKING_OBSTACLE = {
  minX: -0.1,
  maxX: 0.1,
  minY: -0.49,
  maxY: -0.41,
}

type BoundarySide = "min_x" | "max_x" | "min_y" | "max_y"

const getBoundarySegment = ({
  label,
  boundarySide,
}: {
  label: NetLabelPlacement
  boundarySide: BoundarySide
}): [Point, Point] => {
  const bounds = getRectBounds(label.center, label.width, label.height)
  switch (boundarySide) {
    case "min_x":
      return [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.minX, y: bounds.maxY },
      ]
    case "max_x":
      return [
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
      ]
    case "min_y":
      return [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
      ]
    case "max_y":
      return [
        { x: bounds.minX, y: bounds.maxY },
        { x: bounds.maxX, y: bounds.maxY },
      ]
  }
}

const getBoundaryTrace = ({
  orientation,
  boundarySide,
}: {
  orientation: FacingDirection
  boundarySide: BoundarySide
}): {
  trace: SolvedTracePath
  label: NetLabelPlacement
} => {
  const anchorPoint = { x: 0, y: 0 }
  const label: NetLabelPlacement = {
    netId: "GND",
    globalConnNetId: "global-gnd",
    mspConnectionPairIds: ["gnd-pair"],
    pinIds: ["pin-a", "pin-b"],
    center: getCenterFromAnchor(
      anchorPoint,
      orientation,
      LABEL_WIDTH,
      LABEL_HEIGHT,
    ),
    anchorPoint,
    orientation,
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
  }
  const tracePath = getBoundarySegment({ label, boundarySide })
  const trace: SolvedTracePath = {
    mspPairId: "gnd-pair",
    dcConnNetId: "dc-gnd",
    globalConnNetId: "global-gnd",
    mspConnectionPairIds: ["gnd-pair"],
    tracePath,
    pins: [
      { pinId: "pin-a", chipId: "chip-a", ...tracePath[0] },
      { pinId: "pin-b", chipId: "chip-b", ...tracePath[1] },
    ],
    pinIds: ["pin-a", "pin-b"],
  }

  return { trace, label }
}

const boundarySides: BoundarySide[] = ["min_x", "max_x", "min_y", "max_y"]
const longSidesByOrientation: Record<FacingDirection, BoundarySide[]> = {
  "x+": ["min_y", "max_y"],
  "x-": ["min_y", "max_y"],
  "y+": ["min_x", "max_x"],
  "y-": ["min_x", "max_x"],
}

const labelOrientations: FacingDirection[] = ["x+", "x-", "y+", "y-"]

const getDetour = ({
  trace,
  label,
  obstacles = [],
  otherTraces = [],
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  obstacles?: (typeof BLOCKING_OBSTACLE)[]
  otherTraces?: SolvedTracePath[]
}) =>
  getSameNetLabelBoundaryDetour({
    trace,
    label,
    clearance: BOUNDARY_CLEARANCE,
    obstacles,
    traces: [trace, ...otherTraces],
  })

test("detours only the two long sides of every label orientation", () => {
  for (const orientation of labelOrientations) {
    for (const boundarySide of boundarySides) {
      const isLongSide =
        longSidesByOrientation[orientation].includes(boundarySide)
      if (!isLongSide) {
        const { trace, label } = getBoundaryTrace({ orientation, boundarySide })
        const detour = getDetour({ trace, label })
        expect(detour).toBeNull()
        continue
      }

      const { trace, label } = getBoundaryTrace({ orientation, boundarySide })
      const detour = getDetour({ trace, label })

      expect(detour).not.toBeNull()
      if (!detour) throw new Error("Expected a boundary detour")

      const labelBounds = getRectBounds(label.center, label.width, label.height)
      const overlapsLabelBoundary = detour.some((point, pointIndex) => {
        const nextPoint = detour[pointIndex + 1]
        if (!nextPoint) return false
        return segmentOverlapsRectBoundary(point, nextPoint, labelBounds)
      })
      expect(overlapsLabelBoundary).toBe(false)
    }
  }
})

test("detours a trace near a long label side", () => {
  const { trace, label } = getBoundaryTrace({
    orientation: "y+",
    boundarySide: "min_x",
  })
  trace.tracePath = trace.tracePath.map((point) => ({
    x: point.x - NEAR_SIDE_OFFSET,
    y: point.y,
  }))

  const detour = getDetour({ trace, label })

  const labelBounds = getRectBounds(label.center, label.width, label.height)
  expect(detour).not.toBeNull()
  if (!detour) throw new Error("Expected a boundary detour")
  expect(detour[1]!.x).toBeCloseTo(labelBounds.minX - BOUNDARY_CLEARANCE)
})

test("does not move a trace beyond the long-side clearance", () => {
  const { trace, label } = getBoundaryTrace({
    orientation: "y+",
    boundarySide: "min_x",
  })
  trace.tracePath = trace.tracePath.map((point) => ({
    x: point.x - BOUNDARY_CLEARANCE - CLEARANCE_TEST_MARGIN,
    y: point.y,
  }))

  const detour = getDetour({ trace, label })

  expect(detour).toBeNull()
})

test("keeps the pin-side connection fixed while moving a long side", () => {
  const { trace, label } = getBoundaryTrace({
    orientation: "y+",
    boundarySide: "min_x",
  })
  const [sideStart, sideEnd] = trace.tracePath
  const pinPoint = {
    x: label.anchorPoint.x + PIN_CONNECTION_LENGTH,
    y: label.anchorPoint.y,
  }
  trace.tracePath = [
    pinPoint,
    label.anchorPoint,
    sideStart!,
    sideEnd!,
    { x: sideEnd!.x - EXIT_CONNECTION_LENGTH, y: sideEnd!.y },
  ]

  const detour = getDetour({ trace, label })!

  expect(detour[0]).toEqual(pinPoint)
  expect(detour[1]).toEqual(label.anchorPoint)
  expect(detour[2]!.y).toBe(label.anchorPoint.y)
  expect(detour).not.toContainEqual(sideStart)
  expect(detour).not.toContainEqual(sideEnd)
})

test("keeps the route when the boundary detour crosses an obstacle", () => {
  const { trace, label } = getBoundaryTrace({
    orientation: "y-",
    boundarySide: "min_y",
  })
  const detour = getDetour({ trace, label, obstacles: [BLOCKING_OBSTACLE] })

  expect(detour).toBeNull()
})

test("keeps the route when the boundary detour crosses another net", () => {
  const { trace, label } = getBoundaryTrace({
    orientation: "y-",
    boundarySide: "min_y",
  })
  const crossingTrace: SolvedTracePath = {
    ...trace,
    mspPairId: "signal-pair",
    dcConnNetId: "dc-signal",
    globalConnNetId: "global-signal",
    mspConnectionPairIds: ["signal-pair"],
    tracePath: [
      { x: 0, y: -0.49 },
      { x: 0, y: -0.41 },
    ],
  }
  const detour = getDetour({ trace, label, otherTraces: [crossingTrace] })

  expect(detour).toBeNull()
})
