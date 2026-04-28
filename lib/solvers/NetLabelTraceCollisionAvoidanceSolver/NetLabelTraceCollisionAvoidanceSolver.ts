import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  rectIntersectsAnyTrace,
  segmentIntersectsRect,
} from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { detectTraceLabelOverlap } from "../TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"

interface NetLabelTraceCollisionAvoidanceSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

type PinWithChipId = InputPin & { chipId: string }
type LabelTraceOverlapKind = "flat" | "intersects"
type CollisionAvoidancePhase = "trace-collisions" | "label-collisions"
type CandidateStatus = "accepted" | "rejected"
type CandidateRejectReason =
  | "chip-collision"
  | "label-collision"
  | "trace-collision"
  | "connector-chip-collision"
  | "connector-label-collision"
  | "no-connector"
type RelocationKind = "y-shift" | "outward"
type RelocationCandidate = {
  label: NetLabelPlacement
  connectorPath: Point[] | null
  kind: RelocationKind
}
type RelocationCandidateAttempt = RelocationCandidate & {
  labelIndex: number
  originalLabel: NetLabelPlacement
  phase: CollisionAvoidancePhase
  status: CandidateStatus
  rejectReason?: CandidateRejectReason
}
type RelocationSearchState = {
  labelIndex: number
  originalLabel: NetLabelPlacement
  phase: CollisionAvoidancePhase
  candidates: RelocationCandidate[]
  candidateIndex: number
}
const NET_LABEL_WICK_LENGTH = 0.05

function rectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
  EPS = 1e-9,
) {
  const xOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const yOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return xOverlap > EPS && yOverlap > EPS
}

export class NetLabelTraceCollisionAvoidanceSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  movedNetLabelIds = new Set<string>()
  candidateAttempts: RelocationCandidateAttempt[] = []
  currentPhase: CollisionAvoidancePhase = "trace-collisions"
  currentLabelIndex: number | null = null

  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private pinMap = new Map<string, PinWithChipId>()
  private chipMap = new Map<string, InputChip>()
  private labelsOnTraceQueue: number[] | null = null
  private collidingLabelQueue: number[] | null = null
  private relocationSearchState: RelocationSearchState | null = null

  constructor(params: NetLabelTraceCollisionAvoidanceSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.inputNetLabelPlacements = params.netLabelPlacements
    this.outputTraces = [...params.traces]
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)

    for (const chip of params.inputProblem.chips) {
      this.chipMap.set(chip.chipId, chip)
      for (const pin of chip.pins) {
        this.pinMap.set(pin.pinId, { ...pin, chipId: chip.chipId })
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof NetLabelTraceCollisionAvoidanceSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      netLabelPlacements: this.inputNetLabelPlacements,
    }
  }

  override _step() {
    if (this.currentPhase === "trace-collisions") {
      if (!this.labelsOnTraceQueue) {
        this.labelsOnTraceQueue = this.getEligibleLabelsOnTraceIndexes()
      }

      if (!this.relocationSearchState) {
        const labelIndex = this.labelsOnTraceQueue.shift()
        if (labelIndex === undefined) {
          this.currentPhase = "label-collisions"
          this.currentLabelIndex = null
          return
        }

        const label = this.outputNetLabelPlacements[labelIndex]!
        this.currentLabelIndex = labelIndex
        this.relocationSearchState = {
          labelIndex,
          originalLabel: label,
          phase: this.currentPhase,
          candidates: this.getYShiftedLabelPlacementCandidates(label),
          candidateIndex: 0,
        }
      }

      this.evaluateNextRelocationCandidate()
      return
    }

    if (!this.collidingLabelQueue) {
      this.collidingLabelQueue = this.getEligibleCollidingLabelIndexes()
    }

    if (!this.relocationSearchState) {
      const labelIndex = this.collidingLabelQueue.shift()
      if (labelIndex === undefined) {
        this.currentLabelIndex = null
        this.solved = true
        return
      }

      const label = this.outputNetLabelPlacements[labelIndex]!
      this.currentLabelIndex = labelIndex
      this.relocationSearchState = {
        labelIndex,
        originalLabel: label,
        phase: this.currentPhase,
        candidates: this.getMovedLabelPlacementCandidates(label),
        candidateIndex: 0,
      }
    }

    this.evaluateNextRelocationCandidate()
  }

  computeProgress() {
    const labelCount = Math.max(this.outputNetLabelPlacements.length, 1)
    const firstPhaseRemaining = this.labelsOnTraceQueue?.length ?? labelCount
    const secondPhaseRemaining =
      this.currentPhase === "label-collisions"
        ? (this.collidingLabelQueue?.length ?? labelCount)
        : labelCount
    const firstPhaseDone =
      this.currentPhase === "label-collisions"
        ? 1
        : 1 - firstPhaseRemaining / labelCount
    const secondPhaseDone =
      this.currentPhase === "label-collisions"
        ? 1 - secondPhaseRemaining / labelCount
        : 0

    return Math.min(1, Math.max(0, (firstPhaseDone + secondPhaseDone) / 2))
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private getEligibleLabelsOnTraceIndexes() {
    const labelIndexes: number[] = []

    this.outputNetLabelPlacements.forEach((label, index) => {
      if (label.orientation !== "x+" && label.orientation !== "x-") return
      if (this.hasAvailableOrientation(label)) return
      const overlapKind = this.getLabelTraceOverlapKind(label)
      if (!overlapKind) return
      if (
        overlapKind !== "flat" &&
        (this.isRoutedNetConnectionLabel(label) ||
          this.isDirectConnectionLabel(label))
      ) {
        return
      }
      labelIndexes.push(index)
    })

    return labelIndexes
  }

  private getEligibleCollidingLabelIndexes() {
    const overlaps = detectTraceLabelOverlap({
      traces: this.outputTraces,
      netLabels: this.outputNetLabelPlacements,
    })

    const collidingLabels = new Set(overlaps.map((overlap) => overlap.label))
    const labelIndexes: number[] = []

    this.outputNetLabelPlacements.forEach((label, index) => {
      if (!collidingLabels.has(label)) return
      if (this.hasAvailableOrientation(label)) return
      if (!this.getAssociatedChip(label)) return
      labelIndexes.push(index)
    })

    return labelIndexes
  }

  private hasAvailableOrientation(label: NetLabelPlacement) {
    const netId = label.netId ?? label.globalConnNetId
    return Object.prototype.hasOwnProperty.call(
      this.inputProblem.availableNetLabelOrientations,
      netId,
    )
  }

  private isRoutedNetConnectionLabel(label: NetLabelPlacement) {
    if (!label.netId) return false
    if (label.mspConnectionPairIds.length === 0) return false

    return this.inputProblem.netConnections.some(
      (netConnection) => netConnection.netId === label.netId,
    )
  }

  private isDirectConnectionLabel(label: NetLabelPlacement) {
    if (!label.netId) return false
    if (label.mspConnectionPairIds.length === 0) return false

    return this.inputProblem.directConnections.some(
      (directConnection) => directConnection.netId === label.netId,
    )
  }

  private getAssociatedChip(label: NetLabelPlacement) {
    for (const pinId of label.pinIds) {
      const pin = this.pinMap.get(pinId)
      if (!pin) continue
      const chip = this.chipMap.get(pin.chipId)
      if (chip) return chip
    }
    return null
  }

  private evaluateNextRelocationCandidate() {
    const searchState = this.relocationSearchState
    if (!searchState) return

    const candidate = searchState.candidates[searchState.candidateIndex++]
    if (!candidate) {
      this.relocationSearchState = null
      this.currentLabelIndex = null
      return
    }

    const rejectReason = this.getRelocationRejectReason(
      searchState.originalLabel,
      candidate,
      searchState.labelIndex,
    )
    const attempt: RelocationCandidateAttempt = {
      ...candidate,
      labelIndex: searchState.labelIndex,
      originalLabel: searchState.originalLabel,
      phase: searchState.phase,
      status: rejectReason ? "rejected" : "accepted",
      rejectReason: rejectReason ?? undefined,
    }
    this.candidateAttempts.push(attempt)

    if (rejectReason) return

    const connectorTrace = this.createConnectorTrace({
      label: searchState.originalLabel,
      tracePath: candidate.connectorPath!,
      index: this.outputTraces.length,
    })
    this.outputNetLabelPlacements[searchState.labelIndex] =
      this.addTraceIdToLabel(candidate.label, connectorTrace.mspPairId)
    this.movedNetLabelIds.add(searchState.originalLabel.globalConnNetId)
    this.outputTraces.push(connectorTrace)
    this.relocationSearchState = null
    this.currentLabelIndex = null
  }

  private getMovedLabelPlacementCandidates(label: NetLabelPlacement) {
    const chip = this.getAssociatedChip(label)
    if (!chip) return []

    const xDirection =
      label.center.x === chip.center.x
        ? label.anchorPoint.x >= chip.center.x
          ? 1
          : -1
        : label.center.x > chip.center.x
          ? 1
          : -1

    const maxOutwardOffset = 6 * chip.width
    const xStep = Math.max(label.width / 2, 0.05)
    const yStep = Math.max(label.height / 2, 0.05)
    const yOffsets = this.getAlternatingOffsets(maxOutwardOffset, yStep)
    const candidates: RelocationCandidate[] = []

    for (const yOffset of yOffsets) {
      for (
        let xOffset = xStep;
        xOffset <= maxOutwardOffset + 1e-9;
        xOffset += xStep
      ) {
        const nextAnchor = {
          x: label.anchorPoint.x + xDirection * xOffset,
          y: label.anchorPoint.y + yOffset,
        }
        const nextCenter = getCenterFromAnchor(
          nextAnchor,
          label.orientation,
          label.width,
          label.height,
        )
        const movedLabel = {
          ...label,
          anchorPoint: nextAnchor,
          center: nextCenter,
        }
        const connectorPath = this.getValidConnectorPathResult({
          label,
          movedLabel,
          labelIndex: this.currentLabelIndex ?? -1,
        }).tracePath

        candidates.push({
          label: movedLabel,
          connectorPath,
          kind: "outward",
        })
      }
    }

    return candidates
  }

  private getYShiftedLabelPlacementCandidates(label: NetLabelPlacement) {
    const chip = this.getAssociatedChip(label)
    const maxYOffset = 6 * (chip?.height ?? Math.max(label.height, 0.5))
    const yStep = Math.max(label.height / 2, 0.05)
    const yOffsets = this.getAlternatingOffsets(maxYOffset, yStep).slice(1)
    const searchOrigin = this.addWickOffset(
      label.anchorPoint,
      label.orientation,
    )
    const candidates: RelocationCandidate[] = []

    for (const yOffset of yOffsets) {
      const verticalSpineEnd = {
        x: searchOrigin.x,
        y: searchOrigin.y + yOffset,
      }
      const nextAnchor = this.addWickOffset(verticalSpineEnd, label.orientation)
      const nextCenter = getCenterFromAnchor(
        nextAnchor,
        label.orientation,
        label.width,
        label.height,
      )

      const movedLabel = {
        ...label,
        anchorPoint: nextAnchor,
        center: nextCenter,
      }
      const connectorPath = this.dedupeConsecutivePoints([
        label.anchorPoint,
        searchOrigin,
        verticalSpineEnd,
        nextAnchor,
      ])

      candidates.push({
        label: movedLabel,
        connectorPath,
        kind: "y-shift",
      })
    }

    return candidates
  }

  private getRelocationRejectReason(
    originalLabel: NetLabelPlacement,
    candidate: RelocationCandidate,
    labelIndex: number,
  ): CandidateRejectReason | null {
    const labelReason = this.getInvalidLabelCandidateReason(
      candidate.label,
      labelIndex,
    )
    if (labelReason) return labelReason

    if (!candidate.connectorPath) return "no-connector"

    if (candidate.kind === "y-shift") {
      if (this.connectorPathIntersectsChip(candidate.connectorPath)) {
        return "connector-chip-collision"
      }
      return null
    }

    const connectorPathResult = this.getValidConnectorPathResult({
      label: originalLabel,
      movedLabel: candidate.label,
      labelIndex,
    })

    return connectorPathResult.tracePath
      ? null
      : connectorPathResult.rejectReason
  }

  private addWickOffset(anchor: Point, orientation: string): Point {
    switch (orientation) {
      case "x+":
        return { x: anchor.x + NET_LABEL_WICK_LENGTH, y: anchor.y }
      case "x-":
        return { x: anchor.x - NET_LABEL_WICK_LENGTH, y: anchor.y }
      case "y+":
        return { x: anchor.x, y: anchor.y + NET_LABEL_WICK_LENGTH }
      case "y-":
        return { x: anchor.x, y: anchor.y - NET_LABEL_WICK_LENGTH }
      default:
        return anchor
    }
  }

  private dedupeConsecutivePoints(points: Point[]) {
    return points.filter((point, index) => {
      if (index === 0) return true
      const prev = points[index - 1]!
      return (
        Math.abs(point.x - prev.x) > 1e-9 || Math.abs(point.y - prev.y) > 1e-9
      )
    })
  }

  private getAlternatingOffsets(maxOffset: number, step: number) {
    const offsets = [0]
    for (let offset = step; offset <= maxOffset + 1e-9; offset += step) {
      offsets.push(offset, -offset)
    }
    return offsets
  }

  private getInvalidLabelCandidateReason(
    label: NetLabelPlacement,
    labelIndex: number,
  ): Exclude<
    CandidateRejectReason,
    "connector-chip-collision" | "connector-label-collision" | "no-connector"
  > | null {
    const bounds = getRectBounds(label.center, label.width, label.height)

    if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
      return "chip-collision"
    }

    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (i === labelIndex) continue

      const otherLabel = this.outputNetLabelPlacements[i]!
      const otherBounds = getRectBounds(
        otherLabel.center,
        otherLabel.width,
        otherLabel.height,
      )

      if (rectsOverlap(bounds, otherBounds)) {
        return "label-collision"
      }
    }

    const traceMap = Object.fromEntries(
      this.outputTraces.map((trace) => [trace.mspPairId, trace]),
    )

    if (rectIntersectsAnyTrace(bounds, traceMap).hasIntersection) {
      return "trace-collision"
    }

    return null
  }

  private getLabelTraceOverlapKind(
    label: NetLabelPlacement,
  ): LabelTraceOverlapKind | null {
    const bounds = getRectBounds(label.center, label.width, label.height)
    const minOverlapLength =
      label.orientation === "x+" || label.orientation === "x-"
        ? label.height * 0.75
        : label.width * 0.75
    const minFlatOverlapLength =
      label.orientation === "x+" || label.orientation === "x-"
        ? label.width * 0.75
        : label.height * 0.75
    let intersects = false

    for (const trace of this.outputTraces) {
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]!
        const p2 = trace.tracePath[i + 1]!
        const overlapLength = this.getSegmentRectOverlapLength(p1, p2, bounds)
        if (
          this.isFlatOverlapAlongLabel(
            label,
            p1,
            p2,
            overlapLength,
            minFlatOverlapLength,
          )
        ) {
          return "flat"
        }
        if (overlapLength >= minOverlapLength) {
          intersects = true
        }
      }
    }

    return intersects ? "intersects" : null
  }

  private isFlatOverlapAlongLabel(
    label: NetLabelPlacement,
    p1: Point,
    p2: Point,
    overlapLength: number,
    minFlatOverlapLength: number,
    EPS = 1e-9,
  ) {
    if (overlapLength < minFlatOverlapLength) return false

    const isVertical = Math.abs(p1.x - p2.x) < EPS
    const isHorizontal = Math.abs(p1.y - p2.y) < EPS

    if (label.orientation === "x+" || label.orientation === "x-") {
      return isHorizontal
    }

    if (label.orientation === "y+" || label.orientation === "y-") {
      return isVertical
    }

    return false
  }

  private getSegmentRectOverlapLength(
    p1: Point,
    p2: Point,
    rect: { minX: number; minY: number; maxX: number; maxY: number },
    EPS = 1e-9,
  ) {
    const isVertical = Math.abs(p1.x - p2.x) < EPS
    const isHorizontal = Math.abs(p1.y - p2.y) < EPS

    if (isVertical) {
      if (p1.x < rect.minX - EPS || p1.x > rect.maxX + EPS) return 0

      const overlap =
        Math.min(Math.max(p1.y, p2.y), rect.maxY) -
        Math.max(Math.min(p1.y, p2.y), rect.minY)
      return Math.max(0, overlap)
    }

    if (isHorizontal) {
      if (p1.y < rect.minY - EPS || p1.y > rect.maxY + EPS) return 0

      const overlap =
        Math.min(Math.max(p1.x, p2.x), rect.maxX) -
        Math.max(Math.min(p1.x, p2.x), rect.minX)
      return Math.max(0, overlap)
    }

    return 0
  }

  private getValidConnectorPathResult({
    label,
    movedLabel,
    labelIndex,
  }: {
    label: NetLabelPlacement
    movedLabel: NetLabelPlacement
    labelIndex: number
  }): {
    tracePath: Point[] | null
    rejectReason: Extract<
      CandidateRejectReason,
      "connector-chip-collision" | "connector-label-collision" | "no-connector"
    >
  } {
    let rejectReason: Extract<
      CandidateRejectReason,
      "connector-chip-collision" | "connector-label-collision" | "no-connector"
    > = "no-connector"

    for (const tracePath of this.getOrthogonalConnectorPathCandidates(
      label.anchorPoint,
      movedLabel.anchorPoint,
    )) {
      if (this.connectorPathIntersectsChip(tracePath)) {
        if (rejectReason === "no-connector") {
          rejectReason = "connector-chip-collision"
        }
        continue
      }

      const connectorTrace = this.createConnectorTrace({
        label,
        tracePath,
        index: -1,
      })
      const labelsWithCandidate = this.outputNetLabelPlacements.map(
        (currentLabel, currentIndex) =>
          currentIndex === labelIndex ? movedLabel : currentLabel,
      )
      const overlaps = detectTraceLabelOverlap({
        traces: [connectorTrace],
        netLabels: labelsWithCandidate,
      })

      if (overlaps.length === 0) return { tracePath, rejectReason }

      if (rejectReason === "no-connector") {
        rejectReason = "connector-label-collision"
      }
    }

    return { tracePath: null, rejectReason }
  }

  private connectorPathIntersectsChip(tracePath: Point[]) {
    for (let i = 0; i < tracePath.length - 1; i++) {
      const start = tracePath[i]!
      const end = tracePath[i + 1]!

      for (const chip of this.inputProblem.chips) {
        if (segmentIntersectsRect(start, end, this.getChipBounds(chip))) {
          return true
        }
      }
    }

    return false
  }

  private getChipBounds(chip: InputChip) {
    return {
      minX: chip.center.x - chip.width / 2,
      maxX: chip.center.x + chip.width / 2,
      minY: chip.center.y - chip.height / 2,
      maxY: chip.center.y + chip.height / 2,
    }
  }

  private getOrthogonalConnectorPathCandidates(start: Point, end: Point) {
    const jogStep = 0.1

    if (Math.abs(start.x - end.x) < 1e-9 || Math.abs(start.y - end.y) < 1e-9) {
      if (Math.abs(start.y - end.y) < 1e-9) {
        return [
          [start, end],
          [
            start,
            { x: start.x, y: start.y - jogStep },
            { x: end.x, y: start.y - jogStep },
            end,
          ],
          [
            start,
            { x: start.x, y: start.y + jogStep },
            { x: end.x, y: start.y + jogStep },
            end,
          ],
        ]
      }

      return [
        [start, end],
        [
          start,
          { x: start.x - jogStep, y: start.y },
          { x: start.x - jogStep, y: end.y },
          end,
        ],
        [
          start,
          { x: start.x + jogStep, y: start.y },
          { x: start.x + jogStep, y: end.y },
          end,
        ],
      ]
    }

    return [
      [start, { x: end.x, y: start.y }, end],
      [start, { x: start.x, y: end.y }, end],
    ]
  }

  private createConnectorTrace({
    label,
    tracePath,
    index,
  }: {
    label: NetLabelPlacement
    tracePath: Point[]
    index: number
  }): SolvedTracePath {
    const pin = this.getConnectorPin(label)
    const mspPairId = `netlabel-relocation-${label.globalConnNetId}-${index}`

    return {
      mspPairId,
      dcConnNetId: label.dcConnNetId ?? label.globalConnNetId,
      globalConnNetId: label.globalConnNetId,
      userNetId: label.netId,
      pins: [pin, pin],
      tracePath,
      mspConnectionPairIds: [mspPairId],
      pinIds: label.pinIds,
    }
  }

  private addTraceIdToLabel(
    label: NetLabelPlacement,
    mspConnectionPairId: string,
  ): NetLabelPlacement {
    return {
      ...label,
      mspConnectionPairIds: [
        ...new Set([...label.mspConnectionPairIds, mspConnectionPairId]),
      ],
    }
  }

  private getConnectorPin(label: NetLabelPlacement): PinWithChipId {
    for (const pinId of label.pinIds) {
      const pin = this.pinMap.get(pinId)
      if (pin) return pin
    }

    return {
      pinId: label.pinIds[0] ?? label.globalConnNetId,
      x: label.anchorPoint.x,
      y: label.anchorPoint.y,
      chipId: "",
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)

    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.points) graphics.points = []
    if (!graphics.texts) graphics.texts = []

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "purple",
      })
    }

    for (const label of this.outputNetLabelPlacements) {
      graphics.rects.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
      } as any)
      graphics.points.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: getColorFromString(label.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${label.orientation}`,
      } as any)
    }

    if (!this.solved) {
      this.visualizeCandidateAttempts(graphics)
    }

    return graphics
  }

  private visualizeCandidateAttempts(graphics: GraphicsObject) {
    const latestAttempt =
      this.candidateAttempts[this.candidateAttempts.length - 1]

    for (const attempt of this.candidateAttempts) {
      const isLatest = attempt === latestAttempt && !this.solved
      const style = this.getCandidateAttemptStyle(attempt, isLatest)
      const label = attempt.label

      graphics.rects!.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: style.fill,
        strokeColor: style.stroke,
        strokeWidth: isLatest ? 0.045 : 0.025,
        label: [
          `candidate: ${attempt.status}`,
          `phase: ${attempt.phase}`,
          `kind: ${attempt.kind}`,
          `orientation: ${label.orientation}`,
          attempt.rejectReason ? `reason: ${attempt.rejectReason}` : null,
          `netId: ${label.netId}`,
        ]
          .filter(Boolean)
          .join("\n"),
      } as any)

      const connectorPath = attempt.connectorPath ?? [
        attempt.originalLabel.anchorPoint,
        label.anchorPoint,
      ]
      graphics.lines!.push({
        points: connectorPath,
        strokeColor: style.stroke,
        strokeDash:
          attempt.status === "rejected" || !attempt.connectorPath
            ? "4 2"
            : undefined,
        strokeWidth: isLatest ? 0.04 : 0.025,
      } as any)

      graphics.points!.push({
        x: attempt.originalLabel.anchorPoint.x,
        y: attempt.originalLabel.anchorPoint.y,
        color: "gray",
        label: `original anchor\nnetId: ${attempt.originalLabel.netId}`,
      } as any)
      graphics.points!.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: style.stroke,
        label: `candidate anchor\norientation: ${label.orientation}`,
      } as any)
    }
  }

  private getCandidateAttemptStyle(
    attempt: RelocationCandidateAttempt,
    isLatest: boolean,
  ) {
    if (attempt.status === "accepted") {
      return {
        fill: isLatest ? "rgba(0, 170, 80, 0.35)" : "rgba(0, 170, 80, 0.22)",
        stroke: "green",
      }
    }

    switch (attempt.rejectReason) {
      case "chip-collision":
      case "connector-chip-collision":
        return {
          fill: isLatest ? "rgba(220, 0, 0, 0.32)" : "rgba(220, 0, 0, 0.18)",
          stroke: "red",
        }
      case "trace-collision":
      case "connector-label-collision":
      case "no-connector":
        return {
          fill: isLatest
            ? "rgba(220, 140, 0, 0.32)"
            : "rgba(220, 140, 0, 0.18)",
          stroke: "orange",
        }
      case "label-collision":
        return {
          fill: isLatest
            ? "rgba(120, 80, 220, 0.28)"
            : "rgba(120, 80, 220, 0.16)",
          stroke: "purple",
        }
      default:
        return {
          fill: isLatest
            ? "rgba(120, 120, 120, 0.24)"
            : "rgba(120, 120, 120, 0.14)",
          stroke: "gray",
        }
    }
  }
}
