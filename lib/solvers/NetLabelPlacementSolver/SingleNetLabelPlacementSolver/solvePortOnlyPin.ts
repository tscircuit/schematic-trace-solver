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

const NET_LABEL_EDGE_OFFSET = 0.01

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

  // Find pin coordinates and chip bounds
  let pin: { x: number; y: number } | null = null
  let pinChip: {
    center: { x: number; y: number }
    width: number
    height: number
  } | null = null
  for (const chip of inputProblem.chips) {
    const p = chip.pins.find((pp) => pp.pinId === pinId)
    if (p) {
      pin = { x: p.x, y: p.y }
      pinChip = { center: chip.center, width: chip.width, height: chip.height }
      break
    }
  }
  if (!pin || !pinChip) {
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

  const chipBounds = {
    minX: pinChip.center.x - pinChip.width / 2,
    maxX: pinChip.center.x + pinChip.width / 2,
    minY: pinChip.center.y - pinChip.height / 2,
    maxY: pinChip.center.y + pinChip.height / 2,
  }

  for (const orientation of orientations) {
    const { width, height } = getDimsForOrientation(orientation)

    const anchor: { x: number; y: number } = { x: pin.x, y: pin.y }

    const distanceToEdge =
      orientation === "x+"
        ? chipBounds.maxX - pin.x
        : orientation === "x-"
          ? pin.x - chipBounds.minX
          : orientation === "y+"
            ? chipBounds.maxY - pin.y
            : pin.y - chipBounds.minY

    const baseCenter = getCenterFromAnchor(anchor, orientation, width, height)
    const outward = outwardOf(orientation)
    const offset = distanceToEdge + NET_LABEL_EDGE_OFFSET

    console.debug(
      "[solvePortOnlyPin] orientation",
      orientation,
      "anchor",
      anchor,
      "distanceToEdge",
      distanceToEdge,
      "offset",
      offset,
    )

    const center = {
      x: baseCenter.x + outward.x * offset,
      y: baseCenter.y + outward.y * offset,
    }
    const bounds = getRectBounds(center, width, height)

    console.debug("[solvePortOnlyPin] center", center, "bounds", bounds)

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
      console.debug("[solvePortOnlyPin] chip collision")
      continue
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
        anchor,
        orientation,
        status: "trace-collision",
        hostSegIndex: -1,
      })
      console.debug("[solvePortOnlyPin] trace collision")
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

    console.debug("[solvePortOnlyPin] found valid placement")

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

  return {
    placement: null,
    testedCandidates,
    error: "Could not place net label at port without collisions",
  }
}
