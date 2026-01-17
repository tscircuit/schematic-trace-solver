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
    // 1. Try connecting end-to-end (touching)
    let mergedPath = this.tryConnectTouchingTraces(t1.tracePath, t2.tracePath)

    // 2. If not touching, try merging close parallel traces
    if (!mergedPath) {
      mergedPath = this.tryCombineParallelTraces(t1.tracePath, t2.tracePath)
    }

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

  private tryConnectTouchingTraces(
    p1: { x: number; y: number }[],
    p2: { x: number; y: number }[],
  ): { x: number; y: number }[] | null {
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

    let merged = tryMerge(p1, p2)
    if (!merged) merged = tryMerge(p1, p2Rev)
    if (!merged) merged = tryMerge(p1Rev, p2)
    if (!merged) merged = tryMerge(p1Rev, p2Rev)

    return merged
  }

  private tryCombineParallelTraces(
    p1: { x: number; y: number }[],
    p2: { x: number; y: number }[],
  ): { x: number; y: number }[] | null {
    const CLOSE_THRESHOLD = 0.05 // Threshold for "close together"

    const isStraightLine = (path: { x: number; y: number }[]) => {
      if (path.length < 2) return null

      let isHoriz = true
      let isVert = true
      const y0 = path[0].y
      const x0 = path[0].x

      const xs = path.map((p) => p.x)
      const ys = path.map((p) => p.y)

      for (let i = 1; i < path.length; i++) {
        if (Math.abs(path[i].y - y0) > 1e-4) isHoriz = false
        if (Math.abs(path[i].x - x0) > 1e-4) isVert = false
      }

      if (isHoriz) {
        return {
          type: "h" as const,
          val: y0,
          min: Math.min(...xs),
          max: Math.max(...xs),
        }
      }
      if (isVert) {
        return {
          type: "v" as const,
          val: x0,
          min: Math.min(...ys),
          max: Math.max(...ys),
        }
      }
      return null
    }

    const info1 = isStraightLine(p1)
    const info2 = isStraightLine(p2)

    if (!info1 || !info2 || info1.type !== info2.type) return null

    // Check distance between parallel lines
    if (Math.abs(info1.val - info2.val) > CLOSE_THRESHOLD) return null

    // Check for overlap or touch (using small epsilon for touch)
    const overlapStart = Math.max(info1.min, info2.min)
    const overlapEnd = Math.min(info1.max, info2.max)

    // Epsilon choice: 1e-4. If overlapEnd >= overlapStart - epsilon, they at least touch.
    // If we want STRICTLY "close parallel" to imply some overlap:
    // If they are just touching tip-to-tip, `tryConnectTouchingTraces` should have handled it?
    // Not necessarily if they are slightly offset in Y (parallel offset but touching in X).
    // So let's allow "touching in projection" too.
    if (overlapEnd < overlapStart - 1e-4) return null

    // Align to average center
    const newVal = (info1.val + info2.val) / 2
    const newMin = Math.min(info1.min, info2.min)
    const newMax = Math.max(info1.max, info2.max)

    const newPath =
      info1.type === "h"
        ? [
          { x: newMin, y: newVal },
          { x: newMax, y: newVal },
        ]
        : [
          { x: newVal, y: newMin },
          { x: newVal, y: newMax },
        ]

    return newPath
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
