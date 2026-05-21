import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  type MergeSameNetTraceSegmentsOptions,
  mergeSameNetTraceSegments,
} from "./mergeSameNetTraceSegments"

export interface SameNetTraceMergeSolverInput
  extends MergeSameNetTraceSegmentsOptions {
  traces: SolvedTracePath[]
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
  }

  override _step() {
    const result = mergeSameNetTraceSegments(this.input.traces, this.input)
    this.outputTraces = result.traces
    this.stats.mergedSegmentCount = result.mergedSegmentCount
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics: GraphicsObject = { lines: [] }

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath,
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }

    return graphics
  }
}
