import type { Point } from "@tscircuit/math-utils"
import type { SolvedTrace } from "lib/types/SolvedTrace"

/**
 * Input for the TraceSegmentMergeSolver.
 * It expects an array of SolvedTrace objects.
 */
export interface TraceSegmentMergeSolverInput {
  traces: SolvedTrace[]
}

/**
 * The TraceSegmentMergeSolver is a pipeline phase responsible for
 * combining trace segments that belong to the same net and are
 * geometrically close to each other. This helps to consolidate
 * fragmented traces into longer, continuous paths.
 */
export class TraceSegmentMergeSolver {
  private traces: SolvedTrace[]
  // Defines the maximum distance between two trace endpoints for them to be considered "close"
  // and eligible for merging. This value might need tuning based on common coordinate systems.
  private readonly SNAP_THRESHOLD = 0.25

  constructor(input: TraceSegmentMergeSolverInput) {
    // Deep copy traces to ensure modifications don't affect the original input object
    this.traces = JSON.parse(JSON.stringify(input.traces)).map(
      (trace: SolvedTrace, i: number) => ({
        ...trace,
        // Ensure each trace has a unique ID, generating one if missing
        traceId: trace.traceId || `trace-${i}-${Date.now()}`,
      }),
    )
  }

  /**
   * Executes the merging logic. It repeatedly attempts to merge traces
   * until a full pass yields no further merges.
   */
  solve(): void {
    let mergedOccurred = true
    while (mergedOccurred) {
      mergedOccurred = false
      const tracesByNet: { [netId: string]: SolvedTrace[] } = {}

      // Group traces by netId for efficient processing
      for (const trace of this.traces) {
        if (!tracesByNet[trace.netId]) {
          tracesByNet[trace.netId] = []
        }
        tracesByNet[trace.netId].push(trace)
      }

      const newTraces: SolvedTrace[] = []
      const mergedTraceIds = new Set<string>()

      for (const netId in tracesByNet) {
        const netTraces = tracesByNet[netId]
        if (netTraces.length <= 1) {
          // If only one or no traces in this net, add them directly
          netTraces.forEach((t) => {
            if (!mergedTraceIds.has(t.traceId!)) newTraces.push(t)
          })
          continue
        }

        // Attempt to merge traces within this net
        for (let i = 0; i < netTraces.length; i++) {
          const traceA = netTraces[i]
          if (mergedTraceIds.has(traceA.traceId!)) continue // Skip if traceA has already been merged

          for (let j = i + 1; j < netTraces.length; j++) {
            const traceB = netTraces[j]
            if (mergedTraceIds.has(traceB.traceId!)) continue // Skip if traceB has already been merged

            const mergedTrace = this.tryMergeTraces(traceA, traceB)
            if (mergedTrace) {
              newTraces.push(mergedTrace)
              mergedTraceIds.add(traceA.traceId!)
              mergedTraceIds.add(traceB.traceId!)
              mergedOccurred = true
              break // Break inner loop, as traceA has been merged, move to the next traceA
            }
          }
          // If traceA was not merged with any other trace, add it to the new list
          if (!mergedTraceIds.has(traceA.traceId!)) {
            newTraces.push(traceA)
          }
        }
      }
      this.traces = newTraces
    }
  }

  /**
   * Attempts to merge two traces if their endpoints are close enough.
   * Checks all four permutations of start/end points.
   * @param traceA The first trace.
   * @param traceB The second trace.
   * @returns A new merged trace if successful, otherwise null.
   */
  private tryMergeTraces(
    traceA: SolvedTrace,
    traceB: SolvedTrace,
  ): SolvedTrace | null {
    const pA_start = traceA.points[0]
    const pA_end = traceA.points[traceA.points.length - 1]
    const pB_start = traceB.points[0]
    const pB_end = traceB.points[traceB.points.length - 1]

    // Check pA_end to pB_start
    if (this.arePointsClose(pA_end, pB_start, this.SNAP_THRESHOLD)) {
      return this.createMergedTrace(traceA, traceB)
    }
    // Check pA_start to pB_end (reverse traceA relative to B)
    if (this.arePointsClose(pA_start, pB_end, this.SNAP_THRESHOLD)) {
      return this.createMergedTrace(traceB, traceA) // traceB then traceA
    }
    // Check pA_end to pB_end (reverse traceB)
    if (this.arePointsClose(pA_end, pB_end, this.SNAP_THRESHOLD)) {
      return this.createMergedTrace(traceA, this.reverseTrace(traceB))
    }
    // Check pA_start to pB_start (reverse traceA)
    if (this.arePointsClose(pA_start, pB_start, this.SNAP_THRESHOLD)) {
      return this.createMergedTrace(this.reverseTrace(traceA), traceB)
    }

    return null
  }

  /**
   * Creates a new trace by concatenating the points of two given traces.
   * It assumes the connection point is the start of the second trace and end of the first.
   * @param firstTrace The trace that comes first.
   * @param secondTrace The trace that comes second.
   * @returns A new SolvedTrace object representing the merged path.
   */
  private createMergedTrace(
    firstTrace: SolvedTrace,
    secondTrace: SolvedTrace,
  ): SolvedTrace {
    // Concatenate points, ensuring the connecting point is not duplicated
    const mergedPoints = [
      ...firstTrace.points,
      ...secondTrace.points.slice(1),
    ]

    return {
      ...firstTrace, // Inherit properties from the first trace
      points: mergedPoints,
      traceId: `${firstTrace.traceId!}-${secondTrace.traceId!}-merged`, // Generate a new ID for the combined trace
    }
  }

  /**
   * Reverses the order of points in a trace to effectively reverse its direction.
   * @param trace The trace to reverse.
   * @returns A new SolvedTrace object with points in reverse order.
   */
  private reverseTrace(trace: SolvedTrace): SolvedTrace {
    return {
      ...trace,
      points: [...trace.points].reverse(), // Create a new array for reversed points
    }
  }

  /**
   * Checks if two points are within a specified distance threshold of each other.
   * Uses squared distance for performance.
   * @param p1 The first point.
   * @param p2 The second point.
   * @param threshold The maximum allowed distance.
   * @returns True if points are close, false otherwise.
   */
  private arePointsClose(p1: Point, p2: Point, threshold: number): boolean {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return dx * dx + dy * dy < threshold * threshold
  }

  /**
   * Returns the array of traces after the merging process.
   * @returns The solved traces.
   */
  get andReturnSolution(): SolvedTrace[] {
    return this.traces
  }
}
