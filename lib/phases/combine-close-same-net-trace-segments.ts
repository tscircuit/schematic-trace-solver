import type { SchematicTrace } from "@tscircuit/props"

const CLOSE_THRESHOLD = 0.1 // units within which segments are considered "close"

interface Point {
  x: number
  y: number
  schematic_port_id?: string
  [key: string]: unknown
}

interface Edge {
  from: Point
  to: Point
  [key: string]: unknown
}

/**
 * Groups traces by net name.
 */
function groupByNet(
  traces: SchematicTrace[],
): Record<string, SchematicTrace[]> {
  const groups: Record<string, SchematicTrace[]> = {}
  for (const trace of traces) {
    const net = (trace as any).connection_name ?? (trace as any).net_name ?? ""
    if (!groups[net]) groups[net] = []
    groups[net].push(trace)
  }
  return groups
}

/**
 * Returns true if the two numbers are within CLOSE_THRESHOLD of each other.
 */
function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= CLOSE_THRESHOLD
}

/**
 * Returns true if two horizontal edges are on approximately the same Y and
 * their X ranges overlap or nearly overlap.
 */
function horizontalEdgesAreClose(e1: Edge, e2: Edge): boolean {
  const y1 = e1.from.y
  const y2 = e2.from.y
  if (!isClose(y1, y2)) return false

  const e1x1 = Math.min(e1.from.x, e1.to.x)
  const e1x2 = Math.max(e1.from.x, e1.to.x)
  const e2x1 = Math.min(e2.from.x, e2.to.x)
  const e2x2 = Math.max(e2.from.x, e2.to.x)

  // Overlap or within threshold
  return e1x1 <= e2x2 + CLOSE_THRESHOLD && e2x1 <= e1x2 + CLOSE_THRESHOLD
}

/**
 * Returns true if two vertical edges are on approximately the same X and
 * their Y ranges overlap or nearly overlap.
 */
function verticalEdgesAreClose(e1: Edge, e2: Edge): boolean {
  const x1 = e1.from.x
  const x2 = e2.from.x
  if (!isClose(x1, x2)) return false

  const e1y1 = Math.min(e1.from.y, e1.to.y)
  const e1y2 = Math.max(e1.from.y, e1.to.y)
  const e2y1 = Math.min(e2.from.y, e2.to.y)
  const e2y2 = Math.max(e2.from.y, e2.to.y)

  return e1y1 <= e2y2 + CLOSE_THRESHOLD && e2y1 <= e1y2 + CLOSE_THRESHOLD
}

/**
 * Returns true if the edge is horizontal (same Y for both endpoints).
 */
function isHorizontalEdge(edge: Edge): boolean {
  return Math.abs(edge.from.y - edge.to.y) < 1e-9
}

/**
 * Returns true if the edge is vertical (same X for both endpoints).
 */
function isVerticalEdge(edge: Edge): boolean {
  return Math.abs(edge.from.x - edge.to.x) < 1e-9
}

/**
 * Merges two horizontal edges into one spanning the full X range.
 * Endpoint metadata (e.g. schematic_port_id) is preserved from the original
 * endpoint that actually becomes the merged min/max point.
 */
function mergeHorizontalEdges(e1: Edge, e2: Edge): Edge {
  const avgY = (e1.from.y + e2.from.y) / 2

  // Collect all four endpoints with their original x positions
  const points: Array<{ x: number; endpoint: Point; isFrom: boolean }> = [
    { x: e1.from.x, endpoint: e1.from, isFrom: true },
    { x: e1.to.x, endpoint: e1.to, isFrom: false },
    { x: e2.from.x, endpoint: e2.from, isFrom: true },
    { x: e2.to.x, endpoint: e2.to, isFrom: false },
  ]

  points.sort((a, b) => a.x - b.x)
  const minPoint = points[0]
  const maxPoint = points[points.length - 1]

  return {
    ...e1,
    from: { ...minPoint.endpoint, x: minPoint.endpoint.x, y: avgY },
    to: { ...maxPoint.endpoint, x: maxPoint.endpoint.x, y: avgY },
  }
}

/**
 * Merges two vertical edges into one spanning the full Y range.
 * Endpoint metadata (e.g. schematic_port_id) is preserved from the original
 * endpoint that actually becomes the merged min/max point.
 */
function mergeVerticalEdges(e1: Edge, e2: Edge): Edge {
  const avgX = (e1.from.x + e2.from.x) / 2

  // Collect all four endpoints with their original y positions
  const points: Array<{ y: number; endpoint: Point; isFrom: boolean }> = [
    { y: e1.from.y, endpoint: e1.from, isFrom: true },
    { y: e1.to.y, endpoint: e1.to, isFrom: false },
    { y: e2.from.y, endpoint: e2.from, isFrom: true },
    { y: e2.to.y, endpoint: e2.to, isFrom: false },
  ]

  points.sort((a, b) => a.y - b.y)
  const minPoint = points[0]
  const maxPoint = points[points.length - 1]

  return {
    ...e1,
    from: { ...minPoint.endpoint, x: avgX, y: minPoint.endpoint.y },
    to: { ...maxPoint.endpoint, x: avgX, y: maxPoint.endpoint.y },
  }
}

/**
 * Given a list of edges from a single trace, attempt to merge close/overlapping
 * horizontal or vertical edge pairs. Returns the reduced edge list.
 */
function mergeEdgesWithinTrace(edges: Edge[]): Edge[] {
  let changed = true
  let current = [...edges]

  while (changed) {
    changed = false
    const merged: Edge[] = []
    const used = new Set<number>()

    for (let i = 0; i < current.length; i++) {
      if (used.has(i)) continue
      let base = current[i]
      const baseIsH = isHorizontalEdge(base)
      const baseIsV = isVerticalEdge(base)

      for (let j = i + 1; j < current.length; j++) {
        if (used.has(j)) continue
        const other = current[j]

        if (baseIsH && isHorizontalEdge(other) && horizontalEdgesAreClose(base, other)) {
          base = mergeHorizontalEdges(base, other)
          used.add(j)
          changed = true
        } else if (baseIsV && isVerticalEdge(other) && verticalEdgesAreClose(base, other)) {
          base = mergeVerticalEdges(base, other)
          used.add(j)
          changed = true
        }
      }

      merged.push(base)
      used.add(i)
    }

    current = merged
  }

  return current
}

/**
 * Phase: combineCloseSameNetTraceSegments
 *
 * For each net, iterates over all traces and merges horizontal/vertical edge
 * segments that are close together (within CLOSE_THRESHOLD) or overlapping.
 * This reduces redundant lines in the schematic rendering.
 *
 * Traces that end up with no edges after merging are removed.
 */
export function combineCloseSameNetTraceSegments(
  traces: SchematicTrace[],
): SchematicTrace[] {
  const netGroups = groupByNet(traces)
  const result: SchematicTrace[] = []

  for (const net of Object.keys(netGroups)) {
    const group = netGroups[net]

    // Collect all edges across traces in this net, tagged with their source trace index
    type TaggedEdge = { edge: Edge; traceIdx: number }
    const allTagged: TaggedEdge[] = []
    for (let ti = 0; ti < group.length; ti++) {
      const trace = group[ti] as any
      const edges: Edge[] = trace.edges ?? []
      for (const edge of edges) {
        allTagged.push({ edge, traceIdx: ti })
      }
    }

    // Merge edges that belong to the same net (across all traces in the group)
    // We do this by flattening, merging, then re-assigning to the first trace
    const flatEdges = allTagged.map((t) => t.edge)
    const mergedEdges = mergeEdgesWithinTrace(flatEdges)

    // Re-distribute merged edges: put all into the first trace of the group,
    // leave the rest empty (they will be filtered below)
    const firstTrace = group[0] as any
    const updatedFirst: SchematicTrace = {
      ...firstTrace,
      edges: mergedEdges,
    }
    result.push(updatedFirst)

    // Add the remaining traces but mark them as processed (edges emptied after merge)
    // Empty traces are filtered out below rather than passed downstream
    for (let ti = 1; ti < group.length; ti++) {
      const trace = group[ti] as any
      // Edges from this trace have been merged into updatedFirst above
      const updatedTrace: SchematicTrace = {
        ...trace,
        edges: [],
      }
      result.push(updatedTrace)
    }
  }

  // Filter out traces that have no edges after merging
  return result.filter((trace) => {
    const edges = (trace as any).edges ?? []
    return edges.length > 0
  })
}
