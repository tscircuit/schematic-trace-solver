import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"

export class TraceCombineSolver extends BaseSolver {
  inputTraces: SolvedTracePath[]
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[] = []

  constructor(params: {
    inputTraces: SolvedTracePath[]
    inputProblem: InputProblem
  }) {
    super()
    this.inputTraces = params.inputTraces
    this.inputProblem = params.inputProblem
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceCombineSolver
  >[0] {
    return {
      inputTraces: this.inputTraces,
      inputProblem: this.inputProblem,
    }
  }

  override _step() {
    // Group traces by netId
    const tracesByNet = new Map<string, SolvedTracePath[]>()

    for (const trace of this.inputTraces) {
      // Use globalConnNetId or dcConnNetId as the grouping key
      // Generally globalConnNetId is the best identifier for "same electrical net"
      const netId = trace.globalConnNetId || trace.dcConnNetId
      if (!tracesByNet.has(netId)) {
        tracesByNet.set(netId, [])
      }
      tracesByNet.get(netId)!.push(trace)
    }

    this.outputTraces = []

    for (const [netId, traces] of tracesByNet) {
      this.outputTraces.push(...this.combineTracesForNet(traces))
    }

    this.solved = true
  }

  private combineTracesForNet(traces: SolvedTracePath[]): SolvedTracePath[] {
    if (traces.length < 2) return traces

    let currentTraces = [...traces]
    let changed = true

    while (changed) {
      changed = false
      const nextTraces: SolvedTracePath[] = []
      const processed = new Set<number>()

      for (let i = 0; i < currentTraces.length; i++) {
        if (processed.has(i)) continue

        let mergedTrace = currentTraces[i]

        for (let j = i + 1; j < currentTraces.length; j++) {
          if (processed.has(j)) continue

          const otherTrace = currentTraces[j]

          const combined = this.tryCombineTraces(mergedTrace, otherTrace)

          if (combined) {
            mergedTrace = combined
            processed.add(j) // Mark as merged
            changed = true
          }
        }
        nextTraces.push(mergedTrace)
      }
      currentTraces = nextTraces
    }

    return currentTraces
  }

  private tryCombineTraces(
    t1: SolvedTracePath,
    t2: SolvedTracePath,
  ): SolvedTracePath | null {
    // Try all 4 combinations of connectivity:
    // End of t1 -> Start of t2
    // End of t1 -> End of t2 (reverse t2)
    // Start of t1 -> Start of t2 (reverse t1)
    // Start of t1 -> End of t2 (reverse t1, reverse t2? or just t2->t1)

    // Helper to check connection
    const checkConnection = (
      pathA: { x: number; y: number }[],
      pathB: { x: number; y: number }[],
    ) => {
      // Check if pathA ends where pathB starts
      // And potentially overlap
      const endA = pathA[pathA.length - 1]
      const startB = pathB[0]

      if (
        Math.abs(endA.x - startB.x) < 1e-4 &&
        Math.abs(endA.y - startB.y) < 1e-4
      ) {
        return { type: "touch" }
      }

      // Check for overlap
      // Iterate backwards from end of A, and forwards from start of B
      // to find matching sequence.
      // Simplified: Check if last segment of A overlaps first segment of B
      // Just basic endpoint check for now as reproduction case just meets at a point/segment.

      // If they share a segment:
      // pathA: ... -> P_pre -> P_end
      // pathB: P_start -> P_post -> ...
      // If P_end == P_start AND P_pre == P_post, they overlap.

      if (pathA.length > 1 && pathB.length > 1) {
        const prevA = pathA[pathA.length - 2]
        const nextB = pathB[1]

        // Compare (prevA->endA) with (startB->nextB)
        // If they are same segment, they overlap.
        // We know endA approx startB? No we need to check if they overlap.
        // If endA == nextB and prevA == startB? That's full overlap of segment.
        // But typically we look for:
        // A: ... -> X -> Y
        // B: X -> Y -> ...
        // OR
        // A: ... -> X -> Y
        // B: Y -> Z -> ... (Touch)

        // Let's rely on points being identical for overlap.
        // Find index in B where A ends?
      }
      return null
    }

    const p1 = t1.tracePath
    const p2 = t2.tracePath

    // Define reverse paths
    const p1Rev = [...p1].reverse()
    const p2Rev = [...p2].reverse()

    const tryMerge = (
      pathA: { x: number; y: number }[],
      pathB: { x: number; y: number }[],
    ) => {
      // Find finding common point
      // We want to merge if they share a sequence of points at the boundary.
      // Start from end of A, look for match in B's start.

      // Optimization: Only check if A's last point exists in B?
      // Or B's first point exists in A?
      // In the reproduction case:
      // A: ... -> P_overlap_start -> P_overlap_end
      // B: P_overlap_start -> P_overlap_end -> ... (Wait, B is reverse?)

      // Let's match from the End of A.
      // Iterate A backwards from end.
      for (let i = pathA.length - 1; i >= 0; i--) {
        const ptA = pathA[i]
        // Check if this point matches pathB[0]
        if (
          Math.abs(ptA.x - pathB[0].x) < 1e-4 &&
          Math.abs(ptA.y - pathB[0].y) < 1e-4
        ) {
          // Potential match point.
          // Verify if the sequence matches up to end of A
          // pathA[i ... end] should match pathB[0 ... len]
          const overlapLen = pathA.length - i
          if (overlapLen > pathB.length) continue // Can't overlap more than B has

          let match = true
          for (let k = 0; k < overlapLen; k++) {
            const pa = pathA[i + k]
            const pb = pathB[k]
            if (Math.abs(pa.x - pb.x) > 1e-4 || Math.abs(pa.y - pb.y) > 1e-4) {
              match = false
              break
            }
          }

          if (match) {
            // MERGE!
            // Result: pathA[0...i] + pathB
            // Ensure we don't duplicate the overlapping part?
            // pathA[0...i] excludes the matching start point pathA[i]?
            // So pathA.slice(0, i) + pathB.
            const newPath = [...pathA.slice(0, i), ...pathB]
            return newPath
          }
        }
      }
      return null
    }

    let mergedPath = tryMerge(p1, p2)
    if (!mergedPath) mergedPath = tryMerge(p1, p2Rev)
    if (!mergedPath) mergedPath = tryMerge(p1Rev, p2)
    if (!mergedPath) mergedPath = tryMerge(p1Rev, p2Rev)

    if (mergedPath) {
      return {
        ...t1,
        tracePath: mergedPath,
        mspConnectionPairIds: [
          ...t1.mspConnectionPairIds,
          ...t2.mspConnectionPairIds,
        ],
        pinIds: [...new Set([...t1.pinIds, ...t2.pinIds])],
      }
    }

    return null
  }

  override visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      texts: [],
    }

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "orange", // Distinct color for combined traces
        strokeWidth: 0.05,
      })
    }

    return graphics
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
