import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import {
  segmentCrossesBoundsInterior,
  traceCrossesBoundsInterior,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { moveAttachedLabelsToReroutedTrace } from "lib/solvers/Example28Solver/labelMovement"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathOverlapTraceStrokes } from "lib/utils/doesPathCoincideWithTraces"
import {
  EPS,
  getDistance,
  getTraceCorners,
  isTraceLine,
  rectsOverlap,
  tracePathContainsPoint,
} from "./geometry"
import type {
  Bounds,
  CornerCandidateStatus,
  EvaluatedCornerCandidate,
  TraceCornerCandidate,
  RailNetLabelCornerPlacementSolverParams,
} from "./types"
import { visualizeRailNetLabelCornerPlacementSolver } from "./visualize"
import { rectIntersectsAnyTextBox } from "lib/utils/textBoxBounds"

const LABEL_TRACE_CLEARANCE = 0.1

export class RailNetLabelCornerPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputNetLabelPlacements: NetLabelPlacement[]
  queuedLabelIndices: number[] = []
  currentLabelIndex: number | null = null
  currentLabel: NetLabelPlacement | null = null
  currentCandidateResults: EvaluatedCornerCandidate[] = []

  private queuedCornerCandidates: TraceCornerCandidate[] = []
  private shouldAdvanceToNextLabel = false
  private traceMap: Record<string, SolvedTracePath>

  constructor(params: RailNetLabelCornerPlacementSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.traceMap = Object.fromEntries(
      params.traces.map((trace) => [trace.mspPairId, trace]),
    )
    this.queuedLabelIndices = this.getProcessableLabelIndices()
    this.prepareNextLabel()
  }

  override getConstructorParams(): ConstructorParameters<
    typeof RailNetLabelCornerPlacementSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    if (this.shouldAdvanceToNextLabel) {
      this.advanceToNextLabel()
      return
    }

    const label = this.currentLabel
    const labelIndex = this.currentLabelIndex
    if (label === null || labelIndex === null) {
      this.finish()
      return
    }

    const candidate = this.queuedCornerCandidates.shift()
    if (!candidate) {
      this.shouldAdvanceToNextLabel = true
      return
    }

    const result = this.evaluateCornerCandidate(label, labelIndex, candidate)
    this.currentCandidateResults.push(result)

    if (result.status !== "valid") return

    result.selected = true
    this.applyCandidate(labelIndex, label, result)
    this.shouldAdvanceToNextLabel = true
  }

  getOutput() {
    return {
      traces: this.traces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private getProcessableLabelIndices() {
    const labelIndices: number[] = []

    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      const label = this.outputNetLabelPlacements[i]!
      if (!this.shouldProcessLabel(label)) continue

      labelIndices.push(i)
    }

    return labelIndices
  }

  private prepareNextLabel() {
    const labelIndex = this.queuedLabelIndices.shift()
    if (labelIndex === undefined) {
      this.clearCurrentLabel()
      return false
    }

    const label = this.outputNetLabelPlacements[labelIndex]!
    this.currentLabelIndex = labelIndex
    this.currentLabel = label
    this.currentCandidateResults = []
    this.queuedCornerCandidates = this.getCornerCandidatesForLabel(label)

    return true
  }

  private advanceToNextLabel() {
    this.shouldAdvanceToNextLabel = false
    if (!this.prepareNextLabel()) this.finish()
  }

  private clearCurrentLabel() {
    this.currentLabelIndex = null
    this.currentLabel = null
    this.currentCandidateResults = []
    this.queuedCornerCandidates = []
  }

  private finish() {
    this.clearCurrentLabel()
    this.solved = true
  }

  private evaluateCornerCandidate(
    label: NetLabelPlacement,
    labelIndex: number,
    candidate: TraceCornerCandidate,
  ): EvaluatedCornerCandidate {
    const center = getCenterFromAnchor(
      candidate.anchorPoint,
      label.orientation,
      label.width,
      label.height,
    )
    const bounds = getRectBounds(center, label.width, label.height)

    return {
      ...candidate,
      center,
      width: label.width,
      height: label.height,
      status: this.getCandidateStatus(bounds, labelIndex, candidate),
      selected: false,
    }
  }

  private getCandidateStatus(
    bounds: Bounds,
    labelIndex: number,
    candidate: TraceCornerCandidate,
  ): CornerCandidateStatus {
    if (this.intersectsAnyChip(bounds)) return "chip-collision"
    if (rectIntersectsAnyTextBox(bounds, this.inputProblem))
      return "text-collision"
    const candidateTraceMap = candidate.reroutedTracePath
      ? {
          ...this.traceMap,
          [candidate.traceId]: {
            ...this.traceMap[candidate.traceId]!,
            tracePath: candidate.reroutedTracePath,
          },
        }
      : this.traceMap
    if (traceCrossesBoundsInterior(bounds, candidateTraceMap)) {
      return "trace-collision"
    }
    if (
      candidate.reroutedTracePath &&
      !this.isReroutedTraceClear(candidate, labelIndex)
    ) {
      return "trace-collision"
    }
    if (this.intersectsAnyOtherNetLabel(bounds, labelIndex)) {
      return "netlabel-collision"
    }

    return "valid"
  }

  private applyCandidate(
    labelIndex: number,
    label: NetLabelPlacement,
    candidate: EvaluatedCornerCandidate,
  ) {
    if (candidate.reroutedTracePath) {
      const originalTrace = this.traceMap[candidate.traceId]!
      const reroutedTrace = {
        ...originalTrace,
        tracePath: candidate.reroutedTracePath,
      }
      this.traces = this.traces.map((trace) =>
        trace.mspPairId === candidate.traceId ? reroutedTrace : trace,
      )
      this.traceMap[candidate.traceId] = reroutedTrace
      this.outputNetLabelPlacements = moveAttachedLabelsToReroutedTrace({
        trace: originalTrace,
        originalTracePath: originalTrace.tracePath,
        reroutedTracePath: candidate.reroutedTracePath,
        netLabelPlacements: this.outputNetLabelPlacements,
      })
    }

    this.outputNetLabelPlacements[labelIndex] = {
      ...label,
      anchorPoint: candidate.anchorPoint,
      center: candidate.center,
    }
  }

  private shouldProcessLabel(label: NetLabelPlacement) {
    // Power/ground rail labels (VCC, GND, V3_3, ...) have a fixed vertical
    // orientation and read best snapped to a trace corner rather than floating
    // mid-segment. Signal labels (x+/x-) are left where they are.
    const isVerticalRailLabel =
      label.orientation === "y+" || label.orientation === "y-"
    return (
      isVerticalRailLabel && this.getCornerCandidatesForLabel(label).length > 0
    )
  }

  private intersectsAnyChip(bounds: Bounds) {
    return this.inputProblem.chips.some((chip) =>
      rectsOverlap(bounds, getRectBounds(chip.center, chip.width, chip.height)),
    )
  }

  private intersectsAnyOtherNetLabel(bounds: Bounds, labelIndex: number) {
    return this.outputNetLabelPlacements.some((label, index) => {
      if (index === labelIndex) return false
      return rectsOverlap(
        bounds,
        getRectBounds(label.center, label.width, label.height),
      )
    })
  }

  private getCornerCandidatesForLabel(label: NetLabelPlacement) {
    const anchorAlignedCandidates: TraceCornerCandidate[] = []
    const railAlignedCandidates: TraceCornerCandidate[] = []
    const labelTraces = this.getTraceLinesForLabel(label)
    const allowRailAlignedFallback =
      this.isConfiguredRailLabel(label) &&
      (this.isLabelCrossedByOtherNetTrace(label) ||
        !labelTraces.some((trace) =>
          getTraceCorners(trace.tracePath).some((corner) =>
            this.pointsEqual(corner, label.anchorPoint),
          ),
        ))

    for (const trace of labelTraces) {
      const path = trace.tracePath
      const pins = [path[0]!, path[path.length - 1]!]
      for (const anchorPoint of getTraceCorners(path)) {
        const cornerIndex = path.indexOf(anchorPoint)
        const anchorAlignedToPin = pins.some(
          (pin) => Math.abs(pin.x - anchorPoint.x) <= EPS,
        )
        const pinAligned =
          anchorAlignedToPin ||
          (allowRailAlignedFallback &&
            this.isPinAlignedCorner(path, cornerIndex))
        if (!pinAligned) continue

        const candidates = anchorAlignedToPin
          ? anchorAlignedCandidates
          : railAlignedCandidates
        candidates.push(
          {
            anchorPoint,
            traceId: trace.mspPairId,
            distance: getDistance(anchorPoint, label.anchorPoint),
            pinAligned,
          },
          ...this.getClearanceShiftedCornerCandidates({
            label,
            trace,
            cornerIndex,
            pinAligned,
          }),
        )
      }
    }

    return [
      ...anchorAlignedCandidates.sort((a, b) => a.distance - b.distance),
      ...railAlignedCandidates.sort((a, b) => a.distance - b.distance),
    ]
  }

  private isConfiguredRailLabel(label: NetLabelPlacement) {
    if (!label.netId) return false
    return this.inputProblem.availableNetLabelOrientations[label.netId]?.some(
      (orientation) => orientation === "y+" || orientation === "y-",
    )
  }

  private isLabelCrossedByOtherNetTrace(label: NetLabelPlacement) {
    const bounds = getRectBounds(label.center, label.width, label.height)
    const otherNetTraceMap = Object.fromEntries(
      this.traces
        .filter((trace) => trace.globalConnNetId !== label.globalConnNetId)
        .map((trace) => [trace.mspPairId, trace]),
    )

    return traceCrossesBoundsInterior(bounds, otherNetTraceMap)
  }

  private pointsEqual(a: Point, b: Point) {
    return Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS
  }

  private getVerticalSegmentPointIndices(path: Point[], cornerIndex: number) {
    const corner = path[cornerIndex]!
    const previousIsVertical =
      Math.abs(path[cornerIndex - 1]!.x - corner.x) <= EPS
    const nextIsVertical = Math.abs(path[cornerIndex + 1]!.x - corner.x) <= EPS
    if (previousIsVertical === nextIsVertical) return null

    const indices = previousIsVertical
      ? [cornerIndex - 1, cornerIndex]
      : [cornerIndex, cornerIndex + 1]
    return indices
  }

  private isPinAlignedCorner(path: Point[], cornerIndex: number) {
    const verticalPointIndices = this.getVerticalSegmentPointIndices(
      path,
      cornerIndex,
    )
    if (!verticalPointIndices) return false

    const [startIndex, endIndex] = verticalPointIndices
    return startIndex! <= 1 || endIndex! >= path.length - 2
  }

  private getClearanceShiftedCornerCandidates({
    label,
    trace,
    cornerIndex,
    pinAligned,
  }: {
    label: NetLabelPlacement
    trace: SolvedTracePath
    cornerIndex: number
    pinAligned: boolean
  }): TraceCornerCandidate[] {
    if (label.orientation !== "y+" && label.orientation !== "y-") return []

    const path = trace.tracePath
    const corner = path[cornerIndex]!
    const verticalPointIndices = this.getVerticalSegmentPointIndices(
      path,
      cornerIndex,
    )
    if (
      !verticalPointIndices ||
      verticalPointIndices.includes(0) ||
      verticalPointIndices.includes(path.length - 1)
    ) {
      return []
    }

    const center = getCenterFromAnchor(
      corner,
      label.orientation,
      label.width,
      label.height,
    )
    const labelBounds = getRectBounds(center, label.width, label.height)
    const collidingChipBounds = this.inputProblem.chips
      .map((chip) => getRectBounds(chip.center, chip.width, chip.height))
      .filter((chipBounds) => rectsOverlap(labelBounds, chipBounds))
    const shiftedCoordinates = new Set<number>()
    for (const chipBounds of collidingChipBounds) {
      shiftedCoordinates.add(chipBounds.minX - label.width / 2)
      shiftedCoordinates.add(chipBounds.maxX + label.width / 2)
    }
    for (const otherTrace of this.traces) {
      if (otherTrace.globalConnNetId === label.globalConnNetId) continue

      for (let i = 0; i < otherTrace.tracePath.length - 1; i++) {
        const start = otherTrace.tracePath[i]!
        const end = otherTrace.tracePath[i + 1]!
        if (!segmentCrossesBoundsInterior(start, end, labelBounds)) continue

        const halfLabelWidth = label.width / 2
        if (Math.abs(start.x - end.x) <= EPS) {
          shiftedCoordinates.add(
            start.x - halfLabelWidth - LABEL_TRACE_CLEARANCE,
          )
          shiftedCoordinates.add(
            start.x + halfLabelWidth + LABEL_TRACE_CLEARANCE,
          )
        } else {
          shiftedCoordinates.add(
            Math.min(start.x, end.x) - halfLabelWidth - LABEL_TRACE_CLEARANCE,
          )
          shiftedCoordinates.add(
            Math.max(start.x, end.x) + halfLabelWidth + LABEL_TRACE_CLEARANCE,
          )
        }
      }
    }

    return [...shiftedCoordinates].flatMap((x) => {
      if (Math.abs(x - corner.x) <= EPS) return []
      const reroutedTracePath = simplifyPath(
        path.map((point, pointIndex) =>
          verticalPointIndices.includes(pointIndex) ? { ...point, x } : point,
        ),
      )
      const anchorPoint = { x, y: corner.y }
      const remainsCorner = getTraceCorners(reroutedTracePath).some((point) =>
        this.pointsEqual(point, anchorPoint),
      )
      if (!remainsCorner) return []

      return [
        {
          anchorPoint,
          traceId: trace.mspPairId,
          distance: getDistance(anchorPoint, label.anchorPoint),
          pinAligned,
          reroutedTracePath,
        },
      ]
    })
  }

  private isReroutedTraceClear(
    candidate: TraceCornerCandidate,
    labelIndex: number,
  ) {
    const reroutedTracePath = candidate.reroutedTracePath!
    if (
      isPathCollidingWithObstacles(
        reroutedTracePath,
        getObstacleRects(this.inputProblem),
      )
    ) {
      return false
    }

    const candidateTrace = this.traceMap[candidate.traceId]!
    const otherNetTraces = this.traces.filter(
      (trace) =>
        trace.mspPairId !== candidate.traceId &&
        trace.globalConnNetId !== candidateTrace.globalConnNetId,
    )
    if (doesPathOverlapTraceStrokes(reroutedTracePath, otherNetTraces)) {
      return false
    }

    const reroutedTraceMap = {
      [candidate.traceId]: {
        ...candidateTrace,
        tracePath: reroutedTracePath,
      },
    }
    return this.outputNetLabelPlacements.every((label, index) => {
      if (index === labelIndex) return true
      return !traceCrossesBoundsInterior(
        getRectBounds(label.center, label.width, label.height),
        reroutedTraceMap,
      )
    })
  }

  private getTraceLinesForLabel(label: NetLabelPlacement) {
    return this.traces.filter(
      (trace) => isTraceLine(trace) && this.isTraceForLabel(trace, label),
    )
  }

  private isTraceForLabel(trace: SolvedTracePath, label: NetLabelPlacement) {
    if (!tracePathContainsPoint(trace.tracePath, label.anchorPoint)) {
      return false
    }

    const traceIds = new Set(label.mspConnectionPairIds)
    if (traceIds.size > 0) {
      return traceIds.has(trace.mspPairId)
    }

    return trace.globalConnNetId === label.globalConnNetId
  }

  override visualize(): GraphicsObject {
    return visualizeRailNetLabelCornerPlacementSolver({
      inputProblem: this.inputProblem,
      traces: this.traces,
      outputNetLabelPlacements: this.outputNetLabelPlacements,
      currentLabel: this.currentLabel,
      currentCandidateResults: this.currentCandidateResults,
      solved: this.solved,
    })
  }
}
