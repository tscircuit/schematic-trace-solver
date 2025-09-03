import type { InputProblem } from "lib/types/InputProblem"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { FacingDirection } from "lib/utils/dir"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "../NetLabelPlacementSolver"
import {
  getDimsForOrientation,
  getCenterFromAnchor,
  getRectBounds,
} from "./geometry"
import { rectIntersectsAnyTrace } from "./collisions"

export function solveNetLabelPlacementForPortOnlyPin(params: {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  overlappingSameNetTraceGroup: OverlappingSameNetTraceGroup
  availableOrientations: FacingDirection[]
}): {
  placement: NetLabelPlacement | null
  testedCandidates: Array<{
    center: { x: number; y: number }
    width: number
    height: number
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    anchor: { x: number; y: number }
    orientation: FacingDirection
    status: "ok" | "chip-collision" | "trace-collision" | "parallel-to-segment"
    hostSegIndex: number
  }>
  error?: string
} {
  const {
    inputProblem,
    inputTraceMap,
    chipObstacleSpatialIndex,
    overlappingSameNetTraceGroup,
    availableOrientations,
  } = params

  const pinId = overlappingSameNetTraceGroup.portOnlyPinId
  if (!pinId) {
    return {
      placement: null,
      testedCandidates: [],
      error: "No portOnlyPinId provided",
    }
  }

  // Find pin coordinates
  let pin: { x: number; y: number } | null = null
  let pinChip: (typeof inputProblem.chips)[number] | null = null
  for (const chip of inputProblem.chips) {
    const p = chip.pins.find((pp) => pp.pinId === pinId)
    if (p) {
      pin = { x: p.x, y: p.y }
      pinChip = chip
      break
    }
  }
  if (!pin) {
    return {
      placement: null,
      testedCandidates: [],
      error: `Port-only pin not found: ${pinId}`,
    }
  }

  const orientations =
    availableOrientations.length > 0
      ? availableOrientations
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

  const LABEL_OFFSET = 1e-3
  const CHIP_CLEARANCE = 1e-3

  const testedCandidates: Array<{
    center: { x: number; y: number }
    width: number
    height: number
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    anchor: { x: number; y: number }
    orientation: FacingDirection
    status: "ok" | "chip-collision" | "trace-collision" | "parallel-to-segment"
    hostSegIndex: number
  }> = []

  // Helper to try placing a label at a given anchor
  const tryPlaceAtAnchor = (
    anchorX: number,
    anchorY: number,
    orientation: FacingDirection,
  ) => {
    const { width, height } = getDimsForOrientation(orientation)
    const outward = outwardOf(orientation)
    const unshiftedCenter = getCenterFromAnchor(
      { x: anchorX, y: anchorY },
      orientation,
      width,
      height,
    )
    const center = {
      x: unshiftedCenter.x + outward.x * LABEL_OFFSET,
      y: unshiftedCenter.y + outward.y * LABEL_OFFSET,
    }
    const bounds = getRectBounds(center, width, height)

    // Chip collision check
    const chipHits = chipObstacleSpatialIndex.getChipsInBounds(bounds)
    if (chipHits.length > 0) {
      testedCandidates.push({
        center,
        width,
        height,
        bounds,
        anchor: { x: anchorX, y: anchorY },
        orientation,
        status: "chip-collision",
        hostSegIndex: -1,
      })
      return { placement: null as NetLabelPlacement | null, width, height }
    }

    // Trace collision check
    if (
      rectIntersectsAnyTrace(
        bounds,
        inputTraceMap,
        "" as MspConnectionPairId,
        -1,
      )
    ) {
      testedCandidates.push({
        center,
        width,
        height,
        bounds,
        anchor: { x: anchorX, y: anchorY },
        orientation,
        status: "trace-collision",
        hostSegIndex: -1,
      })
      return { placement: null as NetLabelPlacement | null, width, height }
    }

    // Found a valid placement
    testedCandidates.push({
      center,
      width,
      height,
      bounds,
      anchor: { x: anchorX, y: anchorY },
      orientation,
      status: "ok",
      hostSegIndex: -1,
    })

    const placement: NetLabelPlacement = {
      globalConnNetId: overlappingSameNetTraceGroup.globalConnNetId,
      dcConnNetId: undefined,
      netId: overlappingSameNetTraceGroup.netId,
      mspConnectionPairIds: [],
      pinIds: [pinId],
      orientation,
      anchorPoint: { x: anchorX, y: anchorY },
      width,
      height,
      center,
    }
    return { placement, width, height }
  }

  const hasAvailabaleNetLabelOrientation = orientations.length === 1
  for (const orientation of orientations) {
    // 1) Try with the original anchor as-is
    const firstTry = tryPlaceAtAnchor(anchor.x, anchor.y, orientation)
    if (firstTry.placement)
      return { placement: firstTry.placement, testedCandidates }

    // 2) If a single specific orientation is required and it's vertical,
    //    allow a horizontal nudge to clear the chip.
    if (
      hasAvailabaleNetLabelOrientation &&
      (orientation === "y+" || orientation === "y-") &&
      pinChip
    ) {
      const halfWidth = pinChip.width / 2
      const chipMinX = pinChip.center.x - halfWidth
      const chipMaxX = pinChip.center.x + halfWidth
      const onLeftHalf = pin.x <= pinChip.center.x
      const width = firstTry.width

      let shiftedAnchorX = anchor.x
      if (onLeftHalf) {
        // Keep label entirely to the left of the chip with clearance
        const maxAllowedCenterX = chipMinX - CHIP_CLEARANCE - width / 2
        shiftedAnchorX = Math.min(anchor.x, maxAllowedCenterX)
      } else {
        // Keep label entirely to the right of the chip with clearance
        const minAllowedCenterX = chipMaxX + CHIP_CLEARANCE + width / 2
        shiftedAnchorX = Math.max(anchor.x, minAllowedCenterX)
      }

      if (Math.abs(shiftedAnchorX - anchor.x) > 1e-9) {
        const secondTry = tryPlaceAtAnchor(
          shiftedAnchorX,
          anchor.y,
          orientation,
        )
        if (secondTry.placement)
          return { placement: secondTry.placement, testedCandidates }
      }
    }
  }

  return {
    placement: null,
    testedCandidates,
    error: "Could not place net label at port without collisions",
  }
}
