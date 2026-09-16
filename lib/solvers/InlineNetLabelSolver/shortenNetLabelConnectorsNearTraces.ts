import type { Bounds, Point } from "@tscircuit/math-utils"
import { getPinMap } from "lib/solvers/AvailableNetOrientationSolver/traces"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import { getInlineLabelObstacles } from "./getInlineLabelObstacles"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

const CLEARANCE = 0.1
const EPS = 1e-6
const STEP = 0.1
const MAX_CANDIDATES = 50
const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
const pad = (bounds: Bounds, amount: number): Bounds => ({
  minX: bounds.minX - amount,
  maxX: bounds.maxX + amount,
  minY: bounds.minY - amount,
  maxY: bounds.maxY + amount,
})
const segmentBounds = (a: Point, b: Point): Bounds => ({
  minX: Math.min(a.x, b.x),
  maxX: Math.max(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxY: Math.max(a.y, b.y),
})
const intersects = (path: Point[], bounds: Bounds) =>
  path
    .slice(1)
    .some((end, index) => segmentIntersectsRect(path[index]!, end, bounds))

/** Keep one-pin tags on the pin side of unrelated wires. Only shorten explicitly
 * marked, straight pin-to-label connectors; never change an electrical route.
 * Search from the pin outward and preserve the tag's orientation and identity.
 */
export const shortenNetLabelConnectorsNearTraces = (params: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
}) => {
  const { inputProblem, inlineNetLabelPlacements, netLabelConnectorTraceIds } =
    params
  const traces = [...params.traces]
  const netLabelPlacements = [...params.netLabelPlacements]
  const pinMap = getPinMap(inputProblem)
  const { fixedLabels, terminalTraces } = getInlineLabelObstacles(
    inputProblem,
    inlineNetLabelPlacements,
  )
  const fixedBounds = [
    ...inputProblem.chips.map((chip) => getTextBoxBounds(chip)),
    ...(inputProblem.textBoxes ?? []).map((box) => getTextBoxBounds(box)),
    ...fixedLabels.map(getAnchoredNetLabelRenderedBounds),
  ]
  let movedLabelCount = 0

  for (let index = 0; index < netLabelPlacements.length; index++) {
    const label = netLabelPlacements[index]!
    if (label.pinIds.length !== 1 || label.mspConnectionPairIds.length !== 0)
      continue
    const pin = pinMap[label.pinIds[0]!]
    if (!pin) continue
    const traceIndex = traces.findIndex(
      (trace) =>
        netLabelConnectorTraceIds.has(trace.mspPairId) &&
        trace.globalConnNetId === label.globalConnNetId &&
        trace.tracePath.length === 2 &&
        ((samePoint(trace.tracePath[0]!, pin) &&
          samePoint(trace.tracePath[1]!, label.anchorPoint)) ||
          (samePoint(trace.tracePath[1]!, pin) &&
            samePoint(trace.tracePath[0]!, label.anchorPoint))),
    )
    if (traceIndex === -1) continue
    const connector = traces[traceIndex]!
    const dx = label.anchorPoint.x - pin.x
    const dy = label.anchorPoint.y - pin.y
    if (Math.abs(dx) > EPS && Math.abs(dy) > EPS) continue
    const length = Math.hypot(dx, dy)
    if (length < STEP + EPS) continue
    const otherTraces = [...traces, ...terminalTraces].filter(
      (trace) => trace.globalConnNetId !== label.globalConnNetId,
    )
    const touchesOtherTrace = (anchor: Point, bounds: Bounds) =>
      otherTraces.some(
        (trace) =>
          intersects(
            trace.tracePath,
            pad(segmentBounds(pin, anchor), CLEARANCE - EPS),
          ) || intersects(trace.tracePath, pad(bounds, CLEARANCE - EPS)),
      )
    if (
      !touchesOtherTrace(
        label.anchorPoint,
        getAnchoredNetLabelRenderedBounds(label),
      )
    )
      continue

    const otherLabelBounds = netLabelPlacements
      .filter((_, otherIndex) => otherIndex !== index)
      .map(getAnchoredNetLabelRenderedBounds)
    for (
      let distance = STEP;
      distance < Math.min(length - EPS, STEP * MAX_CANDIDATES);
      distance += STEP
    ) {
      const anchorPoint = {
        x: pin.x + (dx * distance) / length,
        y: pin.y + (dy * distance) / length,
      }
      const moved = {
        ...label,
        anchorPoint,
        center: {
          x: label.center.x + anchorPoint.x - label.anchorPoint.x,
          y: label.center.y + anchorPoint.y - label.anchorPoint.y,
        },
      }
      const bounds = getAnchoredNetLabelRenderedBounds(moved)
      if (touchesOtherTrace(anchorPoint, bounds)) continue
      if (
        [...fixedBounds, ...otherLabelBounds].some((obstacle) =>
          boundsOverlap(pad(bounds, 0.05), obstacle),
        )
      )
        continue
      const connectorObstacles = [
        ...inputProblem.chips
          .filter((chip) => chip.chipId !== pin.chipId)
          .map((chip) => getTextBoxBounds(chip)),
        ...(inputProblem.textBoxes ?? []).map((box) => getTextBoxBounds(box)),
        ...fixedLabels.map(getAnchoredNetLabelRenderedBounds),
        ...otherLabelBounds,
      ]
      if (
        connectorObstacles.some((obstacle) =>
          intersects([pin, anchorPoint], pad(obstacle, 0.05)),
        )
      )
        continue
      // Do not remove a same-net branch attached to the discarded stub segment.
      if (
        traces.some(
          (trace, otherIndex) =>
            otherIndex !== traceIndex &&
            trace.globalConnNetId === label.globalConnNetId &&
            intersects(
              trace.tracePath,
              pad(segmentBounds(anchorPoint, label.anchorPoint), EPS),
            ),
        )
      )
        continue
      traces[traceIndex] = {
        ...connector,
        tracePath: connector.tracePath.map((point) =>
          samePoint(point, label.anchorPoint) ? anchorPoint : point,
        ),
      }
      netLabelPlacements[index] = moved
      movedLabelCount++
      break
    }
  }
  return { traces, netLabelPlacements, movedLabelCount }
}
