import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"

type ConnNetId = string

/**
 * This solver combines trace segments that belong to the same net and run
 * parallel very close to each other. Two traces of the same net can be solved
 * independently and end up nearly (but not exactly) coincident, which renders
 * as a cluttered double line.
 *
 * All traces are orthogonal, so two segments are considered combinable when
 * they are both horizontal (or both vertical), overlap along their shared axis
 * and are within COMBINE_DISTANCE of each other on the perpendicular axis.
 *
 * Each iteration we find one such pair and snap an interior segment onto the
 * other so they become coincident. Only interior segments are moved so the
 * trace endpoints (which sit on pins) stay fixed and the path stays orthogonal.
 */
export class SameNetTraceCombineSolver extends BaseSolver {
  inputProblem: InputProblem
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  COMBINE_DISTANCE = 0.2
  private readonly EPS = 2e-3

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  }) {
    super()
    this.inputProblem = params.inputProblem

    // Deep-clone the trace paths so we never mutate the upstream solver output.
    for (const [mspPairId, trace] of Object.entries(params.inputTraceMap)) {
      this.correctedTraceMap[mspPairId] = {
        ...trace,
        tracePath: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombineSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraceMap: this.correctedTraceMap,
    }
  }

  private computeNetIslands(): Record<ConnNetId, SolvedTracePath[]> {
    const islands: Record<ConnNetId, SolvedTracePath[]> = {}
    for (const trace of Object.values(this.correctedTraceMap)) {
      const key = trace.globalConnNetId
      if (!islands[key]) islands[key] = []
      islands[key].push(trace)
    }
    return islands
  }

  private overlaps1D(a1: number, a2: number, b1: number, b2: number): number {
    const minA = Math.min(a1, a2)
    const maxA = Math.max(a1, a2)
    const minB = Math.min(b1, b2)
    const maxB = Math.max(b1, b2)
    return Math.min(maxA, maxB) - Math.max(minA, minB)
  }

  /**
   * Finds and combines the next pair of close same-net parallel segments.
   * Returns true if a pair was combined.
   */
  private combineNextPair(): boolean {
    const islands = this.computeNetIslands()
    const EPS = this.EPS

    for (const paths of Object.values(islands)) {
      if (paths.length < 2) continue

      for (let pa = 0; pa < paths.length; pa++) {
        const ptsA = paths[pa]!.tracePath
        for (let sa = 0; sa < ptsA.length - 1; sa++) {
          const a1 = ptsA[sa]!
          const a2 = ptsA[sa + 1]!
          const aVert = Math.abs(a1.x - a2.x) < EPS
          const aHorz = Math.abs(a1.y - a2.y) < EPS
          if (!aVert && !aHorz) continue
          const aInterior = sa > 0 && sa + 1 < ptsA.length - 1

          for (let pb = 0; pb < paths.length; pb++) {
            // Only combine segments that belong to different traces of the net.
            if (pa === pb) continue
            const ptsB = paths[pb]!.tracePath
            for (let sb = 0; sb < ptsB.length - 1; sb++) {
              const b1 = ptsB[sb]!
              const b2 = ptsB[sb + 1]!
              const bVert = Math.abs(b1.x - b2.x) < EPS
              const bHorz = Math.abs(b1.y - b2.y) < EPS
              if (!bVert && !bHorz) continue
              const bInterior = sb > 0 && sb + 1 < ptsB.length - 1

              if (aVert && bVert) {
                const gap = Math.abs(a1.x - b1.x)
                if (gap <= EPS || gap > this.COMBINE_DISTANCE) continue
                if (this.overlaps1D(a1.y, a2.y, b1.y, b2.y) <= EPS) continue
                // Move an interior segment onto the other one's x.
                if (bInterior) {
                  b1.x = a1.x
                  b2.x = a1.x
                  return true
                }
                if (aInterior) {
                  a1.x = b1.x
                  a2.x = b1.x
                  return true
                }
              } else if (aHorz && bHorz) {
                const gap = Math.abs(a1.y - b1.y)
                if (gap <= EPS || gap > this.COMBINE_DISTANCE) continue
                if (this.overlaps1D(a1.x, a2.x, b1.x, b2.x) <= EPS) continue
                if (bInterior) {
                  b1.y = a1.y
                  b2.y = a1.y
                  return true
                }
                if (aInterior) {
                  a1.y = b1.y
                  a2.y = b1.y
                  return true
                }
              }
            }
          }
        }
      }
    }

    return false
  }

  override _step() {
    if (!this.combineNextPair()) {
      this.solved = true
    }
  }

  getOutput() {
    return {
      traces: Object.values(this.correctedTraceMap),
    }
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines = graphics.lines || []

    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
