import type { GraphicsObject, Line, Point } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

type TraceSegment = {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  coord: number
  spanStart: number
  spanEnd: number
  length: number
  netId: string
}

interface SameNetTraceAlignmentSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  alignmentThreshold?: number
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

function getOrientation(a: Point, b: Point): SegmentOrientation | null {
  if (Math.abs(a.y - b.y) < 1e-6) return "horizontal"
  if (Math.abs(a.x - b.x) < 1e-6) return "vertical"
  return null
}

function getSegments(
  trace: SolvedTracePath,
  traceIndex: number,
): TraceSegment[] {
  const segments: TraceSegment[] = []
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const p1 = trace.tracePath[i]!
    const p2 = trace.tracePath[i + 1]!
    const orientation = getOrientation(p1, p2)
    if (!orientation) continue

    const isEndpointSegment = i === 0 || i === trace.tracePath.length - 2
    if (isEndpointSegment) continue

    const coord = orientation === "horizontal" ? p1.y : p1.x
    const spanStart =
      orientation === "horizontal" ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y)
    const spanEnd =
      orientation === "horizontal" ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y)
    const length = spanEnd - spanStart

    segments.push({
      traceIndex,
      segmentIndex: i,
      orientation,
      coord,
      spanStart,
      spanEnd,
      length,
      netId: trace.globalConnNetId,
    })
  }
  return segments
}

function spansOverlap(a: TraceSegment, b: TraceSegment) {
  const overlap =
    Math.min(a.spanEnd, b.spanEnd) - Math.max(a.spanStart, b.spanStart)
  return overlap
}

class UnionFind {
  private parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(value: number): number {
    if (this.parent[value] !== value) {
      this.parent[value] = this.find(this.parent[value]!)
    }
    return this.parent[value]!
  }

  union(a: number, b: number) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent[rootB] = rootA
    }
  }
}

export class SameNetTraceAlignmentSolver extends BaseSolver {
  private input: SameNetTraceAlignmentSolverInput
  private outputTraces: SolvedTracePath[]
  private alignmentThreshold: number

  constructor(input: SameNetTraceAlignmentSolverInput) {
    super()
    this.input = input
    this.outputTraces = structuredClone(input.traces)
    this.alignmentThreshold = input.alignmentThreshold ?? 0.08
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceAlignmentSolver
  >[0] {
    return this.input
  }

  private alignSegments() {
    const segmentsByNet = new Map<string, TraceSegment[]>()
    const modifiedTraceIndexes = new Set<number>()

    this.outputTraces.forEach((trace, traceIndex) => {
      for (const segment of getSegments(trace, traceIndex)) {
        if (!segmentsByNet.has(segment.netId)) {
          segmentsByNet.set(segment.netId, [])
        }
        segmentsByNet.get(segment.netId)!.push(segment)
      }
    })

    for (const segments of segmentsByNet.values()) {
      const byOrientation: Record<SegmentOrientation, TraceSegment[]> = {
        horizontal: [],
        vertical: [],
      }
      for (const segment of segments) {
        byOrientation[segment.orientation].push(segment)
      }

      for (const orientedSegments of Object.values(byOrientation)) {
        if (orientedSegments.length < 2) continue

        const uf = new UnionFind(orientedSegments.length)

        for (let i = 0; i < orientedSegments.length; i++) {
          for (let j = i + 1; j < orientedSegments.length; j++) {
            const a = orientedSegments[i]!
            const b = orientedSegments[j]!
            if (Math.abs(a.coord - b.coord) > this.alignmentThreshold) continue

            const overlap = spansOverlap(a, b)
            const minRequiredOverlap = Math.min(a.length, b.length) * 0.25
            if (overlap < minRequiredOverlap) continue

            uf.union(i, j)
          }
        }

        const clusters = new Map<number, TraceSegment[]>()
        orientedSegments.forEach((segment, index) => {
          const root = uf.find(index)
          if (!clusters.has(root)) clusters.set(root, [])
          clusters.get(root)!.push(segment)
        })

        for (const cluster of clusters.values()) {
          if (cluster.length < 2) continue

          const targetCoord = median(cluster.map((segment) => segment.coord))

          for (const segment of cluster) {
            const trace = this.outputTraces[segment.traceIndex]!
            const path = trace.tracePath
            const start = path[segment.segmentIndex]!
            const end = path[segment.segmentIndex + 1]!

            if (segment.orientation === "horizontal") {
              start.y = targetCoord
              end.y = targetCoord
            } else {
              start.x = targetCoord
              end.x = targetCoord
            }
            modifiedTraceIndexes.add(segment.traceIndex)
          }
        }
      }
    }

    for (const traceIndex of modifiedTraceIndexes) {
      const trace = this.outputTraces[traceIndex]!
      trace.tracePath = simplifyPath(trace.tracePath)
    }
  }

  override _step() {
    if (this.solved) return
    this.alignSegments()
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((point) => ({ x: point.x, y: point.y })),
        strokeColor: "blue",
      }
      graphics.lines.push(line)
    }

    return graphics
  }
}
