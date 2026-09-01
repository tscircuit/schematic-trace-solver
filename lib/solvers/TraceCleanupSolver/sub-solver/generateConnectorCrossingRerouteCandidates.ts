import type { Bounds, Point } from "@tscircuit/math-utils"
import { getPathKey } from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "../simplifyPath"

const EPS = 1e-6

type Axis = "x" | "y"
type CandidateKind = "balanced" | "edge"

export interface ConnectorCrossingRerouteCandidate {
  traceId: string
  path: Point[]
  kind: CandidateKind
}

const getSegmentAxes = (start: Point, end: Point) => {
  if (Math.abs(start.x - end.x) <= EPS) {
    return { movingAxis: "y" as const, detourAxis: "x" as const }
  }
  if (Math.abs(start.y - end.y) <= EPS) {
    return { movingAxis: "x" as const, detourAxis: "y" as const }
  }
  return null
}

const getBoundsRange = (bounds: Bounds, axis: Axis) =>
  axis === "x"
    ? { min: bounds.minX, max: bounds.maxX }
    : { min: bounds.minY, max: bounds.maxY }

const getSafeCoordinatesForPoint = ({
  coordinate,
  min,
  max,
  clearance,
}: {
  coordinate: number
  min: number
  max: number
  clearance: number
}) => {
  const minSafe = min - clearance
  const maxSafe = max + clearance
  if (coordinate < minSafe) return [minSafe]
  if (coordinate > maxSafe) return [maxSafe]
  return [minSafe, maxSafe].sort(
    (first, second) =>
      Math.abs(first - coordinate) - Math.abs(second - coordinate),
  )
}

const getDetourCoordinates = ({
  anchorCoordinate,
  min,
  max,
  clearance,
}: {
  anchorCoordinate?: number
  min: number
  max: number
  clearance: number
}): Array<{ coordinate: number; kind: CandidateKind }> => {
  const minSafe = min - clearance
  const maxSafe = max + clearance
  const coordinates: Array<{ coordinate: number; kind: CandidateKind }> = []

  if (anchorCoordinate !== undefined) {
    if (anchorCoordinate < minSafe) {
      coordinates.push({
        coordinate: (anchorCoordinate + minSafe) / 2,
        kind: "balanced",
      })
    } else if (anchorCoordinate > maxSafe) {
      coordinates.push({
        coordinate: (anchorCoordinate + maxSafe) / 2,
        kind: "balanced",
      })
    }
  }

  coordinates.push(
    { coordinate: minSafe, kind: "edge" },
    { coordinate: maxSafe, kind: "edge" },
  )
  return coordinates.filter(
    (candidate, index) =>
      coordinates.findIndex(
        (other) =>
          Math.abs(other.coordinate - candidate.coordinate) <= EPS &&
          other.kind === candidate.kind,
      ) === index,
  )
}

export const getTraceObstacleBounds = ({
  trace,
  segmentIndex,
  labels,
}: {
  trace: SolvedTracePath
  segmentIndex: number
  labels: NetLabelPlacement[]
}): Bounds => {
  const segmentStart = trace.tracePath[segmentIndex]!
  const segmentEnd = trace.tracePath[segmentIndex + 1]!
  const bounds: Bounds = {
    minX: Math.min(segmentStart.x, segmentEnd.x),
    minY: Math.min(segmentStart.y, segmentEnd.y),
    maxX: Math.max(segmentStart.x, segmentEnd.x),
    maxY: Math.max(segmentStart.y, segmentEnd.y),
  }

  for (const label of labels) {
    if (label.globalConnNetId !== trace.globalConnNetId) continue
    if (!label.pinIds.every((pinId) => trace.pinIds.includes(pinId))) continue
    if (!tracePathContainsPoint(trace.tracePath, label.anchorPoint)) continue

    const labelBounds = getRectBounds(label.center, label.width, label.height)
    bounds.minX = Math.min(bounds.minX, labelBounds.minX)
    bounds.minY = Math.min(bounds.minY, labelBounds.minY)
    bounds.maxX = Math.max(bounds.maxX, labelBounds.maxX)
    bounds.maxY = Math.max(bounds.maxY, labelBounds.maxY)
  }

  return bounds
}

/**
 * Reconnects the crossing segment through the open corridor before its next
 * anchor. Forward and reversed variants preserve both endpoint escapes.
 */
const generateAnchorCorridorDetours = ({
  trace,
  segmentIndex,
  obstacleBounds,
  clearance,
}: {
  trace: SolvedTracePath
  segmentIndex: number
  obstacleBounds: Bounds
  clearance: number
}): ConnectorCrossingRerouteCandidate[] => {
  const buildCandidates = (path: Point[], index: number) => {
    const start = path[index]
    const end = path[index + 1]
    const nextAnchor = path[index + 2]
    if (!start || !end || !nextAnchor) return []
    const axes = getSegmentAxes(start, end)
    if (!axes) return []

    const { movingAxis, detourAxis } = axes
    const movingRange = getBoundsRange(obstacleBounds, movingAxis)
    const detourRange = getBoundsRange(obstacleBounds, detourAxis)
    const gates = getSafeCoordinatesForPoint({
      coordinate: start[movingAxis],
      ...movingRange,
      clearance,
    })

    return gates.flatMap((gate) =>
      getDetourCoordinates({
        anchorCoordinate: nextAnchor[detourAxis],
        ...detourRange,
        clearance,
      }).map(({ coordinate, kind }) => ({
        traceId: trace.mspPairId,
        kind,
        path: simplifyPath([
          ...path.slice(0, index + 1),
          { ...start, [movingAxis]: gate },
          {
            ...start,
            [movingAxis]: gate,
            [detourAxis]: coordinate,
          },
          { ...end, [detourAxis]: coordinate },
          ...path.slice(index + 2),
        ]),
      })),
    )
  }

  const forward = buildCandidates(trace.tracePath, segmentIndex)
  const reversedPath = [...trace.tracePath].reverse()
  const reversedIndex = trace.tracePath.length - 2 - segmentIndex
  const reversed = buildCandidates(reversedPath, reversedIndex).map(
    (candidate) => ({ ...candidate, path: candidate.path.reverse() }),
  )
  return [...forward, ...reversed]
}

/** Shifts the complete crossing segment onto a clear parallel channel. */
const generateShiftedSegmentDetours = ({
  trace,
  segmentIndex,
  obstacleBounds,
  clearance,
}: {
  trace: SolvedTracePath
  segmentIndex: number
  obstacleBounds: Bounds
  clearance: number
}): ConnectorCrossingRerouteCandidate[] => {
  const start = trace.tracePath[segmentIndex]
  const end = trace.tracePath[segmentIndex + 1]
  if (!start || !end) return []
  const axes = getSegmentAxes(start, end)
  if (!axes) return []

  const detourRange = getBoundsRange(obstacleBounds, axes.detourAxis)
  return getDetourCoordinates({
    ...detourRange,
    clearance,
  }).map(({ coordinate, kind }) => ({
    traceId: trace.mspPairId,
    kind,
    path: simplifyPath([
      ...trace.tracePath.slice(0, segmentIndex + 1),
      { ...start, [axes.detourAxis]: coordinate },
      { ...end, [axes.detourAxis]: coordinate },
      ...trace.tracePath.slice(segmentIndex + 1),
    ]),
  }))
}

/** Creates a local detour around the full obstacle width on either side. */
const generateLocalSegmentDetours = ({
  trace,
  segmentIndex,
  obstacleBounds,
  clearance,
}: {
  trace: SolvedTracePath
  segmentIndex: number
  obstacleBounds: Bounds
  clearance: number
}): ConnectorCrossingRerouteCandidate[] => {
  const start = trace.tracePath[segmentIndex]
  const end = trace.tracePath[segmentIndex + 1]
  if (!start || !end) return []
  const axes = getSegmentAxes(start, end)
  if (!axes) return []

  const { movingAxis, detourAxis } = axes
  const movingRange = getBoundsRange(obstacleBounds, movingAxis)
  const detourRange = getBoundsRange(obstacleBounds, detourAxis)
  const startGates = getSafeCoordinatesForPoint({
    coordinate: start[movingAxis],
    ...movingRange,
    clearance,
  })
  const endGates = getSafeCoordinatesForPoint({
    coordinate: end[movingAxis],
    ...movingRange,
    clearance,
  })
  return startGates.flatMap((startGate) =>
    endGates.flatMap((endGate) => {
      if (Math.abs(startGate - endGate) <= EPS) return []
      return getDetourCoordinates({
        ...detourRange,
        clearance,
      }).map(({ coordinate, kind }) => ({
        traceId: trace.mspPairId,
        kind,
        path: simplifyPath([
          ...trace.tracePath.slice(0, segmentIndex + 1),
          { ...start, [movingAxis]: startGate },
          {
            ...start,
            [movingAxis]: startGate,
            [detourAxis]: coordinate,
          },
          {
            ...end,
            [movingAxis]: endGate,
            [detourAxis]: coordinate,
          },
          { ...end, [movingAxis]: endGate },
          ...trace.tracePath.slice(segmentIndex + 1),
        ]),
      }))
    }),
  )
}

export const generateConnectorCrossingRerouteCandidates = ({
  trace,
  segmentIndex,
  obstacleBounds,
  clearance,
}: {
  trace: SolvedTracePath
  segmentIndex: number
  obstacleBounds: Bounds
  clearance: number
}) => {
  const candidates = [
    ...generateAnchorCorridorDetours({
      trace,
      segmentIndex,
      obstacleBounds,
      clearance,
    }),
    ...generateShiftedSegmentDetours({
      trace,
      segmentIndex,
      obstacleBounds,
      clearance,
    }),
    ...generateLocalSegmentDetours({
      trace,
      segmentIndex,
      obstacleBounds,
      clearance,
    }),
  ]
  const byPath = new Map<string, ConnectorCrossingRerouteCandidate>()
  for (const candidate of candidates) {
    const pathKey = getPathKey(candidate.path)
    const existing = byPath.get(pathKey)
    if (!existing || candidate.kind === "balanced") {
      byPath.set(pathKey, candidate)
    }
  }
  return [...byPath.values()]
}
