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
import {
  getDimsForOrientation,
  getCenterFromAnchor,
  getRectBounds,
  NET_LABEL_HORIZONTAL_WIDTH,
  NET_LABEL_HORIZONTAL_HEIGHT,
} from "./geometry"
import { rectIntersectsAnyTrace } from "./collisions"
import { chooseHostTraceForGroup } from "./host"
import { anchorsForSegment } from "./anchors"

export {
  NET_LABEL_HORIZONTAL_WIDTH,
  NET_LABEL_HORIZONTAL_HEIGHT,
} from "./geometry"
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

  override _step() {
    if (this.netLabelPlacement) {
      this.solved = true
      return
    }

    // Handle port-only island (no traces) by placing a label at the port
    if (this.overlappingSameNetTraceGroup.portOnlyPinId) {
      const pinId = this.overlappingSameNetTraceGroup.portOnlyPinId
      // Find pin coordinates
      let pin: { x: number; y: number } | null = null
      for (const chip of this.inputProblem.chips) {
        const p = chip.pins.find((pp) => pp.pinId === pinId)
        if (p) {
          pin = { x: p.x, y: p.y }
          break
        }
      }
      if (!pin) {
        this.failed = true
        this.error = `Port-only pin not found: ${pinId}`
        return
      }

      const orientations =
        this.availableOrientations.length > 0
          ? this.availableOrientations
          : (["x+", "x-", "y+", "y-"] as FacingDirection[])

      const anchor = { x: pin.x, y: pin.y }
      const outwardOf = (o: FacingDirection) =>
        o === "x+"
          ? { x: 1, y: 0 }
          : o === "x-"
            ? { x: -1, y: 0 }
            : o === "y+"
              ? { x: 0, y: 1 }
              : { x: 0, y: -1 }

      for (const orientation of orientations) {
        const { width, height } = getDimsForOrientation(orientation)
        // Place label fully outside the chip: shift center slightly outward
        const baseCenter = getCenterFromAnchor(
          anchor,
          orientation,
          width,
          height,
        )
        const outward = outwardOf(orientation)
        const offset = 1e-3
        const center = {
          x: baseCenter.x + outward.x * offset,
          y: baseCenter.y + outward.y * offset,
        }
        const bounds = getRectBounds(center, width, height)

        // Chip collision check
        const chips = this.chipObstacleSpatialIndex.getChipsInBounds(bounds)
        if (chips.length > 0) {
          this.testedCandidates.push({
            center,
            width,
            height,
            bounds,
            anchor,
            orientation,
            status: "chip-collision",
            hostSegIndex: -1,
          })
          continue
        }

        // Trace collision check
        if (
          rectIntersectsAnyTrace(
            bounds,
            this.inputTraceMap,
            "" as MspConnectionPairId,
            -1,
          )
        ) {
          this.testedCandidates.push({
            center,
            width,
            height,
            bounds,
            anchor,
            orientation,
            status: "trace-collision",
            hostSegIndex: -1,
          })
          continue
        }

        // Found a valid placement
        this.testedCandidates.push({
          center,
          width,
          height,
          bounds,
          anchor,
          orientation,
          status: "ok",
          hostSegIndex: -1,
        })

        this.netLabelPlacement = {
          globalConnNetId: this.overlappingSameNetTraceGroup.globalConnNetId,
          dcConnNetId: undefined,
          orientation,
          anchorPoint: anchor,
          width,
          height,
          center,
        }
        this.solved = true
        return
      }

      this.failed = true
      this.error = "Could not place net label at port without collisions"
      return
    }

    // Prefer starting from the trace connected to the "largest" chip (most pins)
    const groupId = this.overlappingSameNetTraceGroup.globalConnNetId
    let host = chooseHostTraceForGroup({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      globalConnNetId: groupId,
      fallbackTrace: this.overlappingSameNetTraceGroup.overlappingTraces,
    })

    if (!host) {
      this.failed = true
      this.error = "No host trace found for net label placement"
      return
    }

    // Ensure we traverse the host path starting at the segment attached to the largest chip's pin
    let pts = host.tracePath.slice()

    const orientations =
      this.availableOrientations.length > 0
        ? this.availableOrientations
        : (["x+", "x-", "y+", "y-"] as FacingDirection[])

    const EPS = 1e-6

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
          const { width, height } = getDimsForOrientation(orientation)
          const center = getCenterFromAnchor(
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
          const bounds = getRectBounds(testCenter, width, height)

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
          if (
            rectIntersectsAnyTrace(
              bounds,
              this.inputTraceMap,
              host!.mspPairId,
              si,
            )
          ) {
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
            dcConnNetId: host!.dcConnNetId,
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
    const host = chooseHostTraceForGroup({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      globalConnNetId: groupId,
      fallbackTrace: this.overlappingSameNetTraceGroup.overlappingTraces,
    })
    const groupStroke = getColorFromString(groupId, 0.9)
    const groupFill = getColorFromString(groupId, 0.5)

    for (const trace of Object.values(this.inputTraceMap)) {
      if (trace.globalConnNetId !== groupId) continue
      const isHost = host ? trace.mspPairId === host.mspPairId : false
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
