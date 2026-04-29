import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"

const GAP_THRESHOLD = 0.15

export interface SameNetTraceMergeSolverInput {
  allTraces: SolvedTracePath[]
}

interface TraceSegment {
  trace: SolvedTracePath
  startPoint: Point
  endPoint: Point
  direction: "horizontal" | "vertical"
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  private outputTraces: SolvedTracePath[] = []

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
  }

  override getConstructorParams() {
    return {
      allTraces: this.input.allTraces,
    }
  }

  private getSegmentDirection(p1: Point, p2: Point): "horizontal" | "vertical" {
    return Math.abs(p1.y - p2.y) < 0.001 ? "horizontal" : "vertical"
  }

  private getSegments(): TraceSegment[] {
    const segments: TraceSegment[] = []
    for (const trace of this.input.allTraces) {
      const path = trace.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        segments.push({
          trace,
          startPoint: path[i],
          endPoint: path[i + 1],
          direction: this.getSegmentDirection(path[i], path[i + 1]),
        })
      }
    }
    return segments
  }

  private calculateGap(seg1: TraceSegment, seg2: TraceSegment): number {
    if (seg1.direction !== seg2.direction) return Infinity
    
    if (seg1.direction === "horizontal") {
      const y1 = seg1.startPoint.y
      const y2 = seg2.startPoint.y
      return Math.abs(y1 - y2)
    } else {
      const x1 = seg1.startPoint.x
      const x2 = seg2.startPoint.x
      return Math.abs(x1 - x2)
    }
  }

  private isSameNet(seg1: TraceSegment, seg2: TraceSegment): boolean {
    return seg1.trace.mspPairId === seg2.trace.mspPairId
  }

  private doSegmentsOverlap(seg1: TraceSegment, seg2: TraceSegment): boolean {
    if (seg1.direction === "horizontal") {
      const y1 = seg1.startPoint.y
      const y2 = seg2.startPoint.y
      if (Math.abs(y1 - y2) > GAP_THRESHOLD) return false
      
      const min1 = Math.min(seg1.startPoint.x, seg1.endPoint.x)
      const max1 = Math.max(seg1.startPoint.x, seg1.endPoint.x)
      const min2 = Math.min(seg2.startPoint.x, seg2.endPoint.x)
      const max2 = Math.max(seg2.startPoint.x, seg2.endPoint.x)
      
      return !(max1 < min2 || max2 < min1)
    } else {
      const x1 = seg1.startPoint.x
      const x2 = seg2.startPoint.x
      if (Math.abs(x1 - x2) > GAP_THRESHOLD) return false
      
      const min1 = Math.min(seg1.startPoint.y, seg1.endPoint.y)
      const max1 = Math.max(seg1.startPoint.y, seg1.endPoint.y)
      const min2 = Math.min(seg2.startPoint.y, seg2.endPoint.y)
      const max2 = Math.max(seg2.startPoint.y, seg2.endPoint.y)
      
      return !(max1 < min2 || max2 < min1)
    }
  }

  override _step() {
    const segments = this.getSegments()
    const mergedTraces = new Map<string, SolvedTracePath>()
    const usedSegments = new Set<number>()
    
    for (let i = 0; i < segments.length; i++) {
      if (usedSegments.has(i)) continue
      
      const currentSeg = segments[i]
      const sameNetCloseSegments: TraceSegment[] = [currentSeg]
      usedSegments.add(i)
      
      for (let j = 0; j < segments.length; j++) {
        if (usedSegments.has(j)) continue
        
        const otherSeg = segments[j]
        if (!this.isSameNet(currentSeg, otherSeg)) continue
        if (currentSeg.direction !== otherSeg.direction) continue
        
        const gap = this.calculateGap(currentSeg, otherSeg)
        if (gap <= GAP_THRESHOLD && this.doSegmentsOverlap(currentSeg, otherSeg)) {
          sameNetCloseSegments.push(otherSeg)
          usedSegments.add(j)
        }
      }
      
      if (sameNetCloseSegments.length > 1) {
        const combinedPath = this.combineSegments(sameNetCloseSegments)
        const firstSeg = sameNetCloseSegments[0]
        const mergedTrace: SolvedTracePath = {
          ...firstSeg.trace,
          tracePath: combinedPath,
        }
        mergedTraces.set(firstSeg.trace.mspPairId, mergedTrace)
      } else {
        mergedTraces.set(currentSeg.trace.mspPairId, currentSeg.trace)
      }
    }
    
    this.outputTraces = Array.from(mergedTraces.values())
    this.solved = true
  }

  private combineSegments(segments: TraceSegment[]): Point[] {
    if (segments.length === 0) return []
    
    const direction = segments[0].direction
    const allPoints: Point[] = []
    
    for (const seg of segments) {
      allPoints.push(seg.startPoint, seg.endPoint)
    }
    
    if (direction === "horizontal") {
      allPoints.sort((a, b) => a.x - b.x)
      const minX = allPoints[0].x
      const maxX = allPoints[allPoints.length - 1].x
      const y = segments[0].startPoint.y
      return [{ x: minX, y }, { x: maxX, y }]
    } else {
      allPoints.sort((a, b) => a.y - b.y)
      const minY = allPoints[0].y
      const maxY = allPoints[allPoints.length - 1].y
      const x = segments[0].startPoint.x
      return [{ x, y: minY }, { x, y: maxY }]
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
