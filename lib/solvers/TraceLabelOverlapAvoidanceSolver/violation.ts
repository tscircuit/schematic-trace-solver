import type { Point, Bounds } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"

/**
 * Locates the portion of a trace that must be rerouted to clear a label.
 *
 * Detection is segment-based against the (unpadded) label bounds so it also
 * catches traces that cross the label edge-to-edge, or run *along* one of its
 * edges, without ever placing a vertex strictly inside it (the previous
 * vertex-only test missed both cases).
 *
 * The returned range describes the vertices to remove: the reroute reconnects
 * `path[firstInsideIndex - 1]` to `path[lastInsideIndex + 1]`. Those two anchor
 * vertices are pushed outward until they sit outside the padded label so the
 * detour has room to pivot without immediately re-entering it.
 */
export const findTraceViolationZone = ({
  path,
  labelBounds,
  paddedBounds = labelBounds,
}: {
  path: Point[]
  labelBounds: Bounds
  paddedBounds?: Bounds
}) => {
  let firstCollidingSeg = -1
  let lastCollidingSeg = -1
  for (let i = 0; i < path.length - 1; i++) {
    if (segmentIntersectsRect(path[i]!, path[i + 1]!, labelBounds)) {
      if (firstCollidingSeg === -1) firstCollidingSeg = i
      lastCollidingSeg = i
    }
  }

  if (firstCollidingSeg === -1) {
    return { firstInsideIndex: -1, lastInsideIndex: -1 }
  }

  const isInsidePadded = (p: Point) =>
    p.x > paddedBounds.minX &&
    p.x < paddedBounds.maxX &&
    p.y > paddedBounds.minY &&
    p.y < paddedBounds.maxY

  // Anchor before the crossing: walk back to the first vertex clear of the
  // padded label.
  let entryIndex = firstCollidingSeg
  while (entryIndex > 0 && isInsidePadded(path[entryIndex]!)) {
    entryIndex--
  }

  // Anchor after the crossing.
  let exitIndex = lastCollidingSeg + 1
  while (exitIndex < path.length - 1 && isInsidePadded(path[exitIndex]!)) {
    exitIndex++
  }

  return { firstInsideIndex: entryIndex + 1, lastInsideIndex: exitIndex - 1 }
}
