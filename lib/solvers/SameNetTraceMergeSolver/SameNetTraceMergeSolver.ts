import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { PinId } from "lib/types/InputProblem"

type Orientation = "horizontal" | "vertical"

type Segment = {
  start: Point
  end: Point
  orientation: Orientation
}

const EPS = 1e-6
const MERGE_DISTANCE = 0.15

export class SameNetTraceMergeSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  private outputTraces: SolvedTracePath[]

  constructor(params: { traces: SolvedTracePath[] }) {
    super()
    this.inputTraces = params.traces
    this.outputTraces = []
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      traces: this.inputTraces,
    }
  }

  private groupByNet(
    traces: SolvedTracePath[],
  ): Record<string, SolvedTracePath[]> {
    return traces.reduce<Record<string, SolvedTracePath[]>>((acc, trace) => {
      const key = trace.globalConnNetId
      if (!acc[key]) acc[key] = []
      acc[key]!.push(trace)
      return acc
    }, {})
  }

  private getSegments(path: Point[]): Segment[] {
    const segments: Segment[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i]!
      const end = path[i + 1]!
      const dx = end.x - start.x
      const dy = end.y - start.y
      if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) continue
      if (Math.abs(dy) < EPS) {
        segments.push({ start, end, orientation: "horizontal" })
      } else if (Math.abs(dx) < EPS) {
        segments.push({ start, end, orientation: "vertical" })
      }
    }
    return segments
  }

  private rangesOverlap(
    a1: number,
    a2: number,
    b1: number,
    b2: number,
  ): boolean {
    const minA = Math.min(a1, a2)
    const maxA = Math.max(a1, a2)
    const minB = Math.min(b1, b2)
    const maxB = Math.max(b1, b2)
    return Math.min(maxA, maxB) - Math.max(minA, minB) > EPS
  }

  private findMergeInfo(
    a: SolvedTracePath,
    b: SolvedTracePath,
  ):
    | {
        orientation: Orientation
        anchorCoord: number
      }
    | null {
    const segmentsA = this.getSegments(a.tracePath)
    const segmentsB = this.getSegments(b.tracePath)

    for (const sa of segmentsA) {
      for (const sb of segmentsB) {
        if (sa.orientation !== sb.orientation) continue

        if (sa.orientation === "horizontal") {
          const yDiff = Math.abs(sa.start.y - sb.start.y)
          if (yDiff >= MERGE_DISTANCE) continue
          const overlap = this.rangesOverlap(
            sa.start.x,
            sa.end.x,
            sb.start.x,
            sb.end.x,
          )
          if (!overlap) continue
          return {
            orientation: "horizontal",
            anchorCoord: (sa.start.y + sb.start.y) / 2,
          }
        } else {
          const xDiff = Math.abs(sa.start.x - sb.start.x)
          if (xDiff >= MERGE_DISTANCE) continue
          const overlap = this.rangesOverlap(
            sa.start.y,
            sa.end.y,
            sb.start.y,
            sb.end.y,
          )
          if (!overlap) continue
          return {
            orientation: "vertical",
            anchorCoord: (sa.start.x + sb.start.x) / 2,
          }
        }
      }
    }

    return null
  }

  private dedupePoints(points: Point[]): Point[] {
    if (points.length === 0) return points
    const deduped: Point[] = [points[0]!]
    for (let i = 1; i < points.length; i++) {
      const prev = deduped[deduped.length - 1]!
      const curr = points[i]!
      if (Math.abs(prev.x - curr.x) < EPS && Math.abs(prev.y - curr.y) < EPS) {
        continue
      }
      deduped.push(curr)
    }
    return deduped
  }

  private buildAnchoredPath(
    pins: Array<Point & { pinId: string }>,
    orientation: Orientation,
    anchorCoord: number,
  ): Point[] {
    if (pins.length === 0) return []

    const sorted =
      orientation === "horizontal"
        ? [...pins].sort((a, b) => a.x - b.x || a.y - b.y)
        : [...pins].sort((a, b) => a.y - b.y || a.x - b.x)

    const path: Point[] = [{ x: sorted[0]!.x, y: sorted[0]!.y }]

    for (let i = 1; i < sorted.length; i++) {
      const prev = path[path.length - 1]!
      const next = sorted[i]!

      if (orientation === "horizontal") {
        if (Math.abs(prev.y - anchorCoord) > EPS) {
          path.push({ x: prev.x, y: anchorCoord })
        }

        if (
          Math.abs(path[path.length - 1]!.x - next.x) > EPS ||
          Math.abs(path[path.length - 1]!.y - anchorCoord) > EPS
        ) {
          path.push({ x: next.x, y: anchorCoord })
        }

        if (Math.abs(next.y - anchorCoord) > EPS) {
          path.push({ x: next.x, y: next.y })
        }
      } else {
        if (Math.abs(prev.x - anchorCoord) > EPS) {
          path.push({ x: anchorCoord, y: prev.y })
        }

        if (
          Math.abs(path[path.length - 1]!.y - next.y) > EPS ||
          Math.abs(path[path.length - 1]!.x - anchorCoord) > EPS
        ) {
          path.push({ x: anchorCoord, y: next.y })
        }

        if (Math.abs(next.x - anchorCoord) > EPS) {
          path.push({ x: next.x, y: next.y })
        }
      }
    }

    return this.dedupePoints(path)
  }

  private mergeTracePair(
    a: SolvedTracePath,
    b: SolvedTracePath,
    info: { orientation: Orientation; anchorCoord: number },
  ): SolvedTracePath {
    const pinMap = new Map<string, Point & { pinId: string; chipId?: string }>()
    for (const pin of [...a.pins, ...b.pins]) {
      pinMap.set(pin.pinId, pin)
    }
    const mergedPins = Array.from(pinMap.values())

    const pinIds: PinId[] = Array.from(pinMap.keys())

    const mergedMspIds = new Set<MspConnectionPairId>([
      ...(a.mspConnectionPairIds ?? [a.mspPairId]),
      ...(b.mspConnectionPairIds ?? [b.mspPairId]),
    ])

    const mergedTracePath = this.buildAnchoredPath(
      mergedPins,
      info.orientation,
      info.anchorCoord,
    )

    const mergedPairId = `merged-${Array.from(mergedMspIds).sort().join("--")}`

    return {
      ...a,
      mspPairId: mergedPairId,
      mspConnectionPairIds: Array.from(mergedMspIds),
      pinIds,
      pins: mergedPins as SolvedTracePath["pins"],
      tracePath: mergedTracePath,
    }
  }

  private mergeNetTraces(traces: SolvedTracePath[]): SolvedTracePath[] {
    const working = [...traces]

    let changed = true
    while (changed) {
      changed = false
      outer: for (let i = 0; i < working.length; i++) {
        for (let j = i + 1; j < working.length; j++) {
          const info = this.findMergeInfo(working[i]!, working[j]!)
          if (!info) continue
          const merged = this.mergeTracePair(working[i]!, working[j]!, info)
          working.splice(j, 1)
          working[i] = merged
          changed = true
          break outer
        }
      }
    }

    return working
  }

  private mergeAll(): SolvedTracePath[] {
    const grouped = this.groupByNet(this.inputTraces)
    const merged: SolvedTracePath[] = []

    for (const netId of Object.keys(grouped)) {
      merged.push(...this.mergeNetTraces(grouped[netId]!))
    }

    return merged
  }

  override _step() {
    this.outputTraces = this.mergeAll()
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
