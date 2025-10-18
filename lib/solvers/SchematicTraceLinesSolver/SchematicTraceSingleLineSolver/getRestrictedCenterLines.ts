import type {
  ChipId,
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import { getPinDirection } from "./getPinDirection"

type ChipPin = InputPin & { chipId: ChipId }

/**
 * A line that should not be crossed by a trace segment.
 * This is used to prevent traces from crossing through the center of a chip when
 * connecting pins on that same chip. Right now this is only enabled when a chip
 * has multiple pins on at least one side.
 */
export type RestrictedCenterLine = {
  x?: number
  y?: number
  axes: Set<"x" | "y">
  bounds: ReturnType<typeof getInputChipBounds>
}

export const getRestrictedCenterLines = (params: {
  pins: Array<InputPin & { chipId: string }>
  inputProblem: InputProblem
  pinIdMap: Map<PinId, ChipPin>
  chipMap: Record<string, InputChip>
}): Map<ChipId, RestrictedCenterLine> => {
  const { pins, inputProblem, pinIdMap, chipMap } = params

  // Determine set of related pin IDs (closure over directConnections) for both endpoints
  const findAllDirectlyConnectedPins = (startPinId: string) => {
    const visited = new Set<string>()
    const queue: string[] = [startPinId]
    visited.add(startPinId)
    const directConns = inputProblem.directConnections || []
    while (queue.length) {
      const cur = queue.shift()!
      for (const dc of directConns) {
        if (dc.pinIds.includes(cur)) {
          for (const p of dc.pinIds) {
            if (!visited.has(p)) {
              visited.add(p)
              queue.push(p)
            }
          }
        }
      }
    }
    return visited
  }

  const p0 = pins[0].pinId
  const p1 = pins[1].pinId
  const relatedPinIds = new Set<string>([
    ...findAllDirectlyConnectedPins(p0),
    ...findAllDirectlyConnectedPins(p1),
  ])

  const restrictedCenterLines = new Map<ChipId, RestrictedCenterLine>()

  // Collect facing-signs per chip
  const chipFacingMap = new Map<
    string,
    {
      hasXPos?: boolean
      hasXNeg?: boolean
      hasYPos?: boolean
      hasYNeg?: boolean
      center: { x: number; y: number }
      counts?: { xPos: number; xNeg: number; yPos: number; yNeg: number }
    }
  >()

  const chipsOfFacingPins = new Set<string>(pins.map((p) => p.chipId))

  for (const pinId of relatedPinIds) {
    const pin = pinIdMap.get(pinId)
    if (!pin) continue
    const chip = chipMap[pin.chipId]
    if (!chip) continue
    const facing = pin._facingDirection ?? getPinDirection(pin, chip)
    let entry = chipFacingMap.get(chip.chipId)
    if (!entry) {
      entry = { center: chip.center }

      const counts = { xPos: 0, xNeg: 0, yPos: 0, yNeg: 0 }
      for (const cp of chip.pins) {
        const cpFacing = cp._facingDirection ?? getPinDirection(cp, chip)
        if (cpFacing === "x+") counts.xPos++
        if (cpFacing === "x-") counts.xNeg++
        if (cpFacing === "y+") counts.yPos++
        if (cpFacing === "y-") counts.yNeg++
      }
      entry.counts = counts

      chipFacingMap.set(chip.chipId, entry)
    }
    if (facing === "x+") entry.hasXPos = true
    if (facing === "x-") entry.hasXNeg = true
    if (facing === "y+") entry.hasYPos = true
    if (facing === "y-") entry.hasYNeg = true
  }

  // Only mark a center as restricted on an axis if both signs for that axis
  // are present among related pins on the chip.
  for (const [chipId, faces] of chipFacingMap) {
    const axes = new Set<"x" | "y">()
    const chip = chipMap[chipId]
    if (!chip) continue
    const bounds = getInputChipBounds(chip)
    const rcl: RestrictedCenterLine = { axes, bounds }

    // determine whether any side on this chip has more than one pin
    const counts = faces.counts
    const anySideHasMultiplePins = !!(
      counts &&
      (counts.xPos > 1 || counts.xNeg > 1 || counts.yPos > 1 || counts.yNeg > 1)
    )

    const skipCenterRestriction =
      !anySideHasMultiplePins && chipsOfFacingPins.has(chipId)

    if (!skipCenterRestriction) {
      if (faces.hasXPos && faces.hasXNeg) {
        rcl.x = faces.center.x
        axes.add("x")
      }
      if (faces.hasYPos && faces.hasYNeg) {
        rcl.y = faces.center.y
        axes.add("y")
      }
    }

    if (axes.size > 0) {
      restrictedCenterLines.set(chipId, rcl)
    }
  }

  return restrictedCenterLines
}
