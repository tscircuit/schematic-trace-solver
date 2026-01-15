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
const MERGE_DISTANCE = 0.05
const MAX_SHIFT_FOR_MERGE = 0.01

type ComponentBox = {
  center: { x: number; y: number }
  width: number
  height: number
  chipId?: string
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  private outputTraces: SolvedTracePath[]
  private componentBoxes: ComponentBox[]

  constructor(params: {
    traces: SolvedTracePath[]
    componentBoxes?: ComponentBox[]
  }) {
    super()
    this.inputTraces = params.traces
    this.outputTraces = []
    this.componentBoxes = params.componentBoxes ?? []
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      traces: this.inputTraces,
      componentBoxes: this.componentBoxes,
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
    enforceBoxSafety = true,
  ): {
    orientation: Orientation
    anchorCoord: number
  } | null {
    const segmentsA = this.getSegments(a.tracePath)
    const segmentsB = this.getSegments(b.tracePath)

    for (const sa of segmentsA) {
      for (const sb of segmentsB) {
        if (sa.orientation !== sb.orientation) continue

        if (sa.orientation === "horizontal") {
          const yDiff = Math.abs(sa.start.y - sb.start.y)
          if (yDiff >= MERGE_DISTANCE) continue
          if (yDiff > MAX_SHIFT_FOR_MERGE) continue

          const anchorCoord = sa.start.y
          const willShift = yDiff > EPS
          if (enforceBoxSafety) {
            if (willShift && this.componentBoxes.length === 0) continue
            if (
              willShift &&
              !this.isShiftSafe(
                "horizontal",
                anchorCoord,
                sa,
                sb,
                enforceBoxSafety,
              )
            ) {
              continue
            }
          }
          const overlap = this.rangesOverlap(
            sa.start.x,
            sa.end.x,
            sb.start.x,
            sb.end.x,
          )
          if (!overlap) continue
          return {
            orientation: "horizontal",
            anchorCoord,
          }
        } else {
          const xDiff = Math.abs(sa.start.x - sb.start.x)
          if (xDiff >= MERGE_DISTANCE) continue
          if (xDiff > MAX_SHIFT_FOR_MERGE) continue

          const anchorCoord = sa.start.x
          const willShift = xDiff > EPS
          if (enforceBoxSafety) {
            if (willShift && this.componentBoxes.length === 0) continue
            if (
              willShift &&
              !this.isShiftSafe(
                "vertical",
                anchorCoord,
                sa,
                sb,
                enforceBoxSafety,
              )
            ) {
              continue
            }
          }
          const overlap = this.rangesOverlap(
            sa.start.y,
            sa.end.y,
            sb.start.y,
            sb.end.y,
          )
          if (!overlap) continue
          return {
            orientation: "vertical",
            anchorCoord,
          }
        }
      }
    }

    return null
  }

  private isShiftSafe(
    orientation: Orientation,
    anchorCoord: number,
    sa: Segment,
    sb: Segment,
    enforceBoxSafety: boolean,
  ): boolean {
    if (!enforceBoxSafety || this.componentBoxes.length === 0) return true

    if (orientation === "horizontal") {
      const minX = Math.min(sa.start.x, sa.end.x, sb.start.x, sb.end.x)
      const maxX = Math.max(sa.start.x, sa.end.x, sb.start.x, sb.end.x)
      return !this.componentBoxes.some((box) =>
        this.horizontalSegmentIntersectsBoxInterior(
          anchorCoord,
          minX,
          maxX,
          box,
        ),
      )
    }

    const minY = Math.min(sa.start.y, sa.end.y, sb.start.y, sb.end.y)
    const maxY = Math.max(sa.start.y, sa.end.y, sb.start.y, sb.end.y)
    return !this.componentBoxes.some((box) =>
      this.verticalSegmentIntersectsBoxInterior(anchorCoord, minY, maxY, box),
    )
  }

  private horizontalSegmentIntersectsBoxInterior(
    y: number,
    x1: number,
    x2: number,
    box: ComponentBox,
  ): boolean {
    const halfW = box.width / 2
    const halfH = box.height / 2
    const minX = box.center.x - halfW
    const maxX = box.center.x + halfW
    const minY = box.center.y - halfH
    const maxY = box.center.y + halfH

    if (y <= minY + EPS || y >= maxY - EPS) return false
    const segMinX = Math.min(x1, x2)
    const segMaxX = Math.max(x1, x2)
    const overlap =
      Math.min(maxX - EPS, segMaxX) - Math.max(minX + EPS, segMinX)
    return overlap > EPS
  }

  private verticalSegmentIntersectsBoxInterior(
    x: number,
    y1: number,
    y2: number,
    box: ComponentBox,
  ): boolean {
    const halfW = box.width / 2
    const halfH = box.height / 2
    const minX = box.center.x - halfW
    const maxX = box.center.x + halfW
    const minY = box.center.y - halfH
    const maxY = box.center.y + halfH

    if (x <= minX + EPS || x >= maxX - EPS) return false
    const segMinY = Math.min(y1, y2)
    const segMaxY = Math.max(y1, y2)
    const overlap =
      Math.min(maxY - EPS, segMaxY) - Math.max(minY + EPS, segMinY)
    return overlap > EPS
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

  private pathIntersectsAnyBox(path: Point[]): boolean {
    if (this.componentBoxes.length === 0) return false

    const segments = this.getSegments(path)

    for (const segment of segments) {
      for (const box of this.componentBoxes) {
        const intersects =
          segment.orientation === "horizontal"
            ? this.horizontalSegmentIntersectsBoxInterior(
                segment.start.y,
                segment.start.x,
                segment.end.x,
                box,
              )
            : this.verticalSegmentIntersectsBoxInterior(
                segment.start.x,
                segment.start.y,
                segment.end.y,
                box,
              )

        if (intersects) return true
      }
    }

    return false
  }

  private pathHasOnlyOrthogonalSegments(path: Point[]): boolean {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!
      const b = path[i + 1]!
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)
      const isVertical = dx < EPS && dy > EPS
      const isHorizontal = dy < EPS && dx > EPS
      if (!isVertical && !isHorizontal) return false
    }
    return true
  }

  private isPathValid(path: Point[]): boolean {
    const avoidsInterior = !this.pathIntersectsAnyBox(path)
    const orthogonal = this.pathHasOnlyOrthogonalSegments(path)
    return avoidsInterior && orthogonal
  }

  private tryMergeTracePair(
    a: SolvedTracePath,
    b: SolvedTracePath,
    info: { orientation: Orientation; anchorCoord: number },
    enforceBoxSafety = true,
  ): SolvedTracePath | null {
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

    if (enforceBoxSafety && this.pathIntersectsAnyBox(mergedTracePath))
      return null

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

  private mergeNetTraces(
    traces: SolvedTracePath[],
    enforceBoxSafety: boolean,
  ): SolvedTracePath[] {
    const working = [...traces]

    let changed = true
    while (changed) {
      changed = false
      outer: for (let i = 0; i < working.length; i++) {
        for (let j = i + 1; j < working.length; j++) {
          const info = this.findMergeInfo(
            working[i]!,
            working[j]!,
            enforceBoxSafety,
          )
          if (!info) continue
          const merged = this.tryMergeTracePair(
            working[i]!,
            working[j]!,
            info,
            enforceBoxSafety,
          )
          if (!merged) continue
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
      const legacy = this.mergeNetTraces(grouped[netId]!, false)
      const legacyValid = legacy.every((trace) =>
        this.isPathValid(trace.tracePath),
      )

      if (legacyValid) {
        merged.push(...legacy)
      } else {
        merged.push(...this.mergeNetTraces(grouped[netId]!, true))
      }
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
