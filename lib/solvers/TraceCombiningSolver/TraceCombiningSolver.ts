import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { InputProblem } from "../../types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

export interface TraceCombiningSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  threshold?: number
}

export class TraceCombiningSolver extends BaseSolver {
  input: TraceCombiningSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: TraceCombiningSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
  }

  override _step() {
    // Default threshold to 0.5 if not provided
    const threshold = this.input.threshold ?? 0.5
    const tracesByNet = new Map<string, SolvedTracePath[]>()

    // 1. Group traces by globalConnNetId to strictly only combine electrically connected nets
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!tracesByNet.has(netId)) {
        tracesByNet.set(netId, [])
      }
      tracesByNet.get(netId)!.push(trace)
    }

    let iterations = 0
    let somethingChanged = true

    // 2. Iteratively attempt to combine traces.
    // We loop because merging one set of segments might bring other segments into alignment.
    // We assume convergence is fast, so we cap at 10 iterations to prevent infinite loops (though unlikely).
    while (somethingChanged && iterations < 10) {
      somethingChanged = false
      iterations++

      for (const [netId, traces] of tracesByNet) {
        // Process both orthogonal directions.
        if (this.processDirection(traces, "horizontal", threshold))
          somethingChanged = true
        if (this.processDirection(traces, "vertical", threshold))
          somethingChanged = true
      }
    }

    this.solved = true
  }

  /**
   * Scans for parallel segments in the given direction and merges them if they are close and overlapping.
   * @param traces List of traces belonging to the same net
   * @param direction "horizontal" or "vertical" processing
   * @param threshold Max distance to consider for merging
   * @returns true if any segment coordinates were modified
   */
  processDirection(
    traces: SolvedTracePath[],
    direction: "horizontal" | "vertical",
    threshold: number,
  ): boolean {
    let modified = false

    // Structure to hold segment info
    const segments: {
      trace: SolvedTracePath
      index: number // index of the first point of the segment (p[i] -> p[i+1])
      val: number // constant coordinate (y for horizontal, x for vertical)
      start: number // variable coordinate start (min)
      end: number // variable coordinate end (max)
    }[] = []

    // A. Collect all strictly horizontal/vertical segments
    for (const trace of traces) {
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]
        const p2 = trace.tracePath[i + 1]

        if (direction === "horizontal") {
          // Check if segment is horizontal (y are equal)
          if (Math.abs(p1.y - p2.y) < 1e-6) {
            segments.push({
              trace,
              index: i,
              val: p1.y,
              start: Math.min(p1.x, p2.x),
              end: Math.max(p1.x, p2.x),
            })
          }
        } else {
          // Check if segment is vertical (x are equal)
          if (Math.abs(p1.x - p2.x) < 1e-6) {
            segments.push({
              trace,
              index: i,
              val: p1.x,
              start: Math.min(p1.y, p2.y),
              end: Math.max(p1.y, p2.y),
            })
          }
        }
      }
    }

    // B. Sort segments by their constant coordinate to efficiently find neighbors
    segments.sort((a, b) => a.val - b.val)

    // C. Group and merge close, overlapping segments
    // We use a greedy approach: take the first segment, find all compatible neighbors, merge, skip them.
    // Note: A more complex graph approach exists, but greedy is sufficient for "cleanup".
    const processed = new Set<number>() // indices of segments in the 'segments' array

    for (let i = 0; i < segments.length; i++) {
      if (processed.has(i)) continue

      const group = [segments[i]]
      processed.add(i)

      // Look ahead for close neighbors
      let j = i + 1
      while (
        j < segments.length &&
        segments[j].val - segments[i].val <= threshold
      ) {
        if (processed.has(j)) {
          j++
          continue
        }

        // Strict Overlap Check: Two segments must overlap in the variable dimension to be merged.
        // e.g.   |-------|
        //           |--------|
        // Result: Valid overlap.
        // e.g.   |---|
        //              |---|
        // Result: No overlap, should NOT merge (they are just parallel but distinct parts of the track).
        const overlapStart = Math.max(segments[i].start, segments[j].start)
        const overlapEnd = Math.min(segments[i].end, segments[j].end)

        if (overlapEnd > overlapStart) {
          // They overlap! Add to group.
          // Note: We only check overlap against the *first* segment of the group (segments[i]).
          // This creates a cluster centered around 'i'.
          // Ideally we should check if it overlaps with *any* in the group, but checking against 'i' keeps them localized.
          group.push(segments[j])
          processed.add(j)
        }
        j++
      }

      // D. Apply merging if we found a group
      if (group.length > 1) {
        // Calculate the centroid (average position) to snap all grouped segments to
        const targetVal =
          group.reduce((sum, s) => sum + s.val, 0) / group.length

        let groupModified = false

        for (const seg of group) {
          // If segment is not already at the target position, move it
          if (Math.abs(seg.val - targetVal) > 1e-6) {
            const p1 = seg.trace.tracePath[seg.index]
            const p2 = seg.trace.tracePath[seg.index + 1]

            // Modifying the point objects directly works because SolvedTracePath holds references to Points.
            // However, verify if points are shared. In this codebase, points seem to be distinct objects per path,
            // or at least modifying them for the trace path is the intended way to "move" the trace.
            if (direction === "horizontal") {
              p1.y = targetVal
              p2.y = targetVal
            } else {
              p1.x = targetVal
              p2.x = targetVal
            }
            groupModified = true
          }
        }

        if (groupModified) {
          modified = true
        }
      }
    }

    return modified
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
