import type { InputProblem } from "lib/types/InputProblem"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { FacingDirection } from "lib/utils/dir"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
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

  // Find pin coordinates and facing direction
  let pin: { x: number; y: number } | null = null
  let pinFacingDirection: FacingDirection | null = null
  for (const chip of inputProblem.chips) {
    const p = chip.pins.find((pp) => pp.pinId === pinId)
    if (p) {
      pin = { x: p.x, y: p.y }
      pinFacingDirection = p._facingDirection || getPinDirection(p, chip)
      break
    }
  }
  if (!pin || !pinFacingDirection) {
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

  for (const orientation of orientations) {
    const { width, height } = getDimsForOrientation(orientation)
    // Place label fully outside the chip: shift center slightly outward
    const baseCenter = getCenterFromAnchor(anchor, orientation, width, height)
    const outward = outwardOf(orientation)
    const offset = 1e-3
    const center = {
      x: baseCenter.x + outward.x * offset,
      y: baseCenter.y + outward.y * offset,
    }
    const bounds = getRectBounds(center, width, height)

    // Chip collision check
    const chips = chipObstacleSpatialIndex.getChipsInBounds(bounds)
    if (chips.length > 0) {
      testedCandidates.push({
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
    const traceIntersectionResult = rectIntersectsAnyTrace(
      bounds,
      inputTraceMap,
      "" as MspConnectionPairId,
      -1,
    )
    if (traceIntersectionResult.hasIntersection) {
      testedCandidates.push({
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
    testedCandidates.push({
      center,
      width,
      height,
      bounds,
      anchor,
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
      anchorPoint: anchor,
      width,
      height,
      center,
    }

    return { placement, testedCandidates }
  }

  // If no valid placements found, return placement using pin's facing direction
  const fallbackOrientation = pinFacingDirection
  const { width, height } = getDimsForOrientation(fallbackOrientation)
  const baseCenter = getCenterFromAnchor(
    anchor,
    fallbackOrientation,
    width,
    height,
  )
  const outward = outwardOf(fallbackOrientation)
  const offset = 1e-3
  const fallbackCenter = {
    x: baseCenter.x + outward.x * offset,
    y: baseCenter.y + outward.y * offset,
  }

  const fallbackPlacement: NetLabelPlacement = {
    globalConnNetId: overlappingSameNetTraceGroup.globalConnNetId,
    dcConnNetId: undefined,
    netId: overlappingSameNetTraceGroup.netId,
    mspConnectionPairIds: [],
    pinIds: [pinId],
    orientation: fallbackOrientation,
    anchorPoint: anchor,
    width,
    height,
    center: fallbackCenter,
  }

  return { placement: fallbackPlacement, testedCandidates }
}
