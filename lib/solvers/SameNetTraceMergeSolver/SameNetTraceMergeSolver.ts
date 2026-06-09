import type { GraphicsObject, Line } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import {
  findSameNetSegmentMerge,
  getMergeMoveKey,
  type Bounds,
  type SameNetSegmentMerge,
} from "./findSameNetSegmentMerge"

export interface SameNetTraceMergeSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

/**
 * Pipeline phase that combines same-net trace segments that are close
 * together (see issues #29 and #34).
 *
 * Routing and post-processing can leave two parallel trace lines of the same
 * net almost — but not exactly — collinear: a long line ends up with a tiny
 * jog onto a neighboring line (#34), or a trace doubles back right next to
 * another same-net trace, drawing two redundant parallel lines (#29).
 *
 * Each step this solver finds one such pair and snaps one segment onto the
 * other's X (vertical) or Y (horizontal) coordinate, merging the two lines
 * into one. Pins / trace endpoints never move, so electrical connectivity is
 * preserved, and a merge is skipped when it would enter a chip body or land
 * on a different net's trace line.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[]

  /** Maximum distance between two same-net lines for them to be merged */
  MAX_MERGE_OFFSET = 0.09

  appliedMerges: SameNetSegmentMerge[] = []

  private chipObstacles: Bounds[]
  private anchorPoints: Point[]
  private forbiddenMoveKeys = new Set<string>()
  private maxMerges: number

  constructor(params: SameNetTraceMergeSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))

    this.chipObstacles = this.inputProblem.chips.map((chip) => ({
      minX: chip.center.x - chip.width / 2,
      maxX: chip.center.x + chip.width / 2,
      minY: chip.center.y - chip.height / 2,
      maxY: chip.center.y + chip.height / 2,
    }))

    this.anchorPoints = [
      ...this.inputProblem.chips.flatMap((chip) =>
        chip.pins.map((pin) => ({ x: pin.x, y: pin.y })),
      ),
      ...this.outputTraces.flatMap((trace) => {
        if (trace.tracePath.length === 0) return []
        return [
          trace.tracePath[0]!,
          trace.tracePath[trace.tracePath.length - 1]!,
        ]
      }),
    ]

    this.maxMerges =
      this.outputTraces.reduce(
        (acc, trace) => acc + Math.max(trace.tracePath.length - 1, 0),
        0,
      ) * 4
  }

  override _step() {
    if (this.appliedMerges.length >= this.maxMerges) {
      this.solved = true
      return
    }

    const merge = findSameNetSegmentMerge({
      traces: this.outputTraces,
      obstacles: this.chipObstacles,
      anchorPoints: this.anchorPoints,
      maxMergeOffset: this.MAX_MERGE_OFFSET,
      forbiddenMoveKeys: this.forbiddenMoveKeys,
    })

    if (!merge) {
      this.solved = true
      return
    }

    const trace = this.outputTraces[merge.traceIndex]!
    this.outputTraces[merge.traceIndex] = {
      ...trace,
      tracePath: merge.newTracePath,
    }
    // Forbid the reverse move so merges can't oscillate
    this.forbiddenMoveKeys.add(
      getMergeMoveKey(
        trace.mspPairId,
        merge.orientation,
        merge.toCoord,
        merge.fromCoord,
      ),
    )
    this.appliedMerges.push(merge)
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []

    const lastMerge = this.appliedMerges[this.appliedMerges.length - 1]
    for (let i = 0; i < this.outputTraces.length; i++) {
      const trace = this.outputTraces[i]!
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: lastMerge?.traceIndex === i ? "red" : "blue",
      }
      graphics.lines.push(line)
    }

    return graphics
  }
}
