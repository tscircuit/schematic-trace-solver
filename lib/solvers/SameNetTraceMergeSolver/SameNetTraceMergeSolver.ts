import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

export interface SameNetTraceMergeSolverParams {
  traces: SolvedTracePath[]
}

/**
 * SameNetTraceMergeSolver is a post-processing step that cleans up schematic traces.
 * It primarily addresses "ladder lines" (redundant parallel segments) and merges
 * collinear segments of the same net that are touching or overlapping.
 *
 * Algorithm Overview:
 * 1. Segments Decompositions: Breaks all Polylines into individual 2-point segments.
 * 2. Grouping: Groups segments by net and then by collinearity (X for vertical, Y for horizontal, slope/intercept for diagonal).
 * 3. Merging: Within each group, merges overlapping or touching segments into longer ones.
 * 4. Graph Construction: Builds an adjacency list where points are nodes and merged segments are edges.
 * 5. Path Reconstruction: Traverses the graph from endpoints to junctions or from isolated loops to reconstruct clean Polylines.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  traces: SolvedTracePath[]
  mergedTraces: SolvedTracePath[] = []

  constructor(params: SameNetTraceMergeSolverParams) {
    super()
    this.traces = params.traces
  }

  override _step() {
    this.mergedTraces = this.mergeTraces(this.traces)
    this.solved = true
  }

  public getOutput() {
    return {
      traces: this.mergedTraces,
    }
  }

  /**
   * Main entry point for merging. Groups traces by net and merges them independently.
   */
  private mergeTraces(traces: SolvedTracePath[]): SolvedTracePath[] {
    if (traces.length === 0) return []

    const netGroups: Record<string, SolvedTracePath[]> = {}
    for (const trace of traces) {
      const netId = trace.globalConnNetId
      if (!netGroups[netId]) {
        netGroups[netId] = []
      }
      netGroups[netId].push(trace)
    }

    const allMergedTraces: SolvedTracePath[] = []

    for (const netId in netGroups) {
      const mergedForNet = this.mergeTracesForNet(netGroups[netId])
      allMergedTraces.push(...mergedForNet)
    }

    return allMergedTraces
  }

  /**
   * Processes a single net by decomposing it into segments, merging them, and reconstructing paths.
   */
  private mergeTracesForNet(netTraces: SolvedTracePath[]): SolvedTracePath[] {
    if (netTraces.length === 0) return []

    // 1. Extract all segments and normalize them (p1 < p2)
    const segments: { p1: Point; p2: Point; trace: SolvedTracePath }[] = []
    for (const trace of netTraces) {
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]
        const p2 = trace.tracePath[i + 1]
        const [sp1, sp2] = this.sortPoints(p1, p2)
        segments.push({ p1: sp1, p2: sp2, trace })
      }
    }

    // 2. Merge collinear and overlapping segments
    const mergedSegments = this.mergeCollinearSegments(segments)

    // 3. Reconstruct paths from merged segments
    return this.reconstructPaths(mergedSegments, netTraces[0].globalConnNetId)
  }

  /**
   * Sorts two points as [min, max] based on x, then y, to ensure stable segment representation.
   */
  private sortPoints(p1: Point, p2: Point): [Point, Point] {
    if (p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)) {
      return [p1, p2]
    }
    return [p2, p1]
  }

  /**
   * Groups segments by collinearity and merges overlapping ones.
   * This effectively eliminates "ladder lines" (redundant overlapping segments).
   */
  private mergeCollinearSegments(
    segments: { p1: Point; p2: Point; trace: SolvedTracePath }[]
  ): { p1: Point; p2: Point; mspIds: Set<string>; pinIds: Set<string> }[] {
    const horizontal = new Map<number, typeof segments>()
    const vertical = new Map<number, typeof segments>()
    const diag = new Map<string, typeof segments>()

    const threshold = 0.001

    for (const seg of segments) {
      if (Math.abs(seg.p1.y - seg.p2.y) < threshold) {
        // Horizontal: constant Y
        const y = Math.round(seg.p1.y / threshold) * threshold
        if (!horizontal.has(y)) horizontal.set(y, [])
        horizontal.get(y)!.push(seg)
      } else if (Math.abs(seg.p1.x - seg.p2.x) < threshold) {
        // Vertical: constant X
        const x = Math.round(seg.p1.x / threshold) * threshold
        if (!vertical.has(x)) vertical.set(x, [])
        vertical.get(x)!.push(seg)
      } else {
        // Diagonal: group by slope and intercept
        const dx = seg.p2.x - seg.p1.x
        const dy = seg.p2.y - seg.p1.y
        const slope = dy / dx
        const intercept = seg.p1.y - slope * seg.p1.x
        // Precision handling for slope/intercept grouping
        const key = `${slope.toFixed(4)},${intercept.toFixed(4)}`
        if (!diag.has(key)) diag.set(key, [])
        diag.get(key)!.push(seg)
      }
    }

    const result: { p1: Point; p2: Point; mspIds: Set<string>; pinIds: Set<string> }[] = []

    const mergeInGroup = (group: typeof segments, axis: "x" | "y") => {
      if (group.length === 0) return
      // Sort segments along the variable axis
      group.sort((a, b) => a.p1[axis] - b.p1[axis])

      let current = {
        p1: group[0].p1,
        p2: group[0].p2,
        mspIds: new Set(group[0].trace.mspConnectionPairIds),
        pinIds: new Set(group[0].trace.pinIds),
      }

      for (let i = 1; i < group.length; i++) {
        const seg = group[i]
        if (seg.p1[axis] <= current.p2[axis] + threshold) {
          // Segments are touching or overlapping, extend the current one if needed
          if (seg.p2[axis] > current.p2[axis]) {
            current.p2 = seg.p2
          }
          // Merge metadata from original connection pairs
          for (const id of seg.trace.mspConnectionPairIds) current.mspIds.add(id)
          for (const id of seg.trace.pinIds) current.pinIds.add(id)
        } else {
          result.push(current)
          current = {
            p1: seg.p1,
            p2: seg.p2,
            mspIds: new Set(seg.trace.mspConnectionPairIds),
            pinIds: new Set(seg.trace.pinIds),
          }
        }
      }
      result.push(current)
    }

    horizontal.forEach((g) => mergeInGroup(g, "x"))
    vertical.forEach((g) => mergeInGroup(g, "y"))
    diag.forEach((g) => mergeInGroup(g, "x")) // For diagonal, we can also use X as the progression axis

    return result
  }

  /**
   * Reconstructs Polylines from a set of merged segments using graph traversal.
   *
   * Strategy:
   * 1. Endpoints (Leaves): Nodes with degree 1 are the primary start points for traces.
   * 2. Junctions: Nodes with degree > 2 indicate forks; we start new paths from unvisited edges here.
   * 3. Loops: Isolated cycles (degree 2 everywhere) are handled last.
   */
  private reconstructPaths(
    segments: { p1: Point; p2: Point; mspIds: Set<string>; pinIds: Set<string> }[],
    netId: string
  ): SolvedTracePath[] {
    const threshold = 0.001
    const pointToKey = (p: Point) =>
      `${Math.round(p.x / threshold)},${Math.round(p.y / threshold)}`

    // Adjacency list: Map pointKey -> { point, edgeIndices }
    const adj = new Map<string, { point: Point; edges: number[] }>()

    for (let i = 0; i < segments.length; i++) {
      const { p1, p2 } = segments[i]
      const k1 = pointToKey(p1)
      const k2 = pointToKey(p2)

      if (!adj.has(k1)) adj.set(k1, { point: p1, edges: [] })
      if (!adj.has(k2)) adj.set(k2, { point: p2, edges: [] })

      adj.get(k1)!.edges.push(i)
      adj.get(k2)!.edges.push(i)
    }

    const visitedEdges = new Set<number>()
    const traces: SolvedTracePath[] = []

    /**
     * Traverses the graph starting from a node, following edges until a junction or leaf is reached.
     */
    const buildPathFrom = (startKey: string) => {
      const node = adj.get(startKey)!
      for (const edgeIdx of node.edges) {
        if (visitedEdges.has(edgeIdx)) continue

        const path: Point[] = [node.point]
        const mspIds = new Set<string>()
        const pinIds = new Set<string>()

        let currentKey = startKey
        let currentEdgeIdx = edgeIdx

        while (currentEdgeIdx !== -1) {
          visitedEdges.add(currentEdgeIdx)
          const seg = segments[currentEdgeIdx]
          for (const id of seg.mspIds) mspIds.add(id)
          for (const id of seg.pinIds) pinIds.add(id)

          const k1 = pointToKey(seg.p1)
          const k2 = pointToKey(seg.p2)
          const nextKey = k1 === currentKey ? k2 : k1
          const nextNode = adj.get(nextKey)!

          path.push(nextNode.point)

          // If nextNode has exactly 2 edges, it's a simple wire; we can continue the same path.
          // If it has 1 edge (leaf) or >2 edges (junction), we stop this path here.
          if (nextNode.edges.length === 2) {
            const nextEdgeIdx = nextNode.edges.find((e) => !visitedEdges.has(e))
            if (nextEdgeIdx !== undefined) {
              currentKey = nextKey
              currentEdgeIdx = nextEdgeIdx
              continue
            }
          }
          currentEdgeIdx = -1
        }

        traces.push({
          mspPairId: `merged_${netId}_${traces.length}`,
          globalConnNetId: netId,
          dcConnNetId: netId,
          tracePath: this.simplifyCollinearPoints(path),
          mspConnectionPairIds: Array.from(mspIds),
          pinIds: Array.from(pinIds),
          pins: [],
        })
      }
    }

    const points = Array.from(adj.keys())
    
    // Priority 1: Start from leaf nodes to ensure branches are captured correctly.
    for (const k of points) {
      if (adj.get(k)!.edges.length === 1) buildPathFrom(k)
    }
    // Priority 2: Start from junctions to capture intermediate segments.
    for (const k of points) {
      if (adj.get(k)!.edges.length > 2) buildPathFrom(k)
    }
    // Priority 3: Handle isolated loops (nodes with degree 2 that haven't been visited).
    for (const k of points) {
      if (adj.get(k)!.edges.length === 2) buildPathFrom(k)
    }

    return traces
  }

  /**
   * Eliminates redundant intermediate points in a path if they are collinear with their neighbors.
   */
  private simplifyCollinearPoints(points: Point[]): Point[] {
    if (points.length <= 2) return points

    const simplified: Point[] = [points[0]]
    const threshold = 0.001

    for (let i = 1; i < points.length - 1; i++) {
      const prev = simplified[simplified.length - 1]
      const curr = points[i]
      const next = points[i + 1]

      const isCollinear = this.areCollinear(prev, curr, next, threshold)
      if (!isCollinear) {
        simplified.push(curr)
      }
    }

    simplified.push(points[points.length - 1])
    return simplified
  }

  /**
   * Checks if three points are collinear within a given threshold using triangle area.
   */
  private areCollinear(p1: Point, p2: Point, p3: Point, threshold: number): boolean {
    const area = Math.abs(
      p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)
    )
    // Area < 2 * distance * threshold is roughly collinear.
    return area < threshold * 2
  }
}
