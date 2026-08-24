import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { doesPairCrossRestrictedCenterLines } from "lib/solvers/MspConnectionPairSolver/doesPairCrossRestrictedCenterLines"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import { arePinsInDifferentSchematicSections } from "lib/utils/arePinsInDifferentSchematicSections"
import type { FacingDirection } from "lib/utils/dir"
import {
  type InlineNetLabelPlacement,
  visualizeInlineNetLabelOutput,
} from "../InlineNetLabelSolver/InlineNetLabelSolver"
import { pathIntersectsRenderedLabel } from "../NetLabelToTraceSolver/NetLabelToTraceSolver"

const EPSILON = 1e-9
const MAX_CONTINUATION_OFFSET = 0.15
// Standalone ports may join nearby copper, but a distant connection remains a
// deliberate net-label boundary rather than becoming a page-spanning trace.
const MAX_PORT_TO_TRACE_DISTANCE = 2

type PinWithChipId = InputPin & {
  chipId: string
  _facingDirection: FacingDirection
}

interface TraceComponent {
  id: number
  globalConnNetId: string
  traces: SolvedTracePath[]
}

interface Candidate {
  sourceLabel: NetLabelPlacement
  sourceKind: "trace" | "port"
  sourceComponentId: number | null
  targetComponentId: number
  sourcePin: PinWithChipId
  targetPin: PinWithChipId
  sourcePoint: Point
  targetPoint: Point
  perpendicularOffset: number
  routeDistance: number
  key: string
}

export interface NetLabelTraceJunctionSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}

const pointsEqual = (first: Point, second: Point) =>
  Math.abs(first.x - second.x) <= EPSILON &&
  Math.abs(first.y - second.y) <= EPSILON

const pathIsAxisAligned = (path: Point[]) =>
  path.every(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - path[index - 1]!.x) <= EPSILON ||
      Math.abs(point.y - path[index - 1]!.y) <= EPSILON,
  )

const pointOnSegment = (point: Point, start: Point, end: Point) => {
  const crossProduct =
    (point.x - start.x) * (end.y - start.y) -
    (point.y - start.y) * (end.x - start.x)
  if (Math.abs(crossProduct) > EPSILON) return false
  return (
    point.x >= Math.min(start.x, end.x) - EPSILON &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    point.y >= Math.min(start.y, end.y) - EPSILON &&
    point.y <= Math.max(start.y, end.y) + EPSILON
  )
}

const segmentsOverlapBeyondPoint = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  const firstHorizontal = Math.abs(firstStart.y - firstEnd.y) <= EPSILON
  const secondHorizontal = Math.abs(secondStart.y - secondEnd.y) <= EPSILON
  if (firstHorizontal && secondHorizontal) {
    if (Math.abs(firstStart.y - secondStart.y) > EPSILON) return false
    return (
      Math.min(
        Math.max(firstStart.x, firstEnd.x),
        Math.max(secondStart.x, secondEnd.x),
      ) -
        Math.max(
          Math.min(firstStart.x, firstEnd.x),
          Math.min(secondStart.x, secondEnd.x),
        ) >
      EPSILON
    )
  }

  const firstVertical = Math.abs(firstStart.x - firstEnd.x) <= EPSILON
  const secondVertical = Math.abs(secondStart.x - secondEnd.x) <= EPSILON
  if (firstVertical && secondVertical) {
    if (Math.abs(firstStart.x - secondStart.x) > EPSILON) return false
    return (
      Math.min(
        Math.max(firstStart.y, firstEnd.y),
        Math.max(secondStart.y, secondEnd.y),
      ) -
        Math.max(
          Math.min(firstStart.y, firstEnd.y),
          Math.min(secondStart.y, secondEnd.y),
        ) >
      EPSILON
    )
  }

  return false
}

const tracesTouch = (first: SolvedTracePath, second: SolvedTracePath) => {
  if (first.pinIds.some((pinId) => second.pinIds.includes(pinId))) return true
  for (
    let firstIndex = 0;
    firstIndex < first.tracePath.length - 1;
    firstIndex++
  ) {
    for (
      let secondIndex = 0;
      secondIndex < second.tracePath.length - 1;
      secondIndex++
    ) {
      if (
        doSegmentsIntersect(
          first.tracePath[firstIndex]!,
          first.tracePath[firstIndex + 1]!,
          second.tracePath[secondIndex]!,
          second.tracePath[secondIndex + 1]!,
        )
      ) {
        return true
      }
    }
  }
  return false
}

const closestPointOnSegment = (
  point: Point,
  start: Point,
  end: Point,
): Point => {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared <= EPSILON) return { ...start }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
    ),
  )
  return {
    x: start.x + projection * deltaX,
    y: start.y + projection * deltaY,
  }
}

const getAdjacentTracePoint = (
  trace: SolvedTracePath,
  pin: PinWithChipId,
): Point | null => {
  if (pointsEqual(trace.tracePath[0]!, pin)) return trace.tracePath[1] ?? null
  if (pointsEqual(trace.tracePath.at(-1)!, pin)) {
    return trace.tracePath.at(-2) ?? null
  }
  return null
}

const directionToward = (from: Point, to: Point): FacingDirection => {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? "x+" : "x-"
  return deltaY >= 0 ? "y+" : "y-"
}

const isPointInDirection = (
  origin: Point,
  point: Point,
  direction: FacingDirection,
) => {
  if (direction === "x+") return point.x >= origin.x - EPSILON
  if (direction === "x-") return point.x <= origin.x + EPSILON
  if (direction === "y+") return point.y >= origin.y - EPSILON
  return point.y <= origin.y + EPSILON
}

const getPerpendicularOffset = (
  source: Point,
  target: Point,
  direction: FacingDirection,
) =>
  direction === "x+" || direction === "x-"
    ? Math.abs(source.y - target.y)
    : Math.abs(source.x - target.x)

export class NetLabelTraceJunctionSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  recoveredTraces: SolvedTracePath[] = []

  private chipMap: Record<string, InputChip> = {}
  private pinMap = new Map<string, PinWithChipId>()
  private components: TraceComponent[] = []
  private componentByTraceIndex = new Map<number, number>()
  private componentParents: number[] = []
  private queuedCandidates: Candidate[] = []
  private usedPortSourcePinIds = new Set<string>()
  private currentCandidate: Candidate | null = null
  declare activeSubSolver: SchematicTraceSingleLineSolver2 | null

  constructor(private input: NetLabelTraceJunctionSolverInput) {
    super()
    this.inputProblem = input.inputProblem
    this.inputTraces = input.traces
    this.inputNetLabelPlacements = input.netLabelPlacements
    this.inlineNetLabelPlacements = input.inlineNetLabelPlacements
    this.outputTraces = [...input.traces]
    this.outputNetLabelPlacements = [...input.netLabelPlacements]

    for (const chip of this.inputProblem.chips) {
      this.chipMap[chip.chipId] = chip
      for (const pin of chip.pins) {
        this.pinMap.set(pin.pinId, {
          ...pin,
          chipId: chip.chipId,
          _facingDirection: pin._facingDirection ?? getPinDirection(pin, chip),
        })
      }
    }

    this.buildTraceComponents()
    this.componentParents = this.components.map((component) => component.id)
    this.queuedCandidates = this.buildCandidates()
    this.stats.candidateCount = this.queuedCandidates.length
    this.stats.recoveredTraceCount = 0
  }

  override getConstructorParams(): [NetLabelTraceJunctionSolverInput] {
    return [this.input]
  }

  private buildTraceComponents() {
    const parents = this.inputTraces.map((_, index) => index)
    const find = (index: number): number => {
      if (parents[index] !== index) parents[index] = find(parents[index]!)
      return parents[index]!
    }
    const union = (first: number, second: number) => {
      const firstRoot = find(first)
      const secondRoot = find(second)
      if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot
    }

    for (
      let firstIndex = 0;
      firstIndex < this.inputTraces.length;
      firstIndex++
    ) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < this.inputTraces.length;
        secondIndex++
      ) {
        const first = this.inputTraces[firstIndex]!
        const second = this.inputTraces[secondIndex]!
        if (
          first.globalConnNetId === second.globalConnNetId &&
          tracesTouch(first, second)
        ) {
          union(firstIndex, secondIndex)
        }
      }
    }

    const componentsByRoot = new Map<number, TraceComponent>()
    for (
      let traceIndex = 0;
      traceIndex < this.inputTraces.length;
      traceIndex++
    ) {
      const root = find(traceIndex)
      let component = componentsByRoot.get(root)
      if (!component) {
        component = {
          id: componentsByRoot.size,
          globalConnNetId: this.inputTraces[traceIndex]!.globalConnNetId,
          traces: [],
        }
        componentsByRoot.set(root, component)
      }
      component.traces.push(this.inputTraces[traceIndex]!)
      this.componentByTraceIndex.set(traceIndex, component.id)
    }
    this.components = [...componentsByRoot.values()]
  }

  private isEligibleLabel(label: NetLabelPlacement, groundNetId?: string) {
    if (
      !label.netId ||
      label.netId === "GND" ||
      label.globalConnNetId === groundNetId ||
      (label.mspConnectionPairIds.length === 0 && label.pinIds.length !== 1)
    ) {
      return false
    }
    return this.inputProblem.directConnections.some(
      (connection) =>
        connection.netId === label.netId &&
        connection.pinIds.some((pinId) => label.pinIds.includes(pinId)),
    )
  }

  private getLabelComponent(label: NetLabelPlacement) {
    const traceIndex = this.inputTraces.findIndex((trace) =>
      trace.mspConnectionPairIds.some((id) =>
        label.mspConnectionPairIds.includes(id),
      ),
    )
    const componentId = this.componentByTraceIndex.get(traceIndex)
    return componentId === undefined ? null : this.components[componentId]!
  }

  private getClosestTarget(
    sourcePoint: Point,
    targetComponent: TraceComponent,
  ) {
    let best:
      | { point: Point; trace: SolvedTracePath; distance: number }
      | undefined
    for (const trace of targetComponent.traces) {
      for (let index = 0; index < trace.tracePath.length - 1; index++) {
        const point = closestPointOnSegment(
          sourcePoint,
          trace.tracePath[index]!,
          trace.tracePath[index + 1]!,
        )
        const distance =
          Math.abs(sourcePoint.x - point.x) + Math.abs(sourcePoint.y - point.y)
        if (!best || distance < best.distance - EPSILON) {
          best = { point, trace, distance }
        }
      }
    }
    return best
  }

  private getClosestTargetPin(
    targetTrace: SolvedTracePath,
    targetPoint: Point,
  ) {
    return targetTrace.pinIds
      .map((pinId) => this.pinMap.get(pinId))
      .filter((pin): pin is PinWithChipId => pin !== undefined)
      .sort(
        (first, second) =>
          Math.abs(first.x - targetPoint.x) +
          Math.abs(first.y - targetPoint.y) -
          Math.abs(second.x - targetPoint.x) -
          Math.abs(second.y - targetPoint.y),
      )[0]
  }

  private pinsCanShareJunction(
    sourcePin: PinWithChipId,
    targetPin: PinWithChipId | undefined,
  ): targetPin is PinWithChipId {
    return Boolean(
      targetPin &&
        !arePinsInDifferentSchematicSections(
          this.inputProblem,
          sourcePin,
          targetPin,
        ) &&
        !doesPairCrossRestrictedCenterLines({
          inputProblem: this.inputProblem,
          chipMap: this.chipMap,
          pinIdMap: this.pinMap,
          p1: sourcePin,
          p2: targetPin,
        }),
    )
  }

  private buildCandidates() {
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    const groundNetId = netConnMap.getNetConnectedToId("GND") ?? undefined
    const candidates: Candidate[] = []

    for (const label of this.inputNetLabelPlacements) {
      if (!this.isEligibleLabel(label, groundNetId)) continue

      if (label.mspConnectionPairIds.length === 0) {
        const sourcePin = this.pinMap.get(label.pinIds[0]!)
        if (!sourcePin) continue
        for (const targetComponent of this.components) {
          if (targetComponent.globalConnNetId !== label.globalConnNetId) {
            continue
          }
          const closestTarget = this.getClosestTarget(
            sourcePin,
            targetComponent,
          )
          if (!closestTarget) continue
          if (closestTarget.distance > MAX_PORT_TO_TRACE_DISTANCE) continue
          const targetPin = this.getClosestTargetPin(
            closestTarget.trace,
            closestTarget.point,
          )
          if (!this.pinsCanShareJunction(sourcePin, targetPin)) continue

          candidates.push({
            sourceLabel: label,
            sourceKind: "port",
            sourceComponentId: null,
            targetComponentId: targetComponent.id,
            sourcePin,
            targetPin,
            sourcePoint: sourcePin,
            targetPoint: closestTarget.point,
            perpendicularOffset: getPerpendicularOffset(
              sourcePin,
              closestTarget.point,
              sourcePin._facingDirection,
            ),
            routeDistance: closestTarget.distance,
            key: [
              `port-${sourcePin.pinId}`,
              closestTarget.trace.mspPairId,
            ].join("--"),
          })
        }
        continue
      }

      const sourceComponent = this.getLabelComponent(label)
      if (!sourceComponent) continue

      for (const sourceTrace of sourceComponent.traces) {
        for (const sourcePinId of sourceTrace.pinIds) {
          const sourcePin = this.pinMap.get(sourcePinId)
          if (!sourcePin) continue
          const sourcePoint = getAdjacentTracePoint(sourceTrace, sourcePin)
          if (!sourcePoint) continue
          if (pointsEqual(sourcePoint, sourcePin)) continue
          if (
            !isPointInDirection(
              sourcePin,
              sourcePoint,
              sourcePin._facingDirection,
            )
          ) {
            continue
          }

          for (const targetComponent of this.components) {
            if (
              targetComponent.id === sourceComponent.id ||
              targetComponent.globalConnNetId !==
                sourceComponent.globalConnNetId
            ) {
              continue
            }
            const closestTarget = this.getClosestTarget(
              sourcePoint,
              targetComponent,
            )
            if (!closestTarget) continue
            if (
              !isPointInDirection(
                sourcePoint,
                closestTarget.point,
                sourcePin._facingDirection,
              )
            ) {
              continue
            }
            const perpendicularOffset = getPerpendicularOffset(
              sourcePoint,
              closestTarget.point,
              sourcePin._facingDirection,
            )
            if (perpendicularOffset > MAX_CONTINUATION_OFFSET) continue

            const targetPin = this.getClosestTargetPin(
              closestTarget.trace,
              closestTarget.point,
            )
            if (!this.pinsCanShareJunction(sourcePin, targetPin)) continue

            const key = [
              label.mspConnectionPairIds.join("+"),
              sourcePin.pinId,
              closestTarget.trace.mspPairId,
            ].join("--")
            candidates.push({
              sourceLabel: label,
              sourceKind: "trace",
              sourceComponentId: sourceComponent.id,
              targetComponentId: targetComponent.id,
              sourcePin,
              targetPin,
              sourcePoint,
              targetPoint: closestTarget.point,
              perpendicularOffset,
              routeDistance: closestTarget.distance,
              key,
            })
          }
        }
      }
    }

    return candidates.sort(
      (first, second) =>
        Number(first.sourceKind === "port") -
          Number(second.sourceKind === "port") ||
        first.perpendicularOffset - second.perpendicularOffset ||
        first.routeDistance - second.routeDistance ||
        first.key.localeCompare(second.key),
    )
  }

  private findComponent(componentId: number): number {
    if (this.componentParents[componentId] !== componentId) {
      this.componentParents[componentId] = this.findComponent(
        this.componentParents[componentId]!,
      )
    }
    return this.componentParents[componentId]!
  }

  private unionComponents(firstId: number, secondId: number) {
    const firstRoot = this.findComponent(firstId)
    const secondRoot = this.findComponent(secondId)
    if (firstRoot !== secondRoot) this.componentParents[secondRoot] = firstRoot
  }

  private pathCrossesExistingTraces(path: Point[], candidate: Candidate) {
    for (
      let traceIndex = 0;
      traceIndex < this.inputTraces.length;
      traceIndex++
    ) {
      const trace = this.inputTraces[traceIndex]!
      const componentId = this.componentByTraceIndex.get(traceIndex)!
      const allowedJunctions: Point[] = []
      if (
        candidate.sourceComponentId !== null &&
        componentId === candidate.sourceComponentId
      ) {
        allowedJunctions.push(candidate.sourcePoint)
      }
      if (componentId === candidate.targetComponentId) {
        allowedJunctions.push(candidate.targetPoint)
      }

      for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
        const pathStart = path[pathIndex]!
        const pathEnd = path[pathIndex + 1]!
        for (
          let tracePointIndex = 0;
          tracePointIndex < trace.tracePath.length - 1;
          tracePointIndex++
        ) {
          const traceStart = trace.tracePath[tracePointIndex]!
          const traceEnd = trace.tracePath[tracePointIndex + 1]!
          if (!doSegmentsIntersect(pathStart, pathEnd, traceStart, traceEnd)) {
            continue
          }
          const allowedPointContact = allowedJunctions.some(
            (junction) =>
              (pointsEqual(pathStart, junction) ||
                pointsEqual(pathEnd, junction)) &&
              pointOnSegment(junction, traceStart, traceEnd) &&
              !segmentsOverlapBeyondPoint(
                pathStart,
                pathEnd,
                traceStart,
                traceEnd,
              ),
          )
          if (!allowedPointContact) return true
        }
      }
    }

    for (const recoveredTrace of this.recoveredTraces) {
      for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
        for (
          let tracePointIndex = 0;
          tracePointIndex < recoveredTrace.tracePath.length - 1;
          tracePointIndex++
        ) {
          if (
            doSegmentsIntersect(
              path[pathIndex]!,
              path[pathIndex + 1]!,
              recoveredTrace.tracePath[tracePointIndex]!,
              recoveredTrace.tracePath[tracePointIndex + 1]!,
            )
          ) {
            return true
          }
        }
      }
    }
    return false
  }

  private routeIntersectsRemainingLabels(
    path: Point[],
    sourceLabel: NetLabelPlacement,
  ) {
    for (const label of this.outputNetLabelPlacements) {
      if (label === sourceLabel) continue
      if (pathIntersectsRenderedLabel(path, label)) return true
    }
    return this.inlineNetLabelPlacements.some((label) =>
      pathIntersectsRenderedLabel(path, label),
    )
  }

  private tryAcceptCurrentRoute() {
    const candidate = this.currentCandidate
    const tracePath = this.activeSubSolver?.solvedTracePath
    if (!candidate || !tracePath) return
    if (
      !pathIsAxisAligned(tracePath) ||
      this.pathCrossesExistingTraces(tracePath, candidate) ||
      this.routeIntersectsRemainingLabels(tracePath, candidate.sourceLabel)
    ) {
      return
    }

    const mspPairId = `net-label-trace-junction-${candidate.key}`
    const recoveredTrace: SolvedTracePath = {
      mspPairId,
      dcConnNetId:
        candidate.sourceLabel.dcConnNetId ??
        candidate.sourceLabel.globalConnNetId,
      globalConnNetId: candidate.sourceLabel.globalConnNetId,
      userNetId: candidate.sourceLabel.netId,
      pins: [candidate.sourcePin, candidate.targetPin],
      tracePath,
      mspConnectionPairIds: [mspPairId],
      pinIds: [candidate.sourcePin.pinId, candidate.targetPin.pinId],
    }
    this.outputTraces.push(recoveredTrace)
    this.outputNetLabelPlacements = this.outputNetLabelPlacements.filter(
      (label) => label !== candidate.sourceLabel,
    )
    this.recoveredTraces.push(recoveredTrace)
    if (candidate.sourceComponentId === null) {
      this.usedPortSourcePinIds.add(candidate.sourcePin.pinId)
    } else {
      this.unionComponents(
        candidate.sourceComponentId,
        candidate.targetComponentId,
      )
    }
    this.stats.recoveredTraceCount = this.recoveredTraces.length
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        this.tryAcceptCurrentRoute()
        this.activeSubSolver = null
        this.currentCandidate = null
      } else if (this.activeSubSolver.failed) {
        this.activeSubSolver = null
        this.currentCandidate = null
      }
      return
    }

    let candidate = this.queuedCandidates.shift()
    while (
      candidate &&
      ((candidate.sourceComponentId !== null &&
        this.findComponent(candidate.sourceComponentId) ===
          this.findComponent(candidate.targetComponentId)) ||
        this.usedPortSourcePinIds.has(candidate.sourcePin.pinId) ||
        !this.outputNetLabelPlacements.includes(candidate.sourceLabel))
    ) {
      candidate = this.queuedCandidates.shift()
    }
    if (!candidate) {
      this.solved = true
      return
    }

    this.currentCandidate = candidate
    const sourceRoutingPin: PinWithChipId =
      candidate.sourceKind === "port"
        ? { ...candidate.sourcePin }
        : {
            ...candidate.sourcePoint,
            pinId: `junction-source-${candidate.key}`,
            chipId: `junction-source-${candidate.key}`,
            _facingDirection: candidate.sourcePin._facingDirection,
          }
    const targetRoutingPin: PinWithChipId = pointsEqual(
      candidate.targetPoint,
      candidate.targetPin,
    )
      ? { ...candidate.targetPin }
      : {
          ...candidate.targetPoint,
          pinId: `junction-target-${candidate.key}`,
          chipId: `junction-target-${candidate.key}`,
          _facingDirection: directionToward(
            candidate.targetPoint,
            candidate.sourcePoint,
          ),
        }
    this.activeSubSolver = new SchematicTraceSingleLineSolver2({
      inputProblem: this.inputProblem,
      pins: [sourceRoutingPin, targetRoutingPin],
      chipMap: this.chipMap,
    })
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) return this.activeSubSolver.visualize()
    const graphics = visualizeInlineNetLabelOutput({
      inputProblem: this.inputProblem,
      ...this.getOutput(),
    })
    for (const trace of this.recoveredTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
        label: `recovered same-net junction: ${trace.pinIds.join(" -> ")}`,
      })
    }
    return graphics
  }
}
