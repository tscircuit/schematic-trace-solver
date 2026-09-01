import type { Bounds, Point } from "@tscircuit/math-utils"
import {
  getPinMap,
  getTracePins,
} from "lib/solvers/AvailableNetOrientationSolver/traces"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

const LABEL_CLEARANCE = 0.05
const POINT_EPSILON = 1e-6
const CONTIGUOUS_LABEL_GAP = 0.01
const MAX_OUTWARD_DISTANCE = 5

const getInlineBounds = (placement: InlineNetLabelPlacement): Bounds => {
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

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) <= POINT_EPSILON && Math.abs(a.y - b.y) <= POINT_EPSILON

const pathIntersectsBounds = (path: Point[], bounds: Bounds) => {
  for (let index = 0; index < path.length - 1; index++) {
    const start = path[index]!
    const end = path[index + 1]!
    const segmentBounds: Bounds = {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
    }
    if (boundsOverlap(segmentBounds, bounds)) return true
  }
  return false
}

const isPointOnPath = (point: Point, path: Point[]) => {
  for (let index = 0; index < path.length - 1; index++) {
    const start = path[index]!
    const end = path[index + 1]!
    const minX = Math.min(start.x, end.x) - POINT_EPSILON
    const maxX = Math.max(start.x, end.x) + POINT_EPSILON
    const minY = Math.min(start.y, end.y) - POINT_EPSILON
    const maxY = Math.max(start.y, end.y) + POINT_EPSILON
    const isHorizontal = Math.abs(start.y - end.y) <= POINT_EPSILON
    const isVertical = Math.abs(start.x - end.x) <= POINT_EPSILON
    if (
      ((isHorizontal && Math.abs(point.y - start.y) <= POINT_EPSILON) ||
        (isVertical && Math.abs(point.x - start.x) <= POINT_EPSILON)) &&
      point.x >= minX &&
      point.x <= maxX &&
      point.y >= minY &&
      point.y <= maxY
    ) {
      return true
    }
  }
  return false
}

const getRequiredOutwardDistance = (
  label: NetLabelPlacement,
  inlineBounds: Bounds[],
) => {
  const labelBounds = getAnchoredNetLabelRenderedBounds(label)

  if (label.orientation === "x-" || label.orientation === "x+") {
    const nearby = inlineBounds.filter(
      (bounds) =>
        labelBounds.minY < bounds.maxY && labelBounds.maxY > bounds.minY,
    )
    if (nearby.length === 0) return 0
    if (label.orientation === "x-") {
      const targetMaxX = Math.min(...nearby.map((bounds) => bounds.minX))
      return Math.max(0, labelBounds.maxX - targetMaxX + LABEL_CLEARANCE)
    }
    const targetMinX = Math.max(...nearby.map((bounds) => bounds.maxX))
    return Math.max(0, targetMinX - labelBounds.minX + LABEL_CLEARANCE)
  }

  const nearby = inlineBounds.filter(
    (bounds) =>
      labelBounds.minX < bounds.maxX && labelBounds.maxX > bounds.minX,
  )
  if (nearby.length === 0) return 0
  if (label.orientation === "y-") {
    const targetMaxY = Math.min(...nearby.map((bounds) => bounds.minY))
    return Math.max(0, labelBounds.maxY - targetMaxY + LABEL_CLEARANCE)
  }
  const targetMinY = Math.max(...nearby.map((bounds) => bounds.maxY))
  return Math.max(0, targetMinY - labelBounds.minY + LABEL_CLEARANCE)
}

const moveLabel = (
  label: NetLabelPlacement,
  orientation: FacingDirection,
  distance: number,
): NetLabelPlacement => {
  const direction = dir(orientation)
  return {
    ...label,
    anchorPoint: {
      x: label.anchorPoint.x + direction.x * distance,
      y: label.anchorPoint.y + direction.y * distance,
    },
    center: {
      x: label.center.x + direction.x * distance,
      y: label.center.y + direction.y * distance,
    },
  }
}

const getDistanceToShoveBoundsPast = (
  obstacleBounds: Bounds,
  movingBounds: Bounds,
  orientation: FacingDirection,
) => {
  switch (orientation) {
    case "x-":
      return obstacleBounds.maxX - movingBounds.minX + LABEL_CLEARANCE
    case "x+":
      return movingBounds.maxX - obstacleBounds.minX + LABEL_CLEARANCE
    case "y-":
      return obstacleBounds.maxY - movingBounds.minY + LABEL_CLEARANCE
    case "y+":
      return movingBounds.maxY - obstacleBounds.minY + LABEL_CLEARANCE
  }
}

const boundsGapOnPerpendicularAxis = (
  a: Bounds,
  b: Bounds,
  orientation: FacingDirection,
) => {
  if (orientation === "x-" || orientation === "x+") {
    return Math.max(0, a.minY - b.maxY, b.minY - a.maxY)
  }
  return Math.max(0, a.minX - b.maxX, b.minX - a.maxX)
}

const sharesOwnerChip = (
  label: NetLabelPlacement,
  ownerChipIds: Set<string>,
  chipIdByPinId: Map<string, string>,
) =>
  label.pinIds.some((pinId) => ownerChipIds.has(chipIdByPinId.get(pinId) ?? ""))

const isGeneratedLabelConnector = (trace: SolvedTracePath) =>
  trace.mspPairId.startsWith("available-net-orientation-") ||
  trace.mspPairId.startsWith("inline-net-label-clearance-")

const findConnectorTraceIndex = (
  label: NetLabelPlacement,
  traces: SolvedTracePath[],
) =>
  traces.findIndex((trace) => {
    if (trace.globalConnNetId !== label.globalConnNetId) return false
    if (!isGeneratedLabelConnector(trace)) return false
    const first = trace.tracePath[0]
    const last = trace.tracePath.at(-1)
    return Boolean(
      (first && pointsEqual(first, label.anchorPoint)) ||
        (last && pointsEqual(last, label.anchorPoint)),
    )
  })

const canAddConnectorAtAnchor = (
  label: NetLabelPlacement,
  traces: SolvedTracePath[],
  pinMap: ReturnType<typeof getPinMap>,
) => {
  if (
    label.pinIds.some((pinId) => {
      const pin = pinMap[pinId]
      return pin && pointsEqual(pin, label.anchorPoint)
    })
  ) {
    return true
  }
  return traces.some(
    (trace) =>
      trace.globalConnNetId === label.globalConnNetId &&
      isPointOnPath(label.anchorPoint, trace.tracePath),
  )
}

const moveConnectorEndpoint = (
  trace: SolvedTracePath,
  oldAnchor: Point,
  newAnchor: Point,
): SolvedTracePath => {
  const tracePath = trace.tracePath.map((point) => ({ ...point }))
  if (pointsEqual(tracePath[0]!, oldAnchor)) tracePath[0] = newAnchor
  if (pointsEqual(tracePath.at(-1)!, oldAnchor)) {
    tracePath[tracePath.length - 1] = newAnchor
  }
  return { ...trace, tracePath }
}

const createConnectorTrace = ({
  label,
  labelIndex,
  newAnchor,
  pinMap,
}: {
  label: NetLabelPlacement
  labelIndex: number
  newAnchor: Point
  pinMap: ReturnType<typeof getPinMap>
}): SolvedTracePath => {
  const mspPairId = `inline-net-label-clearance-${labelIndex}-${label.netId ?? label.globalConnNetId}`
  return {
    mspPairId,
    dcConnNetId: label.dcConnNetId ?? label.globalConnNetId,
    globalConnNetId: label.globalConnNetId,
    userNetId: label.netId,
    pins: getTracePins(label, pinMap),
    tracePath: [label.anchorPoint, newAnchor],
    mspConnectionPairIds: [mspPairId],
    pinIds: label.pinIds,
  }
}

const getContiguousLabelGroup = ({
  triggerIndex,
  labels,
  chipIdByPinId,
}: {
  triggerIndex: number
  labels: NetLabelPlacement[]
  chipIdByPinId: Map<string, string>
}) => {
  const trigger = labels[triggerIndex]!
  const ownerChipIds = new Set(
    trigger.pinIds.flatMap((pinId) => {
      const chipId = chipIdByPinId.get(pinId)
      return chipId ? [chipId] : []
    }),
  )
  const candidates = labels
    .map((label, labelIndex) => ({ label, labelIndex }))
    .filter(
      ({ label }) =>
        label.orientation === trigger.orientation &&
        label.mspConnectionPairIds.length === 0 &&
        sharesOwnerChip(label, ownerChipIds, chipIdByPinId),
    )
  const group = new Set([triggerIndex])
  let changed = true
  while (changed) {
    changed = false
    for (const { label, labelIndex } of candidates) {
      if (group.has(labelIndex)) continue
      if (
        [...group].some(
          (memberIndex) =>
            boundsGapOnPerpendicularAxis(
              getAnchoredNetLabelRenderedBounds(labels[memberIndex]!),
              getAnchoredNetLabelRenderedBounds(label),
              trigger.orientation,
            ) <= CONTIGUOUS_LABEL_GAP,
        )
      ) {
        group.add(labelIndex)
        changed = true
      }
    }
  }
  return { group, ownerChipIds }
}

/**
 * Pushes conventional endpoint labels past nearby inline label text.
 *
 * Contiguous conventional labels on the same component side move as a group,
 * keeping their connector tips aligned. When that new column encounters
 * another label belonging to the same component, the obstacle is shoved one
 * column farther outward and receives its own short connector. The entire
 * proposal is rejected if a chip, component text, inline label, fixed label,
 * or unrelated trace would still be hit.
 */
export const pushAnchoredNetLabelsAwayFromInlineLabels = ({
  inputProblem,
  traces,
  netLabelPlacements,
  inlineNetLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}): {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  movedLabelCount: number
} => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))
  const outputLabels = netLabelPlacements.map((label) => ({ ...label }))
  const inlineBounds = inlineNetLabelPlacements.map(getInlineBounds)
  const pinMap = getPinMap(inputProblem)
  const chipIdByPinId = new Map<string, string>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) chipIdByPinId.set(pin.pinId, chip.chipId)
  }
  const movedLabelIndices = new Set<number>()

  for (
    let triggerIndex = 0;
    triggerIndex < outputLabels.length;
    triggerIndex++
  ) {
    const trigger = outputLabels[triggerIndex]!
    const distance = getRequiredOutwardDistance(trigger, inlineBounds)
    if (distance <= POINT_EPSILON || distance > MAX_OUTWARD_DISTANCE) continue

    const { group, ownerChipIds } = getContiguousLabelGroup({
      triggerIndex,
      labels: outputLabels,
      chipIdByPinId,
    })
    const distances = new Map<number, number>(
      [...group].map((labelIndex) => [labelIndex, distance]),
    )

    let failed = false
    for (let iteration = 0; iteration < outputLabels.length; iteration++) {
      let adjustedObstacle = false
      for (const [movingIndex, movingDistance] of distances) {
        const movingBounds = getAnchoredNetLabelRenderedBounds(
          moveLabel(
            outputLabels[movingIndex]!,
            trigger.orientation,
            movingDistance,
          ),
        )
        for (
          let obstacleIndex = 0;
          obstacleIndex < outputLabels.length;
          obstacleIndex++
        ) {
          if (group.has(obstacleIndex)) continue
          const obstacle = outputLabels[obstacleIndex]!
          const existingObstacleDistance = distances.get(obstacleIndex) ?? 0
          const obstacleBounds = getAnchoredNetLabelRenderedBounds(
            moveLabel(obstacle, trigger.orientation, existingObstacleDistance),
          )
          if (!boundsOverlap(movingBounds, obstacleBounds)) continue
          if (
            !sharesOwnerChip(obstacle, ownerChipIds, chipIdByPinId) ||
            (findConnectorTraceIndex(obstacle, outputTraces) === -1 &&
              !canAddConnectorAtAnchor(obstacle, outputTraces, pinMap))
          ) {
            failed = true
            break
          }
          const shoveDistance = getDistanceToShoveBoundsPast(
            getAnchoredNetLabelRenderedBounds(obstacle),
            movingBounds,
            trigger.orientation,
          )
          if (
            shoveDistance > MAX_OUTWARD_DISTANCE ||
            shoveDistance <= existingObstacleDistance + POINT_EPSILON
          ) {
            failed = true
            break
          }
          distances.set(obstacleIndex, shoveDistance)
          adjustedObstacle = true
        }
        if (failed) break
      }
      if (failed || !adjustedObstacle) break
    }
    if (failed) continue

    const proposals = new Map<number, NetLabelPlacement>()
    for (const [labelIndex, labelDistance] of distances) {
      proposals.set(
        labelIndex,
        moveLabel(
          outputLabels[labelIndex]!,
          trigger.orientation,
          labelDistance,
        ),
      )
    }

    const finalLabelAt = (labelIndex: number) =>
      proposals.get(labelIndex) ?? outputLabels[labelIndex]!
    for (const [labelIndex, movedLabel] of proposals) {
      const movedBounds = getAnchoredNetLabelRenderedBounds(movedLabel)
      if (inlineBounds.some((bounds) => boundsOverlap(movedBounds, bounds))) {
        failed = true
        break
      }
      if (
        inputProblem.chips.some((chip) =>
          boundsOverlap(movedBounds, {
            minX: chip.center.x - chip.width / 2,
            maxX: chip.center.x + chip.width / 2,
            minY: chip.center.y - chip.height / 2,
            maxY: chip.center.y + chip.height / 2,
          }),
        ) ||
        (inputProblem.textBoxes ?? []).some((textBox) =>
          boundsOverlap(movedBounds, getTextBoxBounds(textBox)),
        )
      ) {
        failed = true
        break
      }
      if (
        outputLabels.some(
          (_, otherIndex) =>
            otherIndex !== labelIndex &&
            boundsOverlap(
              movedBounds,
              getAnchoredNetLabelRenderedBounds(finalLabelAt(otherIndex)),
            ),
        )
      ) {
        failed = true
        break
      }
      if (
        outputTraces.some(
          (trace) =>
            trace.globalConnNetId !== movedLabel.globalConnNetId &&
            pathIntersectsBounds(trace.tracePath, movedBounds),
        )
      ) {
        failed = true
        break
      }
    }
    if (failed) continue

    const connectorUpdates: Array<{
      labelIndex: number
      connectorIndex: number
      trace: SolvedTracePath
    }> = []
    for (const [labelIndex, movedLabel] of proposals) {
      const label = outputLabels[labelIndex]!
      const connectorIndex = findConnectorTraceIndex(label, outputTraces)
      if (
        connectorIndex === -1 &&
        !canAddConnectorAtAnchor(label, outputTraces, pinMap)
      ) {
        failed = true
        break
      }
      const connector =
        connectorIndex === -1
          ? createConnectorTrace({
              label,
              labelIndex,
              newAnchor: movedLabel.anchorPoint,
              pinMap,
            })
          : moveConnectorEndpoint(
              outputTraces[connectorIndex]!,
              label.anchorPoint,
              movedLabel.anchorPoint,
            )
      const connectorObstructed =
        inlineBounds.some((bounds) =>
          pathIntersectsBounds(connector.tracePath, bounds),
        ) ||
        inputProblem.chips.some(
          (chip) =>
            !ownerChipIds.has(chip.chipId) &&
            pathIntersectsBounds(connector.tracePath, {
              minX: chip.center.x - chip.width / 2,
              maxX: chip.center.x + chip.width / 2,
              minY: chip.center.y - chip.height / 2,
              maxY: chip.center.y + chip.height / 2,
            }),
        ) ||
        (inputProblem.textBoxes ?? []).some((textBox) =>
          pathIntersectsBounds(connector.tracePath, getTextBoxBounds(textBox)),
        ) ||
        outputLabels.some(
          (_, otherIndex) =>
            otherIndex !== labelIndex &&
            pathIntersectsBounds(
              connector.tracePath,
              getAnchoredNetLabelRenderedBounds(finalLabelAt(otherIndex)),
            ),
        )
      if (connectorObstructed) {
        failed = true
        break
      }
      connectorUpdates.push({ labelIndex, connectorIndex, trace: connector })
    }
    if (failed) continue

    for (const [labelIndex, movedLabel] of proposals) {
      outputLabels[labelIndex] = movedLabel
      movedLabelIndices.add(labelIndex)
    }
    for (const update of connectorUpdates) {
      if (update.connectorIndex === -1) outputTraces.push(update.trace)
      else outputTraces[update.connectorIndex] = update.trace
    }
  }

  return {
    traces: outputTraces,
    netLabelPlacements: outputLabels,
    movedLabelCount: movedLabelIndices.size,
  }
}
