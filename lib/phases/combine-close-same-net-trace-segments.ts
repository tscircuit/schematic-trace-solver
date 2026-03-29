import type { SchematicTrace } from "../types"

/**
 * PHASE: Combine Close Same-Net Trace Segments
 *
 * When two trace segments on the same net run parallel and very close together
 * (nearly overlapping), this phase merges them into a single segment to avoid
 * rendering duplicate/redundant lines on the schematic.
 *
 * This handles the case where routing produces two nearly-identical horizontal
 * or vertical segments on the same net that should visually appear as one.
 */

const DEFAULT_CLOSENESS_THRESHOLD = 0.001 // schematic units

interface Point {
  x: number
  y: number
}

interface TraceSegment {
  x: number
  y: number
  to_schematic_port_id?: string
  from_schematic_port_id?: string
}

function isHorizontal(a: Point, b: Point): boolean {
  return Math.abs(a.y - b.y) < DEFAULT_CLOSENESS_THRESHOLD
}

function isVertical(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < DEFAULT_CLOSENESS_THRESHOLD
}

function approxEqual(a: number, b: number, threshold = DEFAULT_CLOSENESS_THRESHOLD): boolean {
  return Math.abs(a - b) <= threshold
}

function segmentsOverlapOrTouch1D(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
  threshold = DEFAULT_CLOSENESS_THRESHOLD
): boolean {
  const aMin = Math.min(a1, a2)
  const aMax = Math.max(a1, a2)
  const bMin = Math.min(b1, b2)
  const bMax = Math.max(b1, b2)
  // segments overlap if they share any range (with threshold tolerance)
  return aMin <= bMax + threshold && bMin <= aMax + threshold
}

function mergeRange(
  a1: number,
  a2: number,
  b1: number,
  b2: number
): [number, number] {
  return [Math.min(a1, a2, b1, b2), Math.max(a1, a2, b1, b2)]
}

type EdgeSegment = {
  index: number // index of the trace
  edgeIndex: number // index of edge in trace.edges
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Extracts all linear segments from all traces and annotates them with net info.
 */
function extractSegments(traces: SchematicTrace[]): EdgeSegment[] {
  const segments: EdgeSegment[] = []
  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i]
    for (let e = 0; e < trace.edges.length; e++) {
      const edge = trace.edges[e]
      segments.push({
        index: i,
        edgeIndex: e,
        x1: edge.from.x,
        y1: edge.from.y,
        x2: edge.to.x,
        y2: edge.to.y,
      })
    }
  }
  return segments
}

/**
 * Two horizontal segments are "close and parallel" if:
 * - Both are horizontal (same or nearly-same y)
 * - Their y values are within threshold
 * - Their x ranges overlap or touch
 */
function areCloseParallelHorizontal(
  s1: EdgeSegment,
  s2: EdgeSegment,
  closenessThreshold: number
): boolean {
  if (!isHorizontal({ x: s1.x1, y: s1.y1 }, { x: s1.x2, y: s1.y2 })) return false
  if (!isHorizontal({ x: s2.x1, y: s2.y1 }, { x: s2.x2, y: s2.y2 })) return false
  if (!approxEqual(s1.y1, s2.y1, closenessThreshold)) return false
  return segmentsOverlapOrTouch1D(s1.x1, s1.x2, s2.x1, s2.x2, closenessThreshold)
}

/**
 * Two vertical segments are "close and parallel" if:
 * - Both are vertical
 * - Their x values are within threshold
 * - Their y ranges overlap or touch
 */
function areCloseParallelVertical(
  s1: EdgeSegment,
  s2: EdgeSegment,
  closenessThreshold: number
): boolean {
  if (!isVertical({ x: s1.x1, y: s1.y1 }, { x: s1.x2, y: s1.y2 })) return false
  if (!isVertical({ x: s2.x1, y: s2.y1 }, { x: s2.x2, y: s2.y2 })) return false
  if (!approxEqual(s1.x1, s2.x1, closenessThreshold)) return false
  return segmentsOverlapOrTouch1D(s1.y1, s1.y2, s2.y1, s2.y2, closenessThreshold)
}

export interface CombineCloseSegmentsOptions {
  /**
   * Maximum distance between two parallel same-net segments for them to be
   * considered "close" and merged. Defaults to 0.001 schematic units.
   */
  closenessThreshold?: number
}

/**
 * Pipeline phase: combine close same-net trace segments.
 *
 * Iterates through all traces sharing the same net, finds pairs of edges that
 * are parallel, collinear (within `closenessThreshold`), and overlapping/touching
 * in the perpendicular axis, then merges them into one longer edge and removes
 * the duplicate.
 */
export function combineCloseSameNetTraceSegments(
  traces: SchematicTrace[],
  options: CombineCloseSegmentsOptions = {}
): SchematicTrace[] {
  const closenessThreshold = options.closenessThreshold ?? DEFAULT_CLOSENESS_THRESHOLD

  // Work on a deep clone so we don't mutate input
  const result: SchematicTrace[] = traces.map((t) => ({
    ...t,
    edges: t.edges.map((e) => ({
      ...e,
      from: { ...e.from },
      to: { ...e.to },
    })),
  }))

  // Group trace indices by net_id
  const byNet = new Map<string, number[]>()
  for (let i = 0; i < result.length; i++) {
    const net = result[i].connection_name ?? result[i].net_id ?? `__trace_${i}`
    if (!byNet.has(net)) byNet.set(net, [])
    byNet.get(net)!.push(i)
  }

  for (const [, traceIndices] of byNet) {
    if (traceIndices.length < 2) continue

    // Keep iterating until no more merges are performed for this net
    let changed = true
    while (changed) {
      changed = false

      outer: for (let ti = 0; ti < traceIndices.length; ti++) {
        const traceIdx = traceIndices[ti]
        const trace = result[traceIdx]

        for (let ei = 0; ei < trace.edges.length; ei++) {
          const edge = trace.edges[ei]
          const s1: EdgeSegment = {
            index: traceIdx,
            edgeIndex: ei,
            x1: edge.from.x,
            y1: edge.from.y,
            x2: edge.to.x,
            y2: edge.to.y,
          }

          // Compare against all edges in other traces of the same net
          for (let tj = ti + 1; tj < traceIndices.length; tj++) {
            const otherTraceIdx = traceIndices[tj]
            const otherTrace = result[otherTraceIdx]

            for (let ej = 0; ej < otherTrace.edges.length; ej++) {
              const otherEdge = otherTrace.edges[ej]
              const s2: EdgeSegment = {
                index: otherTraceIdx,
                edgeIndex: ej,
                x1: otherEdge.from.x,
                y1: otherEdge.from.y,
                x2: otherEdge.to.x,
                y2: otherEdge.to.y,
              }

              const isParallelH = areCloseParallelHorizontal(s1, s2, closenessThreshold)
              const isParallelV = areCloseParallelVertical(s1, s2, closenessThreshold)

              if (!isParallelH && !isParallelV) continue

              // Merge s1 and s2 into a single longer segment in s1's trace
              if (isParallelH) {
                const avgY = (s1.y1 + s2.y1) / 2
                const [newX1, newX2] = mergeRange(s1.x1, s1.x2, s2.x1, s2.x2)
                // Keep the port connection metadata from both edges
                const mergedFrom = {
                  ...edge.from,
                  x: newX1,
                  y: avgY,
                }
                const mergedTo = {
                  ...edge.to,
                  x: newX2,
                  y: avgY,
                }
                // Preserve schematic_port_id if present
                if (!mergedFrom.schematic_port_id && otherEdge.from.schematic_port_id) {
                  ;(mergedFrom as any).schematic_port_id = otherEdge.from.schematic_port_id
                }
                if (!mergedTo.schematic_port_id && otherEdge.to.schematic_port_id) {
                  ;(mergedTo as any).schematic_port_id = otherEdge.to.schematic_port_id
                }
                trace.edges[ei] = { ...edge, from: mergedFrom, to: mergedTo }
              } else {
                // isParallelV
                const avgX = (s1.x1 + s2.x1) / 2
                const [newY1, newY2] = mergeRange(s1.y1, s1.y2, s2.y1, s2.y2)
                const mergedFrom = {
                  ...edge.from,
                  x: avgX,
                  y: newY1,
                }
                const mergedTo = {
                  ...edge.to,
                  x: avgX,
                  y: newY2,
                }
                if (!mergedFrom.schematic_port_id && otherEdge.from.schematic_port_id) {
                  ;(mergedFrom as any).schematic_port_id = otherEdge.from.schematic_port_id
                }
                if (!mergedTo.schematic_port_id && otherEdge.to.schematic_port_id) {
                  ;(mergedTo as any).schematic_port_id = otherEdge.to.schematic_port_id
                }
                trace.edges[ei] = { ...edge, from: mergedFrom, to: mergedTo }
              }

              // Remove the merged edge from the other trace
              otherTrace.edges.splice(ej, 1)

              // If the other trace now has no edges, we could remove it,
              // but we leave it for downstream cleanup to avoid index issues
              changed = true
              // Restart outer loop since indices have changed
              break outer
            }
          }
        }
      }
    }
  }

  // Remove traces that have been fully consumed (no edges left)
  // but only if they weren't the "primary" trace holding connections
  return result.filter((t) => t.edges.length > 0)
}
