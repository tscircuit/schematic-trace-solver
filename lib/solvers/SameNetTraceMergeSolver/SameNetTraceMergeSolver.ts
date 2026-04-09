import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"

export interface SameNetTraceMergeSolverParams {
  inputProblem: InputProblem
  inputTraceMap: Record<string, SolvedTracePath>
  gapThreshold?: number
}

export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<string, SolvedTracePath>
  gapThreshold: number

  mergedTraceMap: Record<string, SolvedTracePath> = {}

  constructor(params: SameNetTraceMergeSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.gapThreshold = params.gapThreshold ?? 0.05
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      gapThreshold: this.gapThreshold,
    }
  }

  override _step() {
    const traces = Object.values(this.inputTraceMap)
    const tracesByNet: Record<string, SolvedTracePath[]> = {}

    for (const trace of traces) {
      const netId = trace.globalConnNetId ?? `no-net-${trace.mspPairId}`
      if (!tracesByNet[netId]) {
        tracesByNet[netId] = []
      }
      tracesByNet[netId].push(trace)
    }

    const resultTraceMap: Record<string, SolvedTracePath> = {}

    for (const netId in tracesByNet) {
      const netTraces = tracesByNet[netId]
      if (netTraces.length === 1 && !netTraces[0].globalConnNetId) {
        resultTraceMap[netTraces[0].mspPairId] = netTraces[0]
        continue
      }

      const mergedTracesForNet = this.mergeTracesForNet(netTraces)
      for (const trace of mergedTracesForNet) {
        resultTraceMap[trace.mspPairId] = trace
      }
    }

    this.mergedTraceMap = resultTraceMap
    this.solved = true
  }

  private mergeTracesForNet(traces: SolvedTracePath[]): SolvedTracePath[] {
    // 1. Decompose into segments
    interface Segment {
      p1: Point
      p2: Point
      originalTrace: SolvedTracePath
    }
    const segments: Segment[] = []
    for (const trace of traces) {
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        segments.push({
          p1: trace.tracePath[i],
          p2: trace.tracePath[i + 1],
          originalTrace: trace,
        })
      }
    }

    // 2. Separate horizontal and vertical segments
    const horizontal: Segment[] = []
    const vertical: Segment[] = []
    const others: Segment[] = []

    for (const seg of segments) {
      if (Math.abs(seg.p1.y - seg.p2.y) < 0.001) {
        horizontal.push(seg)
      } else if (Math.abs(seg.p1.x - seg.p2.x) < 0.001) {
        vertical.push(seg)
      } else {
        others.push(seg)
      }
    }

    // 3. Merge collinear segments
    const mergedHorizontal = this.mergeCollinearSegments(horizontal, "y", "x")
    const mergedVertical = this.mergeCollinearSegments(vertical, "x", "y")

    // 4. Reconstruct paths
    // In this solver, we can represent a net as a collection of segments.
    // However, the pipeline expects SolvedTracePath objects.
    // We can either:
    // a) Join segments into continuous paths
    // b) Return many 2-point paths (Simplest, but might break some assumptions)
    // c) Join segments and use the first mspPairId as the key
    
    // Let's try to join segments into paths using a simple graph approach
    return this.reconstructPaths(mergedHorizontal.concat(mergedVertical).concat(others), traces[0])
  }

  private mergeCollinearSegments(
    segments: any[],
    constAxis: "x" | "y",
    varAxis: "x" | "y"
  ): any[] {
    if (segments.length === 0) return []

    // Group by constant axis coordinate
    const groups: Record<string, any[]> = {}
    for (const seg of segments) {
      const coord = seg.p1[constAxis].toFixed(4)
      if (!groups[coord]) groups[coord] = []
      groups[coord].push(seg)
    }

    const mergedSegments: any[] = []

    for (const coord in groups) {
      const group = groups[coord]
      // Sort by variable axis
      group.sort((a, b) => Math.min(a.p1[varAxis], a.p2[varAxis]) - Math.min(b.p1[varAxis], b.p2[varAxis]))

      let current = {
        min: Math.min(group[0].p1[varAxis], group[0].p2[varAxis]),
        max: Math.max(group[0].p1[varAxis], group[0].p2[varAxis]),
        originalTraces: [group[0].originalTrace]
      }

      for (let i = 1; i < group.length; i++) {
        const seg = group[i]
        const sMin = Math.min(seg.p1[varAxis], seg.p2[varAxis])
        const sMax = Math.max(seg.p1[varAxis], seg.p2[varAxis])

        if (sMin <= current.max + this.gapThreshold) {
          // Merge
          current.max = Math.max(current.max, sMax)
          current.originalTraces.push(seg.originalTrace)
        } else {
          // Push current and start new
          mergedSegments.push(this.createSegment(current, constAxis, varAxis, parseFloat(coord)))
          current = { min: sMin, max: sMax, originalTraces: [seg.originalTrace] }
        }
      }
      mergedSegments.push(this.createSegment(current, constAxis, varAxis, parseFloat(coord)))
    }

    return mergedSegments
  }

  private createSegment(data: any, constAxis: "x" | "y", varAxis: "x" | "y", coord: number) {
    const p1: any = {}
    p1[constAxis] = coord
    p1[varAxis] = data.min

    const p2: any = {}
    p2[constAxis] = coord
    p2[varAxis] = data.max

    return {
      p1,
      p2,
      originalTraces: data.originalTraces
    }
  }

  private reconstructPaths(segments: any[], template: SolvedTracePath): SolvedTracePath[] {
    if (segments.length === 0) return []

    // Simple path reconstruction: 
    // For now, let's just return each merged segment as a SolvedTracePath
    // This is valid because SolvedTracePath can be a 2-point segment.
    // We must ensure the connectivity info is preserved.

    const result: SolvedTracePath[] = []
    
    // Group segments if they share an endpoint to create longer paths
    const pointToSegments: Map<string, any[]> = new Map()
    const getPtKey = (p: Point) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`

    for (const seg of segments) {
      const k1 = getPtKey(seg.p1)
      const k2 = getPtKey(seg.p2)
      if (!pointToSegments.has(k1)) pointToSegments.set(k1, [])
      if (!pointToSegments.has(k2)) pointToSegments.set(k2, [])
      pointToSegments.get(k1)!.push(seg)
      pointToSegments.get(k2)!.push(seg)
    }

    const visited = new Set<any>()
    for (const seg of segments) {
      if (visited.has(seg)) continue

      // Build a path starting from this segment
      const currentPath: any[] = [seg]
      visited.add(seg)

      // Try expanding in both directions
      this.expandPath(currentPath, pointToSegments, visited, true)
      this.expandPath(currentPath, pointToSegments, visited, false)

      // Convert segments to a sequence of points
      const tracePath: Point[] = this.segmentsToPoints(currentPath)
      
      // Collect all original data
      const allOriginalTraces = currentPath.flatMap(s => s.originalTraces)
      const mspConnectionPairIds = Array.from(new Set(allOriginalTraces.map(t => t.mspPairId)))
      const pinIds = Array.from(new Set(allOriginalTraces.flatMap(t => t.pinIds)))

      result.push({
        ...template,
        mspPairId: mspConnectionPairIds[0], // Use one as the primary ID
        tracePath,
        mspConnectionPairIds,
        pinIds,
      })
    }

    return result
  }

  private expandPath(path: any[], pointToSegments: Map<string, any[]>, visited: Set<any>, forward: boolean) {
    let changed = true
    while (changed) {
      changed = false
      const lastSeg = forward ? path[path.length - 1] : path[0]
      const prevSeg = forward ? (path.length > 1 ? path[path.length - 2] : null) : (path.length > 1 ? path[1] : null)
      
      // Find point to connect from
      let connectionPoint: Point
      if (!prevSeg) {
          // If only one segment, we can try either endpoint, but we pick p2 for forward and p1 for backward
          connectionPoint = forward ? lastSeg.p2 : lastSeg.p1
      } else {
          // Find which point of lastSeg is NOT shared with prevSeg
          const p1Matched = (lastSeg.p1.x === prevSeg.p1.x && lastSeg.p1.y === prevSeg.p1.y) || (lastSeg.p1.x === prevSeg.p2.x && lastSeg.p1.y === prevSeg.p2.y)
          connectionPoint = p1Matched ? lastSeg.p2 : lastSeg.p1
      }

      const key = `${connectionPoint.x.toFixed(4)},${connectionPoint.y.toFixed(4)}`
      const candidates = pointToSegments.get(key) || []
      
      for (const cand of candidates) {
        if (!visited.has(cand)) {
          visited.add(cand)
          if (forward) path.push(cand)
          else path.unshift(cand)
          changed = true
          break
        }
      }
    }
  }

  private segmentsToPoints(segments: any[]): Point[] {
    if (segments.length === 0) return []
    const points: Point[] = [segments[0].p1, segments[0].p2]
    
    for (let i = 1; i < segments.length; i++) {
        const prev = points[points.length - 1]
        const curr = segments[i]
        const p1Match = Math.abs(curr.p1.x - prev.x) < 0.001 && Math.abs(curr.p1.y - prev.y) < 0.001
        points.push(p1Match ? curr.p2 : curr.p1)
    }

    // Simplify collinear points in the final path
    const simplified: Point[] = [points[0]]
    for (let i = 1; i < points.length - 1; i++) {
        const p0 = simplified[simplified.length - 1]
        const p1 = points[i]
        const p2 = points[i+1]
        
        const isCollinearX = Math.abs(p0.x - p1.x) < 0.001 && Math.abs(p1.x - p2.x) < 0.001
        const isCollinearY = Math.abs(p0.y - p1.y) < 0.001 && Math.abs(p1.y - p2.y) < 0.001
        
        if (!isCollinearX && !isCollinearY) {
            simplified.push(p1)
        }
    }
    simplified.push(points[points.length - 1])
    
    return simplified
  }

  override visualize() {
    return {
      lines: Object.values(this.mergedTraceMap).map(t => ({
        points: t.tracePath,
        strokeColor: "purple",
      })),
    }
  }

  getOutput() {
    return {
      correctedTraceMap: this.mergedTraceMap,
    }
  }
}
