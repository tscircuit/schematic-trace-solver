import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line, Point } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"

/**
 * Configuration for the CombineCloseSegmentsSolver
 */
export interface CombineCloseSegmentsSolverParams {
  inputProblem: InputProblem
  /** The traces to process */
  traces: SolvedTracePath[]
  /** Maximum distance between trace endpoints to consider for combining (default: 3 units) */
  proximityThreshold?: number
  /** Connectivity map to determine which traces belong to the same net */
  globalConnMap: ConnectivityMap
}

/**
 * The CombineCloseSegmentsSolver combines trace segments that belong to the same net
 * and have endpoints that are physically close together.
 * This reduces clutter in schematic diagrams by merging nearby traces of the same electrical net.
 */
export class CombineCloseSegmentsSolver extends BaseSolver {
  private input: CombineCloseSegmentsSolverParams
  private outputTraces: SolvedTracePath[]
  private proximityThreshold: number

  constructor(params: CombineCloseSegmentsSolverParams) {
    super()
    this.input = params
    this.proximityThreshold = params.proximityThreshold ?? 3
    this.outputTraces = [...params.traces]
    this.MAX_ITERATIONS = 1
  }

  override _step() {
    // Run the combination algorithm
    this.outputTraces = this.combineCloseSegments(this.outputTraces)
    this.solved = true
  }

  /**
   * Main algorithm to combine close segments of the same net
   */
  private combineCloseSegments(traces: SolvedTracePath[]): SolvedTracePath[] {
    // Group traces by their net
    const tracesByNet = this.groupTracesByNet(traces)

    const combinedTraces: SolvedTracePath[] = []
    const processedTraceIds = new Set<string>()

    // For each net group, try to combine close traces
    for (const [netId, netTraces] of Object.entries(tracesByNet)) {
      // Skip nets with only one trace
      if (netTraces.length <= 1) {
        combinedTraces.push(...netTraces)
        continue
      }

      // Try to combine all close traces for this net
      const { combined, remaining } = this.combineTracesForNet(netTraces)
      combinedTraces.push(...combined)

      // Track processed trace IDs
      for (const trace of combined) {
        processedTraceIds.add(trace.mspPairId)
      }
    }

    // Add any traces that weren't combined (different nets or couldn't be combined)
    for (const trace of traces) {
      if (!processedTraceIds.has(trace.mspPairId)) {
        combinedTraces.push(trace)
      }
    }

    return combinedTraces
  }

  /**
   * Group traces by their net ID
   */
  private groupTracesByNet(
    traces: SolvedTracePath[],
  ): Record<string, SolvedTracePath[]> {
    const groups: Record<string, SolvedTracePath[]> = {}

    for (const trace of traces) {
      // Use the mspConnectionPairIds to determine the net
      const netIds = this.getNetIdsForTrace(trace)

      if (netIds.length === 0) {
        // If no net found, use the mspPairId as a unique identifier
        const uniqueKey = `unique_${trace.mspPairId}`
        if (!groups[uniqueKey]) {
          groups[uniqueKey] = []
        }
        groups[uniqueKey].push(trace)
      } else {
        // Group by each net ID
        for (const netId of netIds) {
          if (!groups[netId]) {
            groups[netId] = []
          }
          groups[netId].push(trace)
        }
      }
    }

    return groups
  }

  /**
   * Get net IDs for a trace based on its pin IDs
   */
  private getNetIdsForTrace(trace: SolvedTracePath): string[] {
    const netIds = new Set<string>()

    // Check all pin IDs associated with this trace
    const pinIds = trace.pinIds ?? []

    for (const pinId of pinIds) {
      const netId = this.input.globalConnMap.getNetConnectedToId(pinId)
      if (netId) {
        netIds.add(netId)
      }
    }

    return Array.from(netIds)
  }

  /**
   * Combine traces for a specific net that are close together
   */
  private combineTracesForNet(netTraces: SolvedTracePath[]): {
    combined: SolvedTracePath[]
    remaining: SolvedTracePath[]
  } {
    const combined: SolvedTracePath[] = []
    const remaining: SolvedTracePath[] = []
    const used = new Set<string>()

    // Sort traces by their first endpoint position to help with deterministic combining
    const sortedTraces = [...netTraces].sort((a, b) => {
      const aStart = a.tracePath[0]
      const bStart = b.tracePath[0]
      return (aStart?.x ?? 0) + (aStart?.y ?? 0) - (bStart?.x ?? 0) - (bStart?.y ?? 0)
    })

    for (const trace of sortedTraces) {
      if (used.has(trace.mspPairId)) {
        continue
      }

      // Find all traces that could be combined with this one
      const combineable = this.findCombineableTraces(trace, netTraces, used)

      if (combineable.length > 0) {
        // Combine the traces
        const mergedTrace = this.mergeTraces([trace, ...combineable])
        combined.push(mergedTrace)
        used.add(trace.mspPairId)
        for (const c of combineable) {
          used.add(c.mspPairId)
        }
      } else {
        remaining.push(trace)
      }
    }

    return { combined, remaining }
  }

  /**
   * Find traces that are close enough to the given trace to be combined
   */
  private findCombineableTraces(
    trace: SolvedTracePath,
    allTraces: SolvedTracePath[],
    used: Set<string>,
  ): SolvedTracePath[] {
    const combineable: SolvedTracePath[] = []
    const threshold = this.proximityThreshold

    // Get endpoints of the trace
    const traceEndpoints = this.getEndpoints(trace)

    for (const otherTrace of allTraces) {
      if (used.has(otherTrace.mspPairId)) {
        continue
      }
      if (otherTrace.mspPairId === trace.mspPairId) {
        continue
      }

      const otherEndpoints = this.getEndpoints(otherTrace)

      // Check if any endpoints are close enough
      for (const endpoint1 of traceEndpoints) {
        for (const endpoint2 of otherEndpoints) {
          const dist = this.distance(endpoint1, endpoint2)
          if (dist <= threshold) {
            combineable.push(otherTrace)
            break
          }
        }
        if (combineable.includes(otherTrace)) {
          break
        }
      }
    }

    return combineable
  }

  /**
   * Get the endpoints of a trace (first and last points)
   */
  private getEndpoints(trace: SolvedTracePath): Point[] {
    if (!trace.tracePath || trace.tracePath.length < 2) {
      return []
    }
    return [trace.tracePath[0], trace.tracePath[trace.tracePath.length - 1]]
  }

  /**
   * Calculate distance between two points
   */
  private distance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Merge multiple traces into a single trace
   */
  private mergeTraces(traces: SolvedTracePath[]): SolvedTracePath {
    if (traces.length === 0) {
      throw new Error("Cannot merge empty traces")
    }
    if (traces.length === 1) {
      return traces[0]
    }

    // Sort traces by their first endpoint position
    const sorted = [...traces].sort((a, b) => {
      const aStart = a.tracePath[0]
      const bStart = b.tracePath[0]
      return (aStart?.x ?? 0) - (bStart?.x ?? 0) || (aStart?.y ?? 0) - (bStart?.y ?? 0)
    })

    // Build new trace path by connecting traces
    let newPath: Point[] = []
    const allMspPairIds: string[] = []
    const allPinIds: string[] = []

    for (const trace of sorted) {
      allMspPairIds.push(...(trace.mspConnectionPairIds ?? [trace.mspPairId]))
      allPinIds.push(...(trace.pinIds ?? []))
    }

    // Simple concatenation - in a more sophisticated implementation,
    // we would find the optimal way to connect the traces
    for (let i = 0; i < sorted.length; i++) {
      const trace = sorted[i]
      const path = trace.tracePath

      if (i === 0) {
        newPath = [...path]
      } else {
        // Connect this trace to the current path
        const lastPoint = newPath[newPath.length - 1]
        const firstPoint = path[0]

        // Add a connecting segment if needed
        if (this.distance(lastPoint, firstPoint) > 0.1) {
          // Add a simple L-shaped connection
          newPath.push({ x: firstPoint.x, y: lastPoint.y })
        }

        // Add the rest of the path (skip the first point as it's already connected)
        newPath.push(...path.slice(1))
      }
    }

    // Use the first trace as base and merge properties
    const baseTrace = sorted[0]

    return {
      ...baseTrace,
      tracePath: newPath,
      mspConnectionPairIds: allMspPairIds,
      pinIds: [...new Set(allPinIds)], // Remove duplicates
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
      texts: [],
    }

    // Visualize all traces
    for (const trace of this.outputTraces) {
      if (!trace.tracePath || trace.tracePath.length < 2) continue

      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      }
      graphics.lines!.push(line)

      // Add points for endpoints
      for (const point of [trace.tracePath[0], trace.tracePath[trace.tracePath.length - 1]]) {
        graphics.points!.push({
          x: point.x,
          y: point.y,
        })
      }
    }

    return graphics
  }
}
