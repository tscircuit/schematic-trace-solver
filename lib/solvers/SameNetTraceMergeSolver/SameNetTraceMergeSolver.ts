import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"

export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>
  maxMergeDistance: number
  correctedTraceMap: Record<string, SolvedTracePath> = {}
  
  constructor(params: {
    inputProblem: InputProblem
    traces: Array<SolvedTracePath>
    maxMergeDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.traces
    this.maxMergeDistance = params.maxMergeDistance ?? 0.5
    for (const tracePath of this.inputTracePaths) {
      this.correctedTraceMap[tracePath.mspPairId] = { ...tracePath, tracePath: [...tracePath.tracePath] }
    }
  }

  override getConstructorParams(): ConstructorParameters<typeof SameNetTraceMergeSolver>[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTracePaths,
      maxMergeDistance: this.maxMergeDistance
    }
  }

  private _doesSegmentIntersectObstacles(
    p1: Point,
    p2: Point,
    staticObstacles: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
    otherTraces: Array<Point[]>,
    pad: number = 0.05
  ): boolean {
    const isHorizontal = Math.abs(p1.y - p2.y) < 1e-6
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)

    // Check static obstacles
    for (const obs of staticObstacles) {
      if (isHorizontal) {
        if (p1.y > obs.minY - pad && p1.y < obs.maxY + pad && maxX > obs.minX - pad && minX < obs.maxX + pad) {
          return true
        }
      } else {
        if (p1.x > obs.minX - pad && p1.x < obs.maxX + pad && maxY > obs.minY - pad && minY < obs.maxY + pad) {
          return true
        }
      }
    }

    // Check other traces (from different nets)
    // We treat other traces as thin lines, so we add padding.
    for (const trace of otherTraces) {
      for (let i = 0; i < trace.length - 1; i++) {
        const t1 = trace[i]!
        const t2 = trace[i + 1]!
        const tMinX = Math.min(t1.x, t2.x)
        const tMaxX = Math.max(t1.x, t2.x)
        const tMinY = Math.min(t1.y, t2.y)
        const tMaxY = Math.max(t1.y, t2.y)

        // Rect-Rect intersection using thin line rects
        if (
          minX - pad < tMaxX + pad &&
          maxX + pad > tMinX - pad &&
          minY - pad < tMaxY + pad &&
          maxY + pad > tMinY - pad
        ) {
          return true
        }
      }
    }
    return false
  }

  private _getOtherNetsTraces(currentNetId: string): Array<Point[]> {
    const traces: Array<Point[]> = []
    for (const path of Object.values(this.correctedTraceMap)) {
      if (path.globalConnNetId !== currentNetId) {
        traces.push(path.tracePath)
      }
    }
    return traces
  }

  override _step() {
    let madeChange = false
    const staticObstacles = getObstacleRects(this.inputProblem)

    const netGroups: Record<string, SolvedTracePath[]> = {}
    for (const path of Object.values(this.correctedTraceMap)) {
      const netId = path.globalConnNetId
      if (!netGroups[netId]) netGroups[netId] = []
      netGroups[netId].push(path)
    }

    for (const [netId, paths] of Object.entries(netGroups)) {
      if (paths.length < 2) continue

      const otherNetsTraces = this._getOtherNetsTraces(netId)

      for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
          const pathA = paths[i]!
          const pathB = paths[j]!

          for (let sa = 0; sa < pathA.tracePath.length - 1; sa++) {
            for (let sb = 0; sb < pathB.tracePath.length - 1; sb++) {
              const a1 = pathA.tracePath[sa]!
              const a2 = pathA.tracePath[sa + 1]!
              const b1 = pathB.tracePath[sb]!
              const b2 = pathB.tracePath[sb + 1]!

              const aVert = Math.abs(a1.x - a2.x) < 1e-6
              const aHorz = Math.abs(a1.y - a2.y) < 1e-6
              const bVert = Math.abs(b1.x - b2.x) < 1e-6
              const bHorz = Math.abs(b1.y - b2.y) < 1e-6

              if (aVert && bVert) {
                // Check if they are close in X and overlap in Y
                const distX = Math.abs(a1.x - b1.x)
                if (distX > 1e-6 && distX <= this.maxMergeDistance) {
                  const minYA = Math.min(a1.y, a2.y)
                  const maxYA = Math.max(a1.y, a2.y)
                  const minYB = Math.min(b1.y, b2.y)
                  const maxYB = Math.max(b1.y, b2.y)

                  if (Math.max(minYA, minYB) < Math.min(maxYA, maxYB)) {
                    // Overlap in Y. Try shifting A to B's X.
                    const newX = b1.x
                    let safe = true
                    const newA1 = { x: newX, y: a1.y }
                    const newA2 = { x: newX, y: a2.y }
                    
                    if (this._doesSegmentIntersectObstacles(newA1, newA2, staticObstacles, otherNetsTraces)) safe = false

                    if (sa > 0) {
                      const a0 = pathA.tracePath[sa - 1]!
                      if (this._doesSegmentIntersectObstacles(a0, newA1, staticObstacles, otherNetsTraces)) safe = false
                    }
                    if (sa < pathA.tracePath.length - 2) {
                      const a3 = pathA.tracePath[sa + 2]!
                      if (this._doesSegmentIntersectObstacles(newA2, a3, staticObstacles, otherNetsTraces)) safe = false
                    }

                    if (safe) {
                      // Apply shift
                      pathA.tracePath[sa] = newA1
                      pathA.tracePath[sa + 1] = newA2
                      madeChange = true
                      break
                    }
                  }
                }
              } else if (aHorz && bHorz) {
                // Check if they are close in Y and overlap in X
                const distY = Math.abs(a1.y - b1.y)
                if (distY > 1e-6 && distY <= this.maxMergeDistance) {
                  const minXA = Math.min(a1.x, a2.x)
                  const maxXA = Math.max(a1.x, a2.x)
                  const minXB = Math.min(b1.x, b2.x)
                  const maxXB = Math.max(b1.x, b2.x)

                  if (Math.max(minXA, minXB) < Math.min(maxXA, maxXB)) {
                    // Overlap in X. Try shifting A to B's Y.
                    const newY = b1.y
                    let safe = true
                    const newA1 = { x: a1.x, y: newY }
                    const newA2 = { x: a2.x, y: newY }
                    
                    if (this._doesSegmentIntersectObstacles(newA1, newA2, staticObstacles, otherNetsTraces)) safe = false

                    if (sa > 0) {
                      const a0 = pathA.tracePath[sa - 1]!
                      if (this._doesSegmentIntersectObstacles(a0, newA1, staticObstacles, otherNetsTraces)) safe = false
                    }
                    if (sa < pathA.tracePath.length - 2) {
                      const a3 = pathA.tracePath[sa + 2]!
                      if (this._doesSegmentIntersectObstacles(newA2, a3, staticObstacles, otherNetsTraces)) safe = false
                    }

                    if (safe) {
                      // Apply shift
                      pathA.tracePath[sa] = newA1
                      pathA.tracePath[sa + 1] = newA2
                      madeChange = true
                      break
                    }
                  }
                }
              }
            }
            if (madeChange) break
          }
          if (madeChange) break
        }
        if (madeChange) break
      }
      if (madeChange) break
    }

    if (!madeChange) {
      this.solved = true
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    graphics.lines = graphics.lines || []
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "magenta",
        strokeWidth: 0.05
      })
    }

    return graphics
  }

  getOutput() {
    return {
      traces: Object.values(this.correctedTraceMap)
    }
  }
}
