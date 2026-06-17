import type { Point } from "graphics-debug"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type AlignmentShape = "hvh" | "vhv"

type AlignmentCandidate = {
  trace: SolvedTracePath
  shape: AlignmentShape
  axisValue: number
}

const ALIGNMENT_SPREAD_LIMIT = 0.16
const ALIGNMENT_PADDING = 0.01

const isSameNetLabel = (
  label: NetLabelPlacement,
  trace: SolvedTracePath,
  mergedLabelNetIdMap: Record<string, Set<string>>,
) => {
  const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
  if (originalNetIds) {
    return originalNetIds.has(trace.globalConnNetId)
  }

  return label.globalConnNetId === trace.globalConnNetId
}

const getAlignmentCandidate = (
  trace: SolvedTracePath,
): AlignmentCandidate | null => {
  if (trace.tracePath.length !== 4) return null

  const [p0, p1, p2, p3] = trace.tracePath
  if (p0.y === p1.y && p1.x === p2.x && p2.y === p3.y) {
    return {
      trace,
      shape: "hvh",
      axisValue: p1.x,
    }
  }

  if (p0.x === p1.x && p1.y === p2.y && p2.x === p3.x) {
    return {
      trace,
      shape: "vhv",
      axisValue: p1.y,
    }
  }

  return null
}

const buildAlignedPath = (
  tracePath: Point[],
  shape: AlignmentShape,
  axisValue: number,
): Point[] => {
  const [p0, p1, p2, p3] = tracePath

  if (shape === "hvh") {
    return [p0, { x: axisValue, y: p1.y }, { x: axisValue, y: p2.y }, p3]
  }

  return [p0, { x: p1.x, y: axisValue }, { x: p2.x, y: axisValue }, p3]
}

const buildLabelBounds = (
  labels: NetLabelPlacement[],
  trace: SolvedTracePath,
  mergedLabelNetIdMap: Record<string, Set<string>>,
  paddingBuffer: number,
) =>
  labels
    .filter((label) => !isSameNetLabel(label, trace, mergedLabelNetIdMap))
    .map((label) => ({
      minX: label.center.x - label.width / 2 - paddingBuffer,
      maxX: label.center.x + label.width / 2 + paddingBuffer,
      minY: label.center.y - label.height / 2 - paddingBuffer,
      maxY: label.center.y + label.height / 2 + paddingBuffer,
    }))

const buildTraceObstacles = (
  traces: SolvedTracePath[],
  trace: SolvedTracePath,
) => {
  const TRACE_WIDTH = 0.01
  return traces
    .filter((other) => other.mspPairId !== trace.mspPairId)
    .filter((other) => other.globalConnNetId !== trace.globalConnNetId)
    .flatMap((otherTrace, traceIndex) =>
      otherTrace.tracePath.slice(0, -1).map((p1, segmentIndex) => {
        const p2 = otherTrace.tracePath[segmentIndex + 1]!
        return {
          chipId: `trace-obstacle-${traceIndex}-${segmentIndex}`,
          minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
          minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
          maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
          maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
        }
      }),
    )
}

const pathIntersectsRects = (path: Point[], rects: any[]) => {
  for (let i = 0; i < path.length - 1; i++) {
    for (const rect of rects) {
      if (segmentIntersectsRect(path[i]!, path[i + 1]!, rect)) {
        return true
      }
    }
  }

  return false
}

export const alignNearbySameNetSegments = ({
  inputProblem,
  traces,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}): SolvedTracePath[] => {
  const staticObstacles = getObstacleRects(inputProblem).map((obs) => ({
    ...obs,
    minX: obs.minX - ALIGNMENT_PADDING,
    minY: obs.minY - ALIGNMENT_PADDING,
    maxX: obs.maxX + ALIGNMENT_PADDING,
    maxY: obs.maxY + ALIGNMENT_PADDING,
  }))

  const output = traces.map((trace) => ({
    ...trace,
    tracePath: [...trace.tracePath],
  }))
  const candidatesByNet = new Map<string, AlignmentCandidate[]>()

  for (const trace of output) {
    const candidate = getAlignmentCandidate(trace)
    if (!candidate) continue
    const list = candidatesByNet.get(trace.globalConnNetId) ?? []
    list.push(candidate)
    candidatesByNet.set(trace.globalConnNetId, list)
  }

  for (const candidates of candidatesByNet.values()) {
    const groups = new Map<AlignmentShape, AlignmentCandidate[]>()
    for (const candidate of candidates) {
      const group = groups.get(candidate.shape) ?? []
      group.push(candidate)
      groups.set(candidate.shape, group)
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue

      const axisValues = group
        .map((candidate) => candidate.axisValue)
        .sort((a, b) => a - b)
      const spread = axisValues[axisValues.length - 1]! - axisValues[0]!
      if (spread > ALIGNMENT_SPREAD_LIMIT) continue

      const sharedAxis =
        axisValues.length % 2 === 1
          ? axisValues[(axisValues.length - 1) / 2]!
          : (axisValues[axisValues.length / 2 - 1]! +
              axisValues[axisValues.length / 2]!) /
            2

      for (const candidate of group) {
        const traceIndex = output.findIndex(
          (trace) => trace.mspPairId === candidate.trace.mspPairId,
        )
        if (traceIndex === -1) continue

        const alignedPath = simplifyPath(
          buildAlignedPath(
            candidate.trace.tracePath,
            candidate.shape,
            sharedAxis,
          ),
        )

        const traceObstacles = buildTraceObstacles(output, candidate.trace)
        const labelBounds = buildLabelBounds(
          allLabelPlacements,
          candidate.trace,
          mergedLabelNetIdMap,
          paddingBuffer,
        )

        const collides =
          pathIntersectsRects(alignedPath, staticObstacles) ||
          pathIntersectsRects(alignedPath, traceObstacles) ||
          pathIntersectsRects(alignedPath, labelBounds)

        if (!collides) {
          output[traceIndex] = {
            ...candidate.trace,
            tracePath: alignedPath,
          }
        }
      }
    }
  }

  return output
}
