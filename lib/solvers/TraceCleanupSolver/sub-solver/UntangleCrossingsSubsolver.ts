import { BaseSolver } from "../../BaseSolver/BaseSolver"
import type { InputProblem } from "../../../types/InputProblem"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTraceSingleLineSolver2 } from "../../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { ChipWithBounds } from "../../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { getObstacleRects } from "../../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { isPathColliding } from "./isPathColliding"
import type { GraphicsObject } from "graphics-debug"

/**
 * UntangleCrossingsSubsolver identifies traces that cross each other and
 * attempts to reroute them to eliminate the crossings.
 */
export class UntangleCrossingsSubsolver extends BaseSolver {
  private inputProblem: InputProblem
  private allTraces: SolvedTracePath[]
  private crossedTraceIds: string[] = []
  
  override activeSubSolver: SchematicTraceSingleLineSolver2 | null = null
  private currentTraceId: string | null = null

  constructor(params: {
    inputProblem: InputProblem
    allTraces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.allTraces = [...params.allTraces]
    
    // Identify traces that have crossings
    for (const trace of this.allTraces) {
      const collision = isPathColliding(trace.tracePath, this.allTraces, trace.mspPairId)
      if (collision.isColliding) {
        this.crossedTraceIds.push(trace.mspPairId as string)
      }
    }
  }

  private getTraceObstacles(excludeTraceId: string): ChipWithBounds[] {
    const obstacles = getObstacleRects(this.inputProblem)
    const EPS = 0.01 // Very thin obstacles for traces
    
    for (const trace of this.allTraces) {
      if (trace.mspPairId === excludeTraceId) continue
      
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]
        const p2 = trace.tracePath[i + 1]
        obstacles.push({
          chipId: \`\${trace.mspPairId}_seg_\${i}\`,
          minX: Math.min(p1.x, p2.x) - EPS,
          maxX: Math.max(p1.x, p2.x) + EPS,
          minY: Math.min(p1.y, p2.y) - EPS,
          maxY: Math.max(p1.y, p2.y) + EPS,
        })
      }
    }
    return obstacles
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        const traceIndex = this.allTraces.findIndex(t => t.mspPairId === this.currentTraceId)
        if (traceIndex !== -1) {
          this.allTraces[traceIndex] = {
            ...this.allTraces[traceIndex],
            tracePath: this.activeSubSolver.solvedTracePath!
          }
        }
        this.activeSubSolver = null
        this.currentTraceId = null
      } else if (this.activeSubSolver.failed) {
        this.activeSubSolver = null
        this.currentTraceId = null
      }
      return
    }

    if (this.crossedTraceIds.length === 0) {
      this.solved = true
      return
    }

    this.currentTraceId = this.crossedTraceIds.shift()!
    const trace = this.allTraces.find(t => t.mspPairId === this.currentTraceId)!
    
    // Create a new single line solver that treats other traces as obstacles
    const chipMap = Object.fromEntries(this.inputProblem.chips.map(c => [c.chipId, c]))
    this.activeSubSolver = new SchematicTraceSingleLineSolver2({
      inputProblem: this.inputProblem,
      pins: trace.pins,
      chipMap
    })
    
    // Inject trace obstacles into the sub-solver
    // @ts-ignore - hacking in trace obstacles
    this.activeSubSolver.obstacles = this.getTraceObstacles(this.currentTraceId)
  }

  getOutput() {
    return { traces: this.allTraces }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) return this.activeSubSolver.visualize()
    return {}
  }
}
