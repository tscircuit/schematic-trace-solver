import type { Bounds, Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

type StubDirection = "x+" | "x-" | "y+" | "y-"

const LABEL_CLEARANCE = 0.05
const MAX_OUTWARD_DISTANCE = 5

const getStubDirection = (path: [Point, Point]): StubDirection => {
  const [start, end] = path
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    return end.x >= start.x ? "x+" : "x-"
  }
  return end.y >= start.y ? "y+" : "y-"
}

const getInlineLabelBounds = (placement: InlineNetLabelPlacement): Bounds => {
  const renderedWidth =
    placement.axis === "y" ? placement.height : placement.width
  const renderedHeight =
    placement.axis === "y" ? placement.width : placement.height
  return {
    minX: placement.center.x - renderedWidth / 2,
    maxX: placement.center.x + renderedWidth / 2,
    minY: placement.center.y - renderedHeight / 2,
    maxY: placement.center.y + renderedHeight / 2,
  }
}

const getPathBounds = (path: Point[]): Bounds => ({
  minX: Math.min(...path.map((point) => point.x)),
  maxX: Math.max(...path.map((point) => point.x)),
  minY: Math.min(...path.map((point) => point.y)),
  maxY: Math.max(...path.map((point) => point.y)),
})

const doesPathIntersectBounds = (path: Point[], bounds: Bounds) => {
  for (let index = 0; index < path.length - 1; index++) {
    if (
      boundsOverlap(getPathBounds([path[index]!, path[index + 1]!]), bounds)
    ) {
      return true
    }
  }
  return false
}

const shiftPoint = (
  point: Point,
  direction: StubDirection,
  distance: number,
): Point => {
  switch (direction) {
    case "x+":
      return { x: point.x + distance, y: point.y }
    case "x-":
      return { x: point.x - distance, y: point.y }
    case "y+":
      return { x: point.x, y: point.y + distance }
    case "y-":
      return { x: point.x, y: point.y - distance }
  }
}

const shiftTerminalPlacement = (
  placement: InlineNetLabelPlacement,
  direction: StubDirection,
  distance: number,
): InlineNetLabelPlacement => {
  const [start, end] = placement.stubTracePath!
  const shiftedEnd = shiftPoint(end, direction, distance)
  return {
    ...placement,
    stubTracePath: [start, shiftedEnd],
    anchorPoint: shiftPoint(placement.anchorPoint, direction, distance),
    center: shiftPoint(placement.center, direction, distance),
  }
}

const getRequiredOutwardDistance = (
  movingBounds: Bounds,
  obstacleBounds: Bounds,
  direction: StubDirection,
) => {
  switch (direction) {
    case "x+":
      return obstacleBounds.maxX - movingBounds.minX + LABEL_CLEARANCE
    case "x-":
      return movingBounds.maxX - obstacleBounds.minX + LABEL_CLEARANCE
    case "y+":
      return obstacleBounds.maxY - movingBounds.minY + LABEL_CLEARANCE
    case "y-":
      return movingBounds.maxY - obstacleBounds.minY + LABEL_CLEARANCE
  }
}

/**
 * Moves a row of terminal inline labels farther outward when a retained
 * anchored label occupies their near-pin column. Every terminal on the same
 * component side moves together, preserving the row's alignment. Only the
 * newly added stub segment and shifted text are collision-checked; the
 * original pin-to-label segment was already validated when it was created.
 * All points and bounds are in schematic-world millimetres, with +x right and
 * +y up.
 */
export const pushInlineTerminalLabelsAwayFromAnchoredLabels = ({
  inputProblem,
  traces,
  anchoredNetLabelPlacements,
  inlineNetLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  anchoredNetLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}): {
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
  movedGroupCount: number
} => {
  const chipIdByPinId = new Map<string, string>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) chipIdByPinId.set(pin.pinId, chip.chipId)
  }

  const groups = new Map<
    string,
    Array<{
      placementIndex: number
      placement: InlineNetLabelPlacement
      direction: StubDirection
      ownerChipId?: string
    }>
  >()
  for (const [
    placementIndex,
    placement,
  ] of inlineNetLabelPlacements.entries()) {
    if (!placement.stubTracePath || placement.pinIds.length !== 1) continue
    const direction = getStubDirection(placement.stubTracePath)
    const ownerChipId = chipIdByPinId.get(placement.pinIds[0]!)
    const groupKey = `${ownerChipId ?? placement.pinIds[0]}::${direction}`
    const group = groups.get(groupKey) ?? []
    group.push({ placementIndex, placement, direction, ownerChipId })
    groups.set(groupKey, group)
  }

  const outputPlacements = [...inlineNetLabelPlacements]
  let movedGroupCount = 0

  for (const group of groups.values()) {
    const groupPlacementIndices = new Set(
      group.map(({ placementIndex }) => placementIndex),
    )
    const fixedInlinePlacements = outputPlacements.filter(
      (_, placementIndex) => !groupPlacementIndices.has(placementIndex),
    )
    const direction = group[0]!.direction
    let distance = 0

    for (
      let iteration = 0;
      iteration <= anchoredNetLabelPlacements.length;
      iteration++
    ) {
      let requiredAdditionalDistance = 0
      for (const { placement } of group) {
        const shiftedPlacement = shiftTerminalPlacement(
          placement,
          direction,
          distance,
        )
        const shiftedBounds = getInlineLabelBounds(shiftedPlacement)
        for (const anchoredPlacement of anchoredNetLabelPlacements) {
          if (anchoredPlacement.globalConnNetId === placement.globalConnNetId) {
            continue
          }
          const anchoredBounds =
            getAnchoredNetLabelRenderedBounds(anchoredPlacement)
          if (!boundsOverlap(shiftedBounds, anchoredBounds)) continue
          requiredAdditionalDistance = Math.max(
            requiredAdditionalDistance,
            getRequiredOutwardDistance(
              shiftedBounds,
              anchoredBounds,
              direction,
            ),
          )
        }
      }
      if (requiredAdditionalDistance <= 0) break
      distance += requiredAdditionalDistance
    }

    if (distance <= 0 || distance > MAX_OUTWARD_DISTANCE) continue

    const proposals = group.map(({ placement }) =>
      shiftTerminalPlacement(placement, direction, distance),
    )
    const hasConflict = proposals.some((proposal, proposalIndex) => {
      const originalPlacement = group[proposalIndex]!.placement
      const originalEnd = originalPlacement.stubTracePath![1]
      const shiftedEnd = proposal.stubTracePath![1]
      const addedStubSegment: [Point, Point] = [originalEnd, shiftedEnd]
      const labelBounds = getInlineLabelBounds(proposal)
      const ownerChipId = group[proposalIndex]!.ownerChipId

      if (
        anchoredNetLabelPlacements.some((anchoredPlacement) => {
          if (anchoredPlacement.globalConnNetId === proposal.globalConnNetId) {
            return false
          }
          const anchoredBounds =
            getAnchoredNetLabelRenderedBounds(anchoredPlacement)
          return (
            boundsOverlap(labelBounds, anchoredBounds) ||
            doesPathIntersectBounds(addedStubSegment, anchoredBounds)
          )
        })
      ) {
        return true
      }

      for (const chip of inputProblem.chips) {
        if (chip.chipId === ownerChipId) continue
        const chipBounds: Bounds = {
          minX: chip.center.x - chip.width / 2,
          maxX: chip.center.x + chip.width / 2,
          minY: chip.center.y - chip.height / 2,
          maxY: chip.center.y + chip.height / 2,
        }
        if (
          boundsOverlap(labelBounds, chipBounds) ||
          doesPathIntersectBounds(addedStubSegment, chipBounds)
        ) {
          return true
        }
      }

      for (const textBox of inputProblem.textBoxes ?? []) {
        const textBounds = getTextBoxBounds(textBox)
        if (
          boundsOverlap(labelBounds, textBounds) ||
          doesPathIntersectBounds(addedStubSegment, textBounds)
        ) {
          return true
        }
      }

      for (const trace of traces) {
        if (trace.globalConnNetId === proposal.globalConnNetId) continue
        if (
          doesPathIntersectBounds(trace.tracePath, labelBounds) ||
          doesPathIntersectBounds(
            trace.tracePath,
            getPathBounds(addedStubSegment),
          )
        ) {
          return true
        }
      }

      for (const fixedPlacement of fixedInlinePlacements) {
        const fixedBounds = getInlineLabelBounds(fixedPlacement)
        if (
          boundsOverlap(labelBounds, fixedBounds) ||
          doesPathIntersectBounds(addedStubSegment, fixedBounds) ||
          (fixedPlacement.stubTracePath &&
            doesPathIntersectBounds(fixedPlacement.stubTracePath, labelBounds))
        ) {
          return true
        }
      }

      return false
    })

    if (hasConflict) continue
    for (const [groupIndex, { placementIndex }] of group.entries()) {
      outputPlacements[placementIndex] = proposals[groupIndex]!
    }
    movedGroupCount++
  }

  return {
    inlineNetLabelPlacements: outputPlacements,
    movedGroupCount,
  }
}
