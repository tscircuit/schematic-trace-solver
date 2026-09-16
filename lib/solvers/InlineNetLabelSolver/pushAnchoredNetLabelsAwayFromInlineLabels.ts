import type { Bounds, Point } from "@tscircuit/math-utils"
import {
  getPinMap,
  getTracePins,
} from "lib/solvers/AvailableNetOrientationSolver/traces"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isLabelAndConnectorClearOfTraces } from "lib/solvers/NetLabelPlacementSolver/isLabelAndConnectorClearOfTraces"
import {
  getCenterFromAnchor,
  getDimsForOrientation,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getOrientationConstraint } from "lib/utils/getOrientationConstraint"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getInlineLabelObstacles } from "./getInlineLabelObstacles"
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
  let distance = 0
  // Only clear obstacles within the current proposal's clearance. A label elsewhere
  // on the same row must not force this label across the whole schematic.
  // Moving past one obstacle can encounter another, so continue until clear.
  for (let iteration = 0; iteration < inlineBounds.length; iteration++) {
    const labelBounds = getAnchoredNetLabelRenderedBounds(
      moveLabel(label, label.orientation, distance),
    )
    const horizontal = label.orientation === "x-" || label.orientation === "x+"
    const overlapping = inlineBounds.filter((bounds) =>
      boundsOverlap(labelBounds, {
        minX: bounds.minX - (horizontal ? LABEL_CLEARANCE : 0),
        maxX: bounds.maxX + (horizontal ? LABEL_CLEARANCE : 0),
        minY: bounds.minY - (horizontal ? 0 : LABEL_CLEARANCE),
        maxY: bounds.maxY + (horizontal ? 0 : LABEL_CLEARANCE),
      }),
    )
    if (overlapping.length === 0) break
    switch (label.orientation) {
      case "x-":
        distance +=
          labelBounds.maxX -
          Math.min(...overlapping.map((b) => b.minX)) +
          LABEL_CLEARANCE
        break
      case "x+":
        distance +=
          Math.max(...overlapping.map((b) => b.maxX)) -
          labelBounds.minX +
          LABEL_CLEARANCE
        break
      case "y-":
        distance +=
          labelBounds.maxY -
          Math.min(...overlapping.map((b) => b.minY)) +
          LABEL_CLEARANCE
        break
      case "y+":
        distance +=
          Math.max(...overlapping.map((b) => b.maxY)) -
          labelBounds.minY +
          LABEL_CLEARANCE
        break
    }
  }
  return distance
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

const findConnectorTraceIndex = (
  label: NetLabelPlacement,
  traces: SolvedTracePath[],
  connectorTraceIds: ReadonlySet<string>,
) =>
  traces.findIndex((trace) => {
    if (trace.globalConnNetId !== label.globalConnNetId) return false
    if (!connectorTraceIds.has(trace.mspPairId)) return false
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
  netLabelConnectorTraceIds = new Set<string>(),
}: {
  netLabelConnectorTraceIds?: ReadonlySet<string>
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}): {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  movedLabelCount: number
  netLabelConnectorTraceIds: ReadonlySet<string>
} => {
  const connectorTraceIds = new Set(netLabelConnectorTraceIds)
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

  const { terminalTraces } = getInlineLabelObstacles(
    inputProblem,
    inlineNetLabelPlacements,
  )
  const tryProposal = (
    proposals: Map<number, NetLabelPlacement>,
    ownerChipIds: Set<string>,
  ): boolean => {
    const finalLabelAt = (labelIndex: number) =>
      proposals.get(labelIndex) ?? outputLabels[labelIndex]!
    for (const [labelIndex, movedLabel] of proposals) {
      const movedBounds = getAnchoredNetLabelRenderedBounds(movedLabel)
      if (inlineBounds.some((bounds) => boundsOverlap(movedBounds, bounds))) {
        return false
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
        return false
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
        return false
      }
      if (
        outputTraces.some(
          (trace) =>
            trace.globalConnNetId !== movedLabel.globalConnNetId &&
            pathIntersectsBounds(trace.tracePath, movedBounds),
        )
      ) {
        return false
      }
    }

    const connectorUpdates: Array<{
      labelIndex: number
      connectorIndex: number
      trace: SolvedTracePath
    }> = []
    for (const [labelIndex, movedLabel] of proposals) {
      const label = outputLabels[labelIndex]!
      const connectorIndex = findConnectorTraceIndex(
        label,
        outputTraces,
        connectorTraceIds,
      )
      if (
        connectorIndex === -1 &&
        !canAddConnectorAtAnchor(label, outputTraces, pinMap)
      ) {
        return false
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
        !isLabelAndConnectorClearOfTraces({
          label: movedLabel,
          connectorPath: connector.tracePath,
          traces: [...outputTraces, ...terminalTraces],
        }) ||
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
        return false
      }
      if (
        connectorIndex !== -1 ||
        !pointsEqual(label.anchorPoint, movedLabel.anchorPoint)
      ) {
        connectorUpdates.push({ labelIndex, connectorIndex, trace: connector })
      }
    }

    for (const update of connectorUpdates) {
      if (
        !isLabelAndConnectorClearOfTraces({
          label: proposals.get(update.labelIndex)!,
          connectorPath: update.trace.tracePath,
          traces: connectorUpdates
            .filter((other) => other !== update)
            .map((other) => other.trace),
        })
      )
        return false
    }

    for (const [labelIndex, movedLabel] of proposals) {
      outputLabels[labelIndex] = movedLabel
      movedLabelIndices.add(labelIndex)
    }
    for (const update of connectorUpdates) {
      connectorTraceIds.add(update.trace.mspPairId)
      if (update.connectorIndex === -1) outputTraces.push(update.trace)
      else outputTraces[update.connectorIndex] = update.trace
    }
    return true
  }

  for (
    let triggerIndex = 0;
    triggerIndex < outputLabels.length;
    triggerIndex++
  ) {
    const trigger = outputLabels[triggerIndex]!
    const distance = getRequiredOutwardDistance(trigger, inlineBounds)
    const existingConnectorIndex = findConnectorTraceIndex(
      trigger,
      outputTraces,
      connectorTraceIds,
    )
    const existingConnector = outputTraces[existingConnectorIndex]
    const currentPlacementIsClear = isLabelAndConnectorClearOfTraces({
      label: trigger,
      connectorPath: existingConnector?.tracePath ?? [trigger.anchorPoint],
      traces: [...outputTraces, ...terminalTraces],
    })
    if (
      distance <= POINT_EPSILON &&
      (!existingConnector || currentPlacementIsClear)
    )
      continue
    if (distance > MAX_OUTWARD_DISTANCE) continue

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
            (findConnectorTraceIndex(
              obstacle,
              outputTraces,
              connectorTraceIds,
            ) === -1 &&
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

    if (!failed && tryProposal(proposals, ownerChipIds)) continue

    // If a group cannot move together, retain its alignment. A single endpoint
    // can try a different orientation/shorter attachment before any write occurs.
    if (group.size !== 1) continue
    for (const candidate of getAlternativePlacements(
      trigger,
      inputProblem,
      outputTraces,
      connectorTraceIds,
    )) {
      if (tryProposal(new Map([[triggerIndex, candidate]]), ownerChipIds)) break
    }
  }

  return {
    traces: outputTraces,
    netLabelPlacements: outputLabels,
    movedLabelCount: movedLabelIndices.size,
    netLabelConnectorTraceIds: connectorTraceIds,
  }
}

function* getAlternativePlacements(
  label: NetLabelPlacement,
  inputProblem: InputProblem,
  traces: SolvedTracePath[],
  connectorIds: ReadonlySet<string>,
): Generator<NetLabelPlacement> {
  const allowed = getOrientationConstraint(inputProblem, label) ?? [
    "x+",
    "x-",
    "y+",
    "y-",
  ]
  const orientations = [...new Set([label.orientation, ...allowed])].filter(
    (orientation) => allowed.includes(orientation),
  )
  const anchors: Point[] = []
  const connector = traces[findConnectorTraceIndex(label, traces, connectorIds)]
  let origin = label.anchorPoint
  let direction = dir(label.orientation)
  if (connector) {
    // Moving one end of an elbow could create a diagonal or detach a branch.
    if (connector.tracePath.length !== 2) return
    origin = pointsEqual(connector.tracePath[0]!, label.anchorPoint)
      ? connector.tracePath[1]!
      : connector.tracePath[0]!
    const dx = label.anchorPoint.x - origin.x
    const dy = label.anchorPoint.y - origin.y
    const length = Math.hypot(dx, dy)
    if (
      length < POINT_EPSILON ||
      (Math.abs(dx) > POINT_EPSILON && Math.abs(dy) > POINT_EPSILON)
    )
      return
    direction = { x: dx / length, y: dy / length }
  } else {
    const pin =
      label.pinIds.length === 1
        ? getPinMap(inputProblem)[label.pinIds[0]!]
        : undefined
    if (pin?._facingDirection && pointsEqual(pin, origin))
      direction = dir(pin._facingDirection)
    anchors.push(origin)
  }
  // Rank alternate candidates by connector length, then allowed orientation.
  for (let distance = 0.1; distance <= MAX_OUTWARD_DISTANCE; distance += 0.1) {
    const anchor = {
      x: origin.x + direction.x * distance,
      y: origin.y + direction.y * distance,
    }
    if (connector && isPointOnPath(anchor, connector.tracePath)) {
      const removedBounds = {
        minX: Math.min(anchor.x, label.anchorPoint.x) - POINT_EPSILON,
        maxX: Math.max(anchor.x, label.anchorPoint.x) + POINT_EPSILON,
        minY: Math.min(anchor.y, label.anchorPoint.y) - POINT_EPSILON,
        maxY: Math.max(anchor.y, label.anchorPoint.y) + POINT_EPSILON,
      }
      if (
        traces.some(
          (trace) =>
            trace !== connector &&
            trace.globalConnNetId === label.globalConnNetId &&
            trace.tracePath
              .slice(1)
              .some((point, index) =>
                segmentIntersectsRect(
                  trace.tracePath[index]!,
                  point,
                  removedBounds,
                ),
              ),
        )
      )
        continue
    }
    anchors.push(anchor)
  }
  const rendered = getAnchoredNetLabelRenderedBounds(label)
  const vertical = label.orientation === "y+" || label.orientation === "y-"
  const netLabelWidth = vertical
    ? rendered.maxY - rendered.minY
    : rendered.maxX - rendered.minX
  const netLabelHeight = vertical
    ? rendered.maxX - rendered.minX
    : rendered.maxY - rendered.minY
  for (const anchorPoint of anchors) {
    for (const orientation of orientations) {
      const { width, height } = getDimsForOrientation({
        orientation,
        netLabelWidth,
        netLabelHeight,
      })
      yield {
        ...label,
        anchorPoint,
        orientation,
        width,
        height,
        center: getCenterFromAnchor(anchorPoint, orientation, width, height),
      }
    }
  }
}
