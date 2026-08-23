import type { Bounds, Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

type StubDirection = "x+" | "x-" | "y+" | "y-"

const getStubDirection = (path: [Point, Point]): StubDirection | undefined => {
  const [start, end] = path
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    return end.x >= start.x ? "x+" : "x-"
  }
  return end.y >= start.y ? "y+" : "y-"
}

const getStubLength = (path: [Point, Point]) => {
  const [start, end] = path
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
}

const getLabelBounds = (placement: {
  center: Point
  width: number
  height: number
  axis?: "x" | "y"
}): Bounds => {
  const isVertical = placement.axis === "y"
  const width = isVertical ? placement.height : placement.width
  const height = isVertical ? placement.width : placement.height
  return {
    minX: placement.center.x - width / 2,
    maxX: placement.center.x + width / 2,
    minY: placement.center.y - height / 2,
    maxY: placement.center.y + height / 2,
  }
}

const getPathBounds = (path: Point[]): Bounds => ({
  minX: Math.min(...path.map((point) => point.x)),
  maxX: Math.max(...path.map((point) => point.x)),
  minY: Math.min(...path.map((point) => point.y)),
  maxY: Math.max(...path.map((point) => point.y)),
})

const doesPathIntersectBounds = (path: Point[], bounds: Bounds): boolean => {
  for (let index = 0; index < path.length - 1; index++) {
    const segmentBounds = getPathBounds([path[index]!, path[index + 1]!])
    if (boundsOverlap(segmentBounds, bounds)) return true
  }
  return false
}

const resizeStub = (
  placement: InlineNetLabelPlacement,
  direction: StubDirection,
  targetLength: number,
): InlineNetLabelPlacement => {
  const [start] = placement.stubTracePath!
  const end: Point =
    direction === "x+"
      ? { x: start.x + targetLength, y: start.y }
      : direction === "x-"
        ? { x: start.x - targetLength, y: start.y }
        : direction === "y+"
          ? { x: start.x, y: start.y + targetLength }
          : { x: start.x, y: start.y - targetLength }
  const anchorPoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }

  return {
    ...placement,
    stubTracePath: [start, end],
    anchorPoint,
    // Extending a short row only adds wire at its free end. Keep the label
    // itself next to the pin so terminal labels can be start/end aligned and
    // collision checks continue to describe the rendered text box.
    center: placement.center,
  }
}

/**
 * Aligns the free ends of port-only inline-label stubs on each component side.
 *
 * A group is changed atomically: if any longer stub or retained label would
 * collide with a chip, component text, routed trace, retained anchored label,
 * or another inline label/stub, every member keeps its original length.
 */
export const alignPortOnlyInlineNetLabelStubs = ({
  placements,
  inputProblem,
  traces,
  netLabelPlacements,
}: {
  placements: InlineNetLabelPlacement[]
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): InlineNetLabelPlacement[] => {
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
  for (const [placementIndex, placement] of placements.entries()) {
    if (!placement.stubTracePath || placement.pinIds.length !== 1) continue
    const direction = getStubDirection(placement.stubTracePath)
    if (!direction) continue
    const ownerChipId = chipIdByPinId.get(placement.pinIds[0]!)
    const groupKey = `${ownerChipId ?? placement.pinIds[0]}::${direction}`
    const group = groups.get(groupKey) ?? []
    group.push({ placementIndex, placement, direction, ownerChipId })
    groups.set(groupKey, group)
  }

  const alignedPlacements = [...placements]
  const supersededGlobalNetIds = new Set(
    placements.map((placement) => placement.globalConnNetId),
  )
  const retainedAnchoredLabelBounds = netLabelPlacements
    .filter(
      (placement) => !supersededGlobalNetIds.has(placement.globalConnNetId),
    )
    .map(getLabelBounds)

  for (const group of groups.values()) {
    if (group.length < 2) continue
    const targetLength = Math.max(
      ...group.map(({ placement }) => getStubLength(placement.stubTracePath!)),
    )
    const proposals = group.map(({ placement, direction }) =>
      resizeStub(placement, direction, targetLength),
    )
    const groupPlacementIndices = new Set(
      group.map(({ placementIndex }) => placementIndex),
    )
    const fixedInlinePlacements = placements.filter(
      (_, placementIndex) => !groupPlacementIndices.has(placementIndex),
    )

    const hasConflict = proposals.some((proposal, proposalIndex) => {
      const labelBounds = getLabelBounds(proposal)
      const stubPath = proposal.stubTracePath!
      const stubBounds = getPathBounds(stubPath)
      const ownerChipId = group[proposalIndex]!.ownerChipId

      for (const chip of inputProblem.chips) {
        const chipBounds: Bounds = {
          minX: chip.center.x - chip.width / 2,
          maxX: chip.center.x + chip.width / 2,
          minY: chip.center.y - chip.height / 2,
          maxY: chip.center.y + chip.height / 2,
        }
        if (boundsOverlap(labelBounds, chipBounds)) return true
        if (
          chip.chipId !== ownerChipId &&
          boundsOverlap(stubBounds, chipBounds)
        )
          return true
      }

      for (const textBox of inputProblem.textBoxes ?? []) {
        const textBounds = getTextBoxBounds(textBox)
        if (
          boundsOverlap(labelBounds, textBounds) ||
          boundsOverlap(stubBounds, textBounds)
        )
          return true
      }

      for (const trace of traces) {
        if (trace.globalConnNetId === proposal.globalConnNetId) continue
        if (
          doesPathIntersectBounds(trace.tracePath, labelBounds) ||
          doesPathIntersectBounds(trace.tracePath, stubBounds)
        )
          return true
      }

      if (
        retainedAnchoredLabelBounds.some(
          (bounds) =>
            boundsOverlap(labelBounds, bounds) ||
            boundsOverlap(stubBounds, bounds),
        )
      )
        return true

      for (const fixedPlacement of fixedInlinePlacements) {
        const fixedLabelBounds = getLabelBounds(fixedPlacement)
        if (
          boundsOverlap(labelBounds, fixedLabelBounds) ||
          boundsOverlap(stubBounds, fixedLabelBounds)
        )
          return true
        if (
          fixedPlacement.stubTracePath &&
          (doesPathIntersectBounds(fixedPlacement.stubTracePath, labelBounds) ||
            doesPathIntersectBounds(stubPath, fixedLabelBounds))
        )
          return true
      }

      for (const [otherIndex, otherProposal] of proposals.entries()) {
        if (otherIndex === proposalIndex) continue
        const otherLabelBounds = getLabelBounds(otherProposal)
        if (boundsOverlap(labelBounds, otherLabelBounds)) return true
        if (doesPathIntersectBounds(stubPath, otherLabelBounds)) return true
      }

      return false
    })

    if (hasConflict) continue
    for (const [groupIndex, { placementIndex }] of group.entries()) {
      alignedPlacements[placementIndex] = proposals[groupIndex]!
    }
  }

  return alignedPlacements
}
