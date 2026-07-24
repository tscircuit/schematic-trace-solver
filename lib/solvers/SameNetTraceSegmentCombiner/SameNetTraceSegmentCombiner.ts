import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface TraceSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  netId: string
  traceIndex: number
  segmentIndex: number
}

const COLLINEAR_DISTANCE_THRESHOLD = 0.05
const OVERLAP_GAP_THRESHOLD = 0.1

function isHorizontal(seg: TraceSegment): boolean {
  return Math.abs(seg.y2 - seg.y1) < COLLINEAR_DISTANCE_THRESHOLD
}

function isVertical(seg: TraceSegment): boolean {
  return Math.abs(seg.x2 - seg.x1) < COLLINEAR_DISTANCE_THRESHOLD
}

/**
 * Check if two horizontal segments are on nearly the same y-axis and
 * their x-ranges are close enough to merge.
 */
function canMergeHorizontal(
  a: TraceSegment,
  b: TraceSegment,
  threshold: number,
): boolean {
  if (!isHorizontal(a) || !isHorizontal(b)) return false
  if (Math.abs(a.y1 - b.y1) > threshold) return false

  const aMinX = Math.min(a.x1, a.x2)
  const aMaxX = Math.max(a.x1, a.x2)
  const bMinX = Math.min(b.x1, b.x2)
  const bMaxX = Math.max(b.x1, b.x2)

  // Check if ranges overlap or are within gap threshold
  return aMinX <= bMaxX + OVERLAP_GAP_THRESHOLD && bMinX <= aMaxX + OVERLAP_GAP_THRESHOLD
}

/**
 * Check if two vertical segments are on nearly the same x-axis and
 * their y-ranges are close enough to merge.
 */
function canMergeVertical(
  a: TraceSegment,
  b: TraceSegment,
  threshold: number,
): boolean {
  if (!isVertical(a) || !isVertical(b)) return false
  if (Math.abs(a.x1 - b.x1) > threshold) return false

  const aMinY = Math.min(a.y1, a.y2)
  const aMaxY = Math.max(a.y1, a.y2)
  const bMinY = Math.min(b.y1, b.y2)
  const bMaxY = Math.max(b.y1, b.y2)

  return aMinY <= bMaxY + OVERLAP_GAP_THRESHOLD && bMinY <= aMaxY + OVERLAP_GAP_THRESHOLD
}

function mergeHorizontalSegments(
  a: TraceSegment,
  b: TraceSegment,
): { x1: number; y1: number; x2: number; y2: number } {
  const y = (a.y1 + b.y1) / 2
  const minX = Math.min(a.x1, a.x2, b.x1, b.x2)
  const maxX = Math.max(a.x1, a.x2, b.x1, b.x2)
  return { x1: minX, y1: y, x2: maxX, y2: y }
}

function mergeVerticalSegments(
  a: TraceSegment,
  b: TraceSegment,
): { x1: number; y1: number; x2: number; y2: number } {
  const x = (a.x1 + b.x1) / 2
  const minY = Math.min(a.y1, a.y2, b.y1, b.y2)
  const maxY = Math.max(a.y1, a.y2, b.y1, b.y2)
  return { x1: x, y1: minY, x2: x, y2: maxY }
}

export interface CombinerInput {
  traces: Array<SolvedTracePath & { netId?: string }>
  collinearDistanceThreshold?: number
}

export interface CombinerOutput {
  traces: Array<SolvedTracePath & { netId?: string }>
}

/**
 * Combines same-net trace segments that are collinear and close together
 * into single merged segments. This reduces visual clutter when two
 * parallel traces on the same net run nearly on top of each other.
 */
export function combineSameNetTraceSegments(
  input: CombinerInput,
): CombinerOutput {
  const threshold = input.collinearDistanceThreshold ?? COLLINEAR_DISTANCE_THRESHOLD

  // Group traces by netId
  const netGroups = new Map<string, Array<SolvedTracePath & { netId?: string }>>()
  for (const trace of input.traces) {
    const key = trace.netId ?? "__unknown__"
    if (!netGroups.has(key)) netGroups.set(key, [])
    netGroups.get(key)!.push(trace)
  }

  const resultTraces: Array<SolvedTracePath & { netId?: string }> = []

  for (const [, group] of netGroups) {
    if (group.length < 2) {
      resultTraces.push(...group)
      continue
    }

    // Extract all segments from this net group
    const segments: TraceSegment[] = []
    for (let ti = 0; ti < group.length; ti++) {
      const trace = group[ti]
      for (let si = 0; si < trace.tracePath.length - 1; si++) {
        segments.push({
          x1: trace.tracePath[si].x,
          y1: trace.tracePath[si].y,
          x2: trace.tracePath[si + 1].x,
          y2: trace.tracePath[si + 1].y,
          netId: trace.netId ?? "__unknown__",
          traceIndex: ti,
          segmentIndex: si,
        })
      }
    }

    // Find and merge collinear close segments
    const merged = new Set<number>()
    const mergedSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

    for (let i = 0; i < segments.length; i++) {
      if (merged.has(i)) continue
      let current = segments[i]
      let didMerge = false

      for (let j = i + 1; j < segments.length; j++) {
        if (merged.has(j)) continue
        const other = segments[j]
