import {
  getMaxSearchDistance,
  rectsOverlap,
  tracePathIntersectsBounds,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathOverlapTraceStrokes } from "lib/utils/doesPathCoincideWithTraces"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import { EPS, getDistance, tracePathContainsPoint } from "./geometry"

const CLEARANCE = 0.1

export const getTerminalPortConnector = (
  label: NetLabelPlacement,
  traces: SolvedTracePath[],
  connectorIds: ReadonlySet<string>,
) =>
  traces.find((trace) => {
    if (
      label.pinIds.length !== 1 ||
      trace.pinIds.length !== 1 ||
      trace.pinIds[0] !== label.pinIds[0] ||
      trace.globalConnNetId !== label.globalConnNetId ||
      !connectorIds.has(trace.mspPairId)
    )
      return false
    const path = simplifyPath(trace.tracePath)
    const vertical = label.orientation === "y+" || label.orientation === "y-"
    const axis = vertical ? "x" : "y"
    const along = vertical ? "y" : "x"
    const sign = label.orientation.endsWith("+") ? 1 : -1
    return (
      path.length === 3 &&
      getDistance(path[0]!, trace.pins[0]) < EPS &&
      getDistance(path.at(-1)!, label.anchorPoint) < EPS &&
      Math.abs(path[0]![along] - path[1]![along]) < EPS &&
      Math.abs(path[1]![axis] - path[2]![axis]) < EPS &&
      (path[2]![along] - path[1]![along]) * sign > EPS
    )
  })

/**
 * Move a crossed terminal label past the blocking rail. Lower neighboring
 * labels may have to yield space to its connector. Commit the group only if
 * all label bounds, connections, junctions, and crossings remain valid.
 */
export const moveCrossedPortLabelsOutward = (params: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
  labelIndex: number
}) => {
  const {
    inputProblem,
    traces,
    netLabelPlacements,
    netLabelConnectorTraceIds,
    labelIndex,
  } = params
  const seed = netLabelPlacements[labelIndex]!
  const seedConnector = getTerminalPortConnector(
    seed,
    traces,
    netLabelConnectorTraceIds,
  )
  if (!seedConnector) return null
  const verticalLabel = seed.orientation === "y+" || seed.orientation === "y-"
  const axis = verticalLabel ? "x" : "y"
  const along = verticalLabel ? "y" : "x"
  const direction = Math.sign(
    seed.anchorPoint[axis] - seedConnector.tracePath[0]![axis],
  )
  if (!direction) return null
  const extent = (label: NetLabelPlacement) =>
    (verticalLabel ? label.width : label.height) / 2
  const outwardEdge = (bounds: ReturnType<typeof getRectBounds>) =>
    axis === "x"
      ? direction < 0
        ? bounds.minX
        : bounds.maxX
      : direction < 0
        ? bounds.minY
        : bounds.maxY
  const boundsFor = (label: NetLabelPlacement) =>
    getRectBounds(label.center, label.width, label.height)
  const outputTraces = [...traces]
  const outputLabels = [...netLabelPlacements]
  const moved = new Set<number>()
  const pins = inputProblem.chips.flatMap((chip) => chip.pins)
  const obstacles = getObstacleRects(inputProblem)
  const maxDistance = getMaxSearchDistance(inputProblem)
  const maxAttempts =
    obstacles.length +
    traces.reduce((sum, trace) => sum + trace.tracePath.length - 1, 0)

  const moveLabel = (index: number, coordinate: number): boolean => {
    // A dependency cycle cannot be resolved by pushing this bank outward.
    if (moved.has(index)) return false
    const original = netLabelPlacements[index]!
    const connector = getTerminalPortConnector(
      original,
      traces,
      netLabelConnectorTraceIds,
    )
    if (
      !connector ||
      original.orientation !== seed.orientation ||
      connector.pins[0].chipId !== seedConnector.pins[0].chipId ||
      Math.sign(original.anchorPoint[axis] - connector.tracePath[0]![axis]) !==
        direction
    )
      return false
    if (
      (coordinate - original.anchorPoint[axis]) * direction <= EPS ||
      Math.abs(coordinate - original.anchorPoint[axis]) > maxDistance
    )
      return false
    moved.add(index)

    let label = original
    let path = connector.tracePath
    // Each iteration moves beyond a blocking trace or static obstacle boundary.
    // Coordinates only move outward, so a finite obstacle set bounds the search.
    for (let attempts = 0; attempts <= maxAttempts; attempts++) {
      const anchorPoint = { ...original.anchorPoint, [axis]: coordinate }
      label = {
        ...original,
        anchorPoint,
        center: getCenterFromAnchor(
          anchorPoint,
          original.orientation,
          original.width,
          original.height,
        ),
      }
      const start = connector.tracePath[0]!
      path = simplifyPath([
        start,
        { ...start, [axis]: coordinate },
        anchorPoint,
      ])
      const bounds = boundsFor(label)
      const blockingBounds: ReturnType<typeof getRectBounds>[] =
        obstacles.filter((obstacle) => rectsOverlap(bounds, obstacle))
      for (const trace of outputTraces) {
        if (trace.mspPairId === connector.mspPairId) continue
        for (let i = 1; i < trace.tracePath.length; i++) {
          const a = trace.tracePath[i - 1]!,
            b = trace.tracePath[i]!
          if (segmentIntersectsRect(a, b, bounds))
            blockingBounds.push({
              minX: Math.min(a.x, b.x),
              maxX: Math.max(a.x, b.x),
              minY: Math.min(a.y, b.y),
              maxY: Math.max(a.y, b.y),
            })
        }
      }
      if (blockingBounds.length === 0) break
      const next =
        direction *
        Math.max(
          ...blockingBounds.map(
            (b) => direction * outwardEdge(b) + extent(label) + CLEARANCE,
          ),
        )
      if (
        (next - coordinate) * direction <= EPS ||
        Math.abs(next - original.anchorPoint[axis]) > maxDistance
      )
        return false
      coordinate = next
      if (attempts === maxAttempts) return false
    }

    const protectedPoints = [
      ...pins,
      ...getSameNetJunctions(connector, traces),
      ...netLabelPlacements
        .filter((_, otherIndex) => otherIndex !== index)
        .map((other) => other.anchorPoint),
    ].filter((point) => tracePathContainsPoint(connector.tracePath, point))
    if (
      !protectedPoints.every((point) => tracePathContainsPoint(path, point)) ||
      isPathCollidingWithObstacles(path, obstacles)
    )
      return false
    outputLabels[index] = label
    outputTraces[traces.indexOf(connector)] = { ...connector, tracePath: path }

    for (let otherIndex = 0; otherIndex < outputLabels.length; otherIndex++) {
      if (otherIndex === index) continue
      const other = outputLabels[otherIndex]!
      const otherBounds = boundsFor(other)
      if (
        !rectsOverlap(boundsFor(label), otherBounds) &&
        !tracePathIntersectsBounds(path, otherBounds)
      )
        continue
      // Preserve pin order: only a neighbor behind this label's facing direction
      // can yield without routing its own connector through the moved label.
      const facingSign = original.orientation.endsWith("+") ? 1 : -1
      const otherConnector = getTerminalPortConnector(
        other,
        outputTraces,
        netLabelConnectorTraceIds,
      )
      if (
        !otherConnector ||
        (otherConnector.tracePath[0]![along] - connector.tracePath[0]![along]) *
          facingSign >=
          -EPS
      )
        return false
      const boundary = rectsOverlap(boundsFor(label), otherBounds)
        ? direction * outwardEdge(boundsFor(label))
        : direction * coordinate
      if (
        !moveLabel(
          otherIndex,
          direction * (boundary + extent(other) + CLEARANCE),
        )
      )
        return false
    }
    return true
  }

  const seedBounds = boundsFor(seed)
  const blockingTraces = traces.filter(
    (trace) =>
      trace.globalConnNetId !== seed.globalConnNetId &&
      tracePathIntersectsBounds(trace.tracePath, seedBounds),
  )
  if (blockingTraces.length === 0) return null
  const coordinate =
    direction *
    Math.max(
      ...blockingTraces.flatMap((trace) =>
        trace.tracePath.slice(1).flatMap((end, index) => {
          const start = trace.tracePath[index]!
          return segmentIntersectsRect(start, end, seedBounds)
            ? [
                direction * start[axis] + extent(seed) + CLEARANCE,
                direction * end[axis] + extent(seed) + CLEARANCE,
              ]
            : []
        }),
      ),
    )
  if (!moveLabel(labelIndex, coordinate)) return null

  for (const index of moved) {
    const label = outputLabels[index]!
    const bounds = boundsFor(label)
    const connector = getTerminalPortConnector(
      label,
      outputTraces,
      netLabelConnectorTraceIds,
    )!
    const original = getTerminalPortConnector(
      netLabelPlacements[index]!,
      traces,
      netLabelConnectorTraceIds,
    )!
    if (
      outputLabels.some(
        (other, i) => i !== index && rectsOverlap(bounds, boundsFor(other)),
      ) ||
      outputTraces.some(
        (trace) =>
          trace.mspPairId !== connector.mspPairId &&
          tracePathIntersectsBounds(trace.tracePath, bounds),
      )
    )
      return null
    const otherTraces = outputTraces.filter(
      (trace) => trace.globalConnNetId !== connector.globalConnNetId,
    )
    if (
      doesPathOverlapTraceStrokes(connector.tracePath, otherTraces) ||
      otherTraces.some(
        (other) =>
          countPathIntersections(connector.tracePath, other.tracePath) >
          countPathIntersections(
            original.tracePath,
            traces.find((trace) => trace.mspPairId === other.mspPairId)!
              .tracePath,
          ),
      )
    )
      return null
  }
  return { traces: outputTraces, netLabelPlacements: outputLabels }
}
