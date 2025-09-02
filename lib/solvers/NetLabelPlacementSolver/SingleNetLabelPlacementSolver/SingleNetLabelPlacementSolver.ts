import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "../NetLabelPlacementSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { FacingDirection } from "lib/utils/dir"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import {
  getDimsForOrientation,
  getCenterFromAnchor,
  getRectBounds,
} from "./geometry"
import { rectIntersectsAnyTrace } from "./collisions"
import { chooseHostTraceForGroup } from "./host"
import { anchorsForSegment } from "./anchors"
import { solveNetLabelPlacementForPortOnlyPin } from "./solvePortOnlyPin"
import { visualizeSingleNetLabelPlacementSolver } from "./SingleNetLabelPlacementSolver_visualize"

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
      const res = solveNetLabelPlacementForPortOnlyPin({
        inputProblem: this.inputProblem,
        inputTraceMap: this.inputTraceMap,
        chipObstacleSpatialIndex: this.chipObstacleSpatialIndex,
        overlappingSameNetTraceGroup: this.overlappingSameNetTraceGroup,
        availableOrientations: this.availableOrientations,
      })
      this.testedCandidates.push(...res.testedCandidates)
      if (res.placement) {
        this.netLabelPlacement = res.placement
        this.solved = true
        return
      }
      this.failed = true
      this.error =
        res.error ?? "Could not place net label at port without collisions"
      return
    }

    // Prefer starting from the trace connected to the "largest" chip (most pins)
    const groupId = this.overlappingSameNetTraceGroup.globalConnNetId
    let host = chooseHostTraceForGroup({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      globalConnNetId: groupId,
      fallbackTrace: this.overlappingSameNetTraceGroup.overlappingTraces,
      mspConnectionPairIds:
        this.overlappingSameNetTraceGroup.mspConnectionPairIds,
    })

    if (!host) {
      this.failed = true
      this.error = "No host trace found for net label placement"
      return
    }

    // Ensure we traverse the host path starting at the segment attached to the largest chip's pin
    const traceIdSet = new Set(
      this.overlappingSameNetTraceGroup.mspConnectionPairIds ?? [],
    )
    const tracesToScanBase = Object.values(this.inputTraceMap).filter(
      (t) =>
        t.globalConnNetId === groupId &&
        (traceIdSet.size === 0 ||
          t.mspConnectionPairIds.some((id) => traceIdSet.has(id))),
    )
    const tracesToScan =
      this.availableOrientations.length === 1
        ? [
            host,
            ...tracesToScanBase.filter((t) => t.mspPairId !== host!.mspPairId),
          ]
        : [host]

    const orientations =
      this.availableOrientations.length > 0
        ? this.availableOrientations
        : (["x+", "x-", "y+", "y-"] as FacingDirection[])

    const singleOrientationMode = this.availableOrientations.length === 1

    // For axis-aligned comparisons (furthest-point selection)
    const scoreFor = (
      orientation: FacingDirection,
      anchor: { x: number; y: number },
    ) => {
      switch (orientation) {
        case "y+":
          return anchor.y
        case "y-":
          return -anchor.y
        case "x+":
          return anchor.x
        case "x-":
          return -anchor.x
      }
    }
    let bestCandidate: {
      anchor: { x: number; y: number }
      orientation: FacingDirection
      width: number
      height: number
      center: { x: number; y: number }
      hostSegIndex: number
      dcConnNetId: string
      mspPairId: MspConnectionPairId
      pinIds: PinId[]
    } | null = null
    let bestScore = -Infinity

    const EPS = 1e-6

    for (const curr of tracesToScan) {
      const pts = curr.tracePath.slice()
      // Always prioritize horizontal labels by scanning vertical segments first
      const segmentIndices: number[] = []
      for (let segIdx = 0; segIdx < pts.length - 1; segIdx++)
        segmentIndices.push(segIdx)
      const verticalSegmentIndices: number[] = []
      const horizontalSegmentIndices: number[] = []
      for (const segIdx of segmentIndices) {
        const pointA = pts[segIdx]!
        const pointB = pts[segIdx + 1]!
        const isVertical = Math.abs(pointA.x - pointB.x) < EPS
        const isHorizontal = Math.abs(pointA.y - pointB.y) < EPS
        if (isVertical) verticalSegmentIndices.push(segIdx)
        else if (isHorizontal) horizontalSegmentIndices.push(segIdx)
      }
      const orderedSegmentIndices = [
        ...verticalSegmentIndices,
        ...horizontalSegmentIndices,
      ]

      for (const si of orderedSegmentIndices) {
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
                curr.mspPairId,
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

            if (singleOrientationMode) {
              const s = scoreFor(orientation, anchor)
              if (s > bestScore + 1e-9) {
                bestScore = s
                bestCandidate = {
                  anchor,
                  orientation,
                  width,
                  height,
                  center,
                  hostSegIndex: si,
                  dcConnNetId: curr.dcConnNetId,
                  mspPairId: curr.mspPairId,
                  pinIds: [curr.pins[0].pinId, curr.pins[1].pinId],
                }
              }
              // Continue traversing to prioritize the furthest valid point
              continue
            }

            this.netLabelPlacement = {
              globalConnNetId:
                this.overlappingSameNetTraceGroup.globalConnNetId,
              dcConnNetId: curr.dcConnNetId,
              netId: this.overlappingSameNetTraceGroup.netId,
              mspConnectionPairIds: [curr.mspPairId],
              pinIds: [curr.pins[0].pinId, curr.pins[1].pinId],
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
    }

    if (singleOrientationMode && bestCandidate) {
      this.netLabelPlacement = {
        globalConnNetId: this.overlappingSameNetTraceGroup.globalConnNetId,
        dcConnNetId: bestCandidate.dcConnNetId,
        netId: this.overlappingSameNetTraceGroup.netId,
        mspConnectionPairIds: [bestCandidate.mspPairId],
        pinIds: bestCandidate.pinIds,
        orientation: bestCandidate.orientation,
        anchorPoint: bestCandidate.anchor,
        width: bestCandidate.width,
        height: bestCandidate.height,
        center: bestCandidate.center,
      }
      this.solved = true
      return
    }

    this.failed = true
    this.error = "Could not place net label without collisions"
  }

  override visualize(): GraphicsObject {
    return visualizeSingleNetLabelPlacementSolver(this)
  }
}
