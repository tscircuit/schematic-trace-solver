import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "../NetLabelPlacementSolver"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { FacingDirection } from "lib/utils/dir"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

export const NET_LABEL_HORIZONTAL_WIDTH = 0.4
export const NET_LABEL_HORIZONTAL_HEIGHT = 0.2
// NOTE: net labels, when in the y+/y- orientation, are rotated and therefore
// the width/height are swapped

/**
 * Find a location in the overlappingSameNetTraceGroup where a net label should
 * be placed. We do this by looking for the largest chip, and starting our
 * search from the segment directly connected to the largest chip. We then
 * travel along the segment, moving to any connected segment. Each step, we
 * check a specific segment
 *
 * When checking a segment, we check the following locations with each
 * orientation:
 * - The start of the segment
 * - The start of the segment, plus the width of the net label
 * - The end of the segment
 * - The end of the segment, minus the width of the net label
 *
 * When checking a location, we check for the following:
 * 1. Would placing a net label at this location cause a collision with a chip?
 * 2. Would placing a net label at this location cause a collision with ANY
 *    trace? (Note: you must offset the anchor point slightly from the trace to
 *    avoid counting the point where the net label contacts the trace)
 *
 * The first location that satisfies the above conditions, in our traversal
 * order from the largest chip, is the location we return in netLabelPlacement
 */
export class SingleNetLabelPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  overlappingSameNetTraceGroup: OverlappingSameNetTraceGroup
  availableOrientations: Array<FacingDirection>

  chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  netLabelPlacement: NetLabelPlacement | null = null
  testedCandidates: Array<{
    center: { x: number; y: number }
    width: number
    height: number
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    anchor: { x: number; y: number }
    orientation: FacingDirection
    status: "ok" | "chip-collision" | "trace-collision" | "parallel-to-segment"
    hostSegIndex: number
  }> = []

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
    overlappingSameNetTraceGroup: OverlappingSameNetTraceGroup
    availableOrientations: FacingDirection[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.overlappingSameNetTraceGroup = params.overlappingSameNetTraceGroup
    this.availableOrientations = params.availableOrientations

    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
  }

  private getDimsForOrientation(orientation: FacingDirection) {
    if (orientation === "y+" || orientation === "y-") {
      return {
        width: NET_LABEL_HORIZONTAL_HEIGHT,
        height: NET_LABEL_HORIZONTAL_WIDTH,
      }
    }
    return {
      width: NET_LABEL_HORIZONTAL_WIDTH,
      height: NET_LABEL_HORIZONTAL_HEIGHT,
    }
  }

  private getCenterFromAnchor(
    anchor: { x: number; y: number },
    orientation: FacingDirection,
    width: number,
    height: number,
  ) {
    switch (orientation) {
      case "x+":
        return { x: anchor.x + width / 2, y: anchor.y }
      case "x-":
        return { x: anchor.x - width / 2, y: anchor.y }
      case "y+":
        return { x: anchor.x, y: anchor.y + height / 2 }
      case "y-":
        return { x: anchor.x, y: anchor.y - height / 2 }
    }
  }

  private getRectBounds(
    center: { x: number; y: number },
    w: number,
    h: number,
  ) {
    return {
      minX: center.x - w / 2,
      minY: center.y - h / 2,
      maxX: center.x + w / 2,
      maxY: center.y + h / 2,
    }
  }

  private segmentIntersectsRect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    rect: { minX: number; minY: number; maxX: number; maxY: number },
    EPS = 1e-9,
  ): boolean {
    const isVert = Math.abs(p1.x - p2.x) < EPS
    const isHorz = Math.abs(p1.y - p2.y) < EPS
    if (!isVert && !isHorz) return false

    if (isVert) {
      const x = p1.x
      if (x < rect.minX - EPS || x > rect.maxX + EPS) return false
      const segMinY = Math.min(p1.y, p2.y)
      const segMaxY = Math.max(p1.y, p2.y)
      const overlap =
        Math.min(segMaxY, rect.maxY) - Math.max(segMinY, rect.minY)
      return overlap > EPS
    } else {
      const y = p1.y
      if (y < rect.minY - EPS || y > rect.maxY + EPS) return false
      const segMinX = Math.min(p1.x, p2.x)
      const segMaxX = Math.max(p1.x, p2.x)
      const overlap =
        Math.min(segMaxX, rect.maxX) - Math.max(segMinX, rect.minX)
      return overlap > EPS
    }
  }

  private rectIntersectsAnyTrace(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    hostPathId: MspConnectionPairId,
    hostSegIndex: number,
  ): boolean {
    for (const [pairId, solved] of Object.entries(this.inputTraceMap)) {
      const pts = solved.tracePath
      for (let i = 0; i < pts.length - 1; i++) {
        if (pairId === hostPathId && i === hostSegIndex) continue
        if (this.segmentIntersectsRect(pts[i]!, pts[i + 1]!, bounds))
          return true
      }
    }
    return false
  }

  override _step() {
    if (this.netLabelPlacement) {
      this.solved = true
      return
    }

    // Prefer starting from the trace connected to the "largest" chip (most pins)
    const groupId = this.overlappingSameNetTraceGroup.globalConnNetId
    const chipsById: Record<string, InputChip> = Object.fromEntries(
      this.inputProblem.chips.map((c) => [c.chipId, c]),
    )
    const groupTraces = Object.values(this.inputTraceMap).filter(
      (t) => t.globalConnNetId === groupId,
    )
    const chipIdsInGroup = new Set<string>()
    for (const t of groupTraces) {
      chipIdsInGroup.add(t.pins[0].chipId)
      chipIdsInGroup.add(t.pins[1].chipId)
    }
    let largestChipId: string | null = null
    let largestPinCount = -1
    for (const id of chipIdsInGroup) {
      const chip = chipsById[id]
      const count = chip?.pins?.length ?? 0
      if (count > largestPinCount) {
        largestPinCount = count
        largestChipId = id
      }
    }
    const lengthOf = (path: SolvedTracePath) => {
      let sum = 0
      const pts = path.tracePath
      for (let i = 0; i < pts.length - 1; i++) {
        sum +=
          Math.abs(pts[i + 1]!.x - pts[i]!.x) +
          Math.abs(pts[i + 1]!.y - pts[i]!.y)
      }
      return sum
    }
    const hostCandidates =
      largestChipId == null
        ? []
        : groupTraces.filter(
            (t) =>
              t.pins[0].chipId === largestChipId ||
              t.pins[1].chipId === largestChipId,
          )
    let host =
      hostCandidates.length > 0
        ? hostCandidates.reduce((a, b) => (lengthOf(a) >= lengthOf(b) ? a : b))
        : this.overlappingSameNetTraceGroup.overlappingTraces

    // Ensure we traverse the host path starting at the segment attached to the largest chip's pin
    let pts = host.tracePath.slice()
    if (largestChipId) {
      const largePin =
        host.pins[0].chipId === largestChipId ? host.pins[0] : host.pins[1]
      const d0 =
        Math.abs(pts[0].x - largePin.x) + Math.abs(pts[0].y - largePin.y)
      const dL =
        Math.abs(pts[pts.length - 1].x - largePin.x) +
        Math.abs(pts[pts.length - 1].y - largePin.y)
      if (d0 > dL) {
        pts = pts.slice().reverse()
      }
    }

    const orientations =
      this.availableOrientations.length > 0
        ? this.availableOrientations
        : (["x+", "x-", "y+", "y-"] as FacingDirection[])

    const EPS = 1e-6
    const anchorsForSegment = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      // Start, midpoint, end
      return [
        { x: a.x, y: a.y },
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        { x: b.x, y: b.y },
      ]
    }

    for (let si = 0; si < pts.length - 1; si++) {
      const a = pts[si]!
      const b = pts[si + 1]!
      const isH = Math.abs(a.y - b.y) < EPS
      const isV = Math.abs(a.x - b.x) < EPS
      if (!isH && !isV) continue

      // Only consider orientations perpendicular to the segment to avoid
      // self-overlap with the host segment.
      const segmentAllowed: FacingDirection[] = isH
        ? (["y+", "y-"] as FacingDirection[])
        : (["x+", "x-"] as FacingDirection[])
      const candidateOrients = orientations.filter((o) =>
        segmentAllowed.includes(o),
      )
      if (candidateOrients.length === 0) continue

      const anchors = anchorsForSegment(a, b)
      for (const anchor of anchors) {
        for (const orientation of candidateOrients) {
          const { width, height } = this.getDimsForOrientation(orientation)
          const center = this.getCenterFromAnchor(
            anchor,
            orientation,
            width,
            height,
          )

          // Small outward offset to avoid counting the touching trace as a collision
          const outward =
            orientation === "x+"
              ? { x: 1, y: 0 }
              : orientation === "x-"
                ? { x: -1, y: 0 }
                : orientation === "y+"
                  ? { x: 0, y: 1 }
                  : { x: 0, y: -1 }
          const offset = 1e-4
          const testCenter = {
            x: center.x + outward.x * offset,
            y: center.y + outward.y * offset,
          }
          const bounds = this.getRectBounds(testCenter, width, height)

          // Chip collision check
          const chips = this.chipObstacleSpatialIndex.getChipsInBounds(bounds)
          if (chips.length > 0) {
            this.testedCandidates.push({
              center: testCenter,
              width,
              height,
              bounds,
              anchor,
              orientation,
              status: "chip-collision",
              hostSegIndex: si,
            })
            continue
          }

          // Trace collision check (ignore the host segment)
          if (this.rectIntersectsAnyTrace(bounds, host.mspPairId, si)) {
            this.testedCandidates.push({
              center: testCenter,
              width,
              height,
              bounds,
              anchor,
              orientation,
              status: "trace-collision",
              hostSegIndex: si,
            })
            continue
          }

          // Found a valid placement
          this.testedCandidates.push({
            center: testCenter,
            width,
            height,
            bounds,
            anchor,
            orientation,
            status: "ok",
            hostSegIndex: si,
          })

          this.netLabelPlacement = {
            globalConnNetId: this.overlappingSameNetTraceGroup.globalConnNetId,
            dcConnNetId: host.dcConnNetId,
            orientation,
            anchorPoint: anchor,
            width,
            height,
            center,
          }
          this.solved = true
          return
        }
      }
    }

    this.failed = true
    this.error = "Could not place net label without collisions"
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)

    // Visualize the entire trace group for this net id
    const groupId = this.overlappingSameNetTraceGroup.globalConnNetId
    // Choose host as in _step: the trace that touches the largest chip in the group
    const chipsById: Record<string, InputChip> = Object.fromEntries(
      this.inputProblem.chips.map((c) => [c.chipId, c]),
    )
    const groupTraces = Object.values(this.inputTraceMap).filter(
      (t) => t.globalConnNetId === groupId,
    )
    const chipIdsInGroup = new Set<string>()
    for (const t of groupTraces) {
      chipIdsInGroup.add(t.pins[0].chipId)
      chipIdsInGroup.add(t.pins[1].chipId)
    }
    let largestChipId: string | null = null
    let largestPinCount = -1
    for (const id of chipIdsInGroup) {
      const chip = chipsById[id]
      const count = chip?.pins?.length ?? 0
      if (count > largestPinCount) {
        largestPinCount = count
        largestChipId = id
      }
    }
    const lengthOf = (path: SolvedTracePath) => {
      let sum = 0
      const pts = path.tracePath
      for (let i = 0; i < pts.length - 1; i++) {
        sum +=
          Math.abs(pts[i + 1]!.x - pts[i]!.x) +
          Math.abs(pts[i + 1]!.y - pts[i]!.y)
      }
      return sum
    }
    const hostCandidates =
      largestChipId == null
        ? []
        : groupTraces.filter(
            (t) =>
              t.pins[0].chipId === largestChipId ||
              t.pins[1].chipId === largestChipId,
          )
    const host =
      hostCandidates.length > 0
        ? hostCandidates.reduce((a, b) => (lengthOf(a) >= lengthOf(b) ? a : b))
        : this.overlappingSameNetTraceGroup.overlappingTraces
    const groupStroke = getColorFromString(groupId, 0.9)
    const groupFill = getColorFromString(groupId, 0.5)

    for (const trace of Object.values(this.inputTraceMap)) {
      if (trace.globalConnNetId !== groupId) continue
      const isHost = trace.mspPairId === host.mspPairId
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: isHost ? groupStroke : groupFill,
        strokeWidth: isHost ? 0.006 : 0.003,
        strokeDash: isHost ? undefined : "4 2",
      } as any)
    }

    // Visualize all tested candidate rectangles with reason coloring
    for (const c of this.testedCandidates) {
      const fill =
        c.status === "ok"
          ? "rgba(0, 180, 0, 0.25)"
          : c.status === "chip-collision"
            ? "rgba(220, 0, 0, 0.25)"
            : c.status === "trace-collision"
              ? "rgba(220, 140, 0, 0.25)"
              : "rgba(120, 120, 120, 0.15)"
      const stroke =
        c.status === "ok"
          ? "green"
          : c.status === "chip-collision"
            ? "red"
            : c.status === "trace-collision"
              ? "orange"
              : "gray"

      graphics.rects!.push({
        center: {
          x: (c.bounds.minX + c.bounds.maxX) / 2,
          y: (c.bounds.minY + c.bounds.maxY) / 2,
        },
        width: c.width,
        height: c.height,
        fill,
        strokeColor: stroke,
      } as any)

      graphics.points!.push({
        x: c.anchor.x,
        y: c.anchor.y,
        color: stroke,
      } as any)
    }

    // Visualize the final accepted label (if any)
    if (this.netLabelPlacement) {
      const p = this.netLabelPlacement
      graphics.rects!.push({
        center: p.center,
        width: p.width,
        height: p.height,
        fill: "rgba(0, 128, 255, 0.35)",
        strokeColor: "blue",
      } as any)
      graphics.points!.push({
        x: p.anchorPoint.x,
        y: p.anchorPoint.y,
        color: "blue",
      } as any)
    }

    return graphics
  }
}
