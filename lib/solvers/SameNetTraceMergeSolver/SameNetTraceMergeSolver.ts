import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

type Orientation = "horizontal" | "vertical"

type SegmentRecord = {
  mspPairId: MspConnectionPairId
  segmentIndex: number
  globalConnNetId: string
  orientation: Orientation
  coord: number
  min: number
  max: number
  length: number
}

const EPS = 1e-6

const getIntervalGap = (a: SegmentRecord, b: SegmentRecord) => {
  const overlap = Math.min(a.max, b.max) - Math.max(a.min, b.min)
  return overlap >= 0 ? 0 : -overlap
}

class UnionFind {
  parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(index: number): number {
    const parent = this.parent[index]!
    if (parent === index) return index
    const root = this.find(parent)
    this.parent[index] = root
    return root
  }

  union(a: number, b: number) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent[rootB] = rootA
  }
}

/**
 * Aligns close, parallel same-net trace segments onto the same axis.
 *
 * The pass is intentionally conservative: it only moves non-terminal segments,
 * so pin endpoints remain fixed. Moving an internal horizontal segment adjusts
 * its Y coordinate; moving an internal vertical segment adjusts its X coordinate.
 * Adjacent orthogonal segments stay connected through the shared points.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  SNAP_DISTANCE = 0.15
  MAX_INTERVAL_GAP = 0.15

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths

    for (const trace of this.inputTracePaths) {
      this.correctedTraceMap[trace.mspPairId] = {
        ...trace,
        tracePath: trace.tracePath.map((p) => ({ ...p })),
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
    }
  }

  private collectMovableSegments(): SegmentRecord[] {
    const segments: SegmentRecord[] = []

    for (const trace of Object.values(this.correctedTraceMap)) {
      const pts = trace.tracePath
      for (let i = 1; i < pts.length - 2; i++) {
        const start = pts[i]!
        const end = pts[i + 1]!
        const isHorizontal = Math.abs(start.y - end.y) < EPS
        const isVertical = Math.abs(start.x - end.x) < EPS
        if (!isHorizontal && !isVertical) continue

        const length = isHorizontal
          ? Math.abs(start.x - end.x)
          : Math.abs(start.y - end.y)
        if (length < EPS) continue

        segments.push({
          mspPairId: trace.mspPairId,
          segmentIndex: i,
          globalConnNetId: trace.globalConnNetId,
          orientation: isHorizontal ? "horizontal" : "vertical",
          coord: isHorizontal ? start.y : start.x,
          min: isHorizontal
            ? Math.min(start.x, end.x)
            : Math.min(start.y, end.y),
          max: isHorizontal
            ? Math.max(start.x, end.x)
            : Math.max(start.y, end.y),
          length,
        })
      }
    }

    return segments
  }

  private alignSegments(segments: SegmentRecord[]) {
    const uf = new UnionFind(segments.length)

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.globalConnNetId !== b.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue
        if (Math.abs(a.coord - b.coord) > this.SNAP_DISTANCE) continue
        if (getIntervalGap(a, b) > this.MAX_INTERVAL_GAP) continue
        uf.union(i, j)
      }
    }

    const groups = new Map<number, SegmentRecord[]>()
    for (let i = 0; i < segments.length; i++) {
      const root = uf.find(i)
      if (!groups.has(root)) groups.set(root, [])
      groups.get(root)!.push(segments[i]!)
    }

    let alignedSegments = 0
    for (const group of groups.values()) {
      if (group.length < 2) continue

      const target = group.reduce((best, candidate) =>
        candidate.length > best.length ? candidate : best,
      ).coord

      for (const segment of group) {
        if (Math.abs(segment.coord - target) < EPS) continue
        const trace = this.correctedTraceMap[segment.mspPairId]!
        const start = trace.tracePath[segment.segmentIndex]!
        const end = trace.tracePath[segment.segmentIndex + 1]!

        if (segment.orientation === "horizontal") {
          start.y = target
          end.y = target
        } else {
          start.x = target
          end.x = target
        }
        alignedSegments++
      }
    }

    return alignedSegments
  }

  override _step() {
    const segments = this.collectMovableSegments()
    const alignedSegments = this.alignSegments(segments)

    for (const trace of Object.values(this.correctedTraceMap)) {
      trace.tracePath = simplifyPath(trace.tracePath)
    }

    this.stats.alignedSegments = alignedSegments
    this.solved = true
  }

  override visualize(): GraphicsObject {
    if (!this.stats.alignedSegments) {
      return {
        lines: [],
        points: [],
        rects: [],
        circles: [],
      }
    }

    const graphics = visualizeInputProblem(this.inputProblem)

    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
