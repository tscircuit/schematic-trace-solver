import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"

/** A mixed-net envelope must not disappear just because it includes our net. */
export const getOtherNetLabelObstacles = ({
  globalConnNetId,
  allLabelPlacements,
  mergedLabelNetIdMap,
  unmergedLabelPlacements,
}: {
  globalConnNetId: string
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  unmergedLabelPlacements?: NetLabelPlacement[]
}): NetLabelPlacement[] =>
  allLabelPlacements.flatMap((label) => {
    const members = mergedLabelNetIdMap[label.globalConnNetId]
    if (!members?.has(globalConnNetId))
      return label.globalConnNetId === globalConnNetId ? [] : [label]
    if (members.size === 1) return []
    // Without child geometry, retain the envelope conservatively. When supplied,
    // only remove our own child; preserve the other labels in this local group.
    if (!unmergedLabelPlacements) return [label]
    return unmergedLabelPlacements.filter(
      (child) =>
        child.globalConnNetId !== globalConnNetId &&
        members.has(child.globalConnNetId) &&
        Math.abs(child.center.x - label.center.x) <= label.width / 2 + 1e-6 &&
        Math.abs(child.center.y - label.center.y) <= label.height / 2 + 1e-6,
    )
  })
