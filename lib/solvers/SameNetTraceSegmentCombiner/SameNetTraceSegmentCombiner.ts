import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { ConnectivityMap } from "connectivity-map"

type ConnNetId = string

/**
 * This solver finds trace segments that belong to the same net and are close
 * together (parallel and within a small distance), then combines them into
 * a single trace segment to reduce visual clutter and improve readability.
 *
 * For example, if two traces from the same net run parallel and close together:
 * Before: ===  ===  (two separate traces)
 * After:  ======     (one combined trace)
 */
export class SameNetTraceSegmentCombiner extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>
  globalConnMap: ConnectivityMap

  correctedTraceMap: Record<string, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: Array<SolvedTracePath>
    globalConnMap: ConnectivityMap
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.globalConnMap = params.globalConnMap

    for (const tracePath of this.inputTracePaths) {
      const { mspPairId } = tracePath
      this.correctedTraceMap[mspPairId] = tracePath
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceSegmentCombiner
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      globalConnMap: this.globalConnMap,
    }
  }

  /**
   * Group traces by their global connection net ID
   */
  private groupTracesByNet(): Record<ConnNetId, Array<SolvedTracePath>> {
    const groups: Record<ConnNetId, Array<SolvedTracePath>> = {}

    for (const trace of Object.values(this.correctedTraceMap)) {
      const netId = trace.globalConnNetId
      if (!groups[netId]) groups[netId] = []
      groups[netId].push(trace)
    }

    return groups
  }

  /**
   * Find parallel segments within the same net that are close together
   * and can be combined.
   */
  private findCombinableSegments(): Array<{
    traceA: SolvedTracePath
    traceB: SolvedTracePath
    segmentIndexA: number
    segmentIndexB: number
    combinedStart: { x: number; y: number }
    combinedEnd: { x: number; y: number }
  }> {
    const EPS = 0.1 // Distance threshold for "close together"
    const combinable: Array<{
      traceA: SolvedTracePath
      traceB: SolvedTracePath
      segmentIndexA: number
      segmentIndexB: number
      combinedStart: { x: number; y: number }
      combinedEnd: { x: number; y: number }
    }> = []

    const netGroups = this.groupTracesByNet()

    for (const [netId, traces] of Object.entries(netGroups)) {
      // Need at least 2 traces to combine
      if (traces.length < 2) continue

      // Compare each pair of traces in the same net
      for (let i = 0; i < traces.length; i++) {
        for (let j = i + 1; j < traces.length; j++) {
          const traceA = traces[i]!
          const traceB = traces[j]!

          const ptsA = traceA.tracePath
          const ptsB = traceB.tracePath

          // Check each segment pair
          for (let si = 0; si < ptsA.length - 1; si++) {
            for (let sj = 0; sj < ptsB.length - 1; sj++) {
              const a1 = ptsA[si]!
              const a2 = ptsA[si + 1]!
              const b1 = ptsB[sj]!
              const b2 = ptsB[sj + 1]!

              // Check if segments are horizontal (same Y)
              const aHorizontal = Math.abs(a1.y - a2.y) < 1e-6
              const bHorizontal = Math.abs(b1.y - b2.y) < 1e-6

              // Check if segments are vertical (same X)
              const aVertical = Math.abs(a1.x - a2.x) < 1e-6
              const bVertical = Math.abs(b1.x - b2.x) < 1e-6

              if (aHorizontal && bHorizontal) {
                // Both horizontal - check if they're at similar Y and overlapping in X
                const yDist = Math.abs(a1.y - b1.y)
                if (yDist < EPS && yDist > 1e-6) {
                  // Check X overlap
                  const minXa = Math.min(a1.x, a2.x)
                  const maxXa = Math.max(a1.x, a2.x)
                  const minXb = Math.min(b1.x, b2.x)
                  const maxXb = Math.max(b1.x, b2.x)

                  const overlapStart = Math.max(minXa, minXb)
                  const overlapEnd = Math.min(maxXa, maxXb)

                  if (overlapEnd > overlapStart + 1e-6) {
                    // Segments overlap in X and are close in Y - can combine
                    const avgY = (a1.y + b1.y) / 2
                    combinable.push({
                      traceA,
                      traceB,
                      segmentIndexA: si,
                      segmentIndexB: sj,
                      combinedStart: { x: overlapStart, y: avgY },
                      combinedEnd: { x: overlapEnd, y: avgY },
                    })
                  }
                }
              } else if (aVertical && bVertical) {
                // Both vertical - check if they're at similar X and overlapping in Y
                const xDist = Math.abs(a1.x - b1.x)
                if (xDist < EPS && xDist > 1e-6) {
                  // Check Y overlap
                  const minYa = Math.min(a1.y, a2.y)
                  const maxYa = Math.max(a1.y, a2.y)
                  const minYb = Math.min(b1.y, b2.y)
                  const maxYb = Math.max(b1.y, b2.y)

                  const overlapStart = Math.max(minYa, minYb)
                  const overlapEnd = Math.min(maxYa, maxYb)

                  if (overlapEnd > overlapStart + 1e-6) {
                    // Segments overlap in Y and are close in X - can combine
                    const avgX = (a1.x + b1.x) / 2
                    combinable.push({
                      traceA,
                      traceB,
                      segmentIndexA: si,
                      segmentIndexB: sj,
                      combinedStart: { x: avgX, y: overlapStart },
                      combinedEnd: { x: avgX, y: overlapEnd },
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    return combinable
  }

  override _step() {
    const combinable = this.findCombinableSegments()

    if (combinable.length === 0) {
      this.solved = true
      return
    }

    // Process the first combinable pair
    const { traceA, traceB, segmentIndexA, segmentIndexB, combinedStart, combinedEnd } = combinable[0]!

    // Modify traceA to use the combined segment
    const newTracePathA = [...traceA.tracePath]
    const newTracePathB = [...traceB.tracePath]

    // Replace the segment in traceA with the combined segment
    // We adjust the Y (for horizontal) or X (for vertical) to the average
    const ptsA = traceA.tracePath
    const a1 = ptsA[segmentIndexA]!
    const a2 = ptsA[segmentIndexA + 1]!
    const isHorizontal = Math.abs(a1.y - a2.y) < 1e-6

    const ptsB = traceB.tracePath
    const b1 = ptsB[segmentIndexB]!
    const b2 = ptsB[segmentIndexB + 1]!

    if (isHorizontal) {
      // Adjust Y to average
      const avgY = combinedStart.y
      // Update all points in traceA that have the same Y as this segment
      for (let i = 0; i < newTracePathA.length; i++) {
        if (Math.abs(newTracePathA[i]!.y - a1.y) < 1e-6) {
          newTracePathA[i] = { ...newTracePathA[i]!, y: avgY }
        }
      }
      // Update all points in traceB that have the same Y as this segment
      for (let i = 0; i < newTracePathB.length; i++) {
        if (Math.abs(newTracePathB[i]!.y - b1.y) < 1e-6) {
          newTracePathB[i] = { ...newTracePathB[i]!, y: avgY }
        }
      }
    } else {
      // Adjust X to average
      const avgX = combinedStart.x
      // Update all points in traceA that have the same X as this segment
      for (let i = 0; i < newTracePathA.length; i++) {
        if (Math.abs(newTracePathA[i]!.x - a1.x) < 1e-6) {
          newTracePathA[i] = { ...newTracePathA[i]!, x: avgX }
        }
      }
      // Update all points in traceB that have the same X as this segment
      for (let i = 0; i < newTracePathB.length; i++) {
        if (Math.abs(newTracePathB[i]!.x - b1.x) < 1e-6) {
          newTracePathB[i] = { ...newTracePathB[i]!, x: avgX }
        }
      }
    }

    // Update the corrected trace map
    this.correctedTraceMap[traceA.mspPairId] = {
      ...traceA,
      tracePath: newTracePathA,
    }
    this.correctedTraceMap[traceB.mspPairId] = {
      ...traceB,
      tracePath: newTracePathB,
    }
  }

  getOutput() {
    return {
      traces: Object.values(this.correctedTraceMap),
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)

    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []

    // Draw current corrected traces
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
