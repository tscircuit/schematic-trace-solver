import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getDimsForOrientation,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type {
  InputNetConnection,
  InputPin,
  InputProblem,
} from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"
import { rectIntersectsAnyTextBox } from "lib/utils/textBoxBounds"
import { EPS, LABEL_SEARCH_STEP, WICK_CLEARANCE } from "./constants"
import {
  getConnectorTracePath,
  getMaxSearchDistance,
  getSideDistances,
  isXOrientation,
  isYOrientation,
  rangesOverlap,
  rectsOverlap,
  simplifyOrthogonalPath,
  traceCrossesBoundsInterior,
  tracePathCrossesAnyBounds,
  tracePathIntersectsBounds,
} from "./geometry"
import { getPinMap, getTracePins, toNetLabelPlacementPatch } from "./traces"
import type {
  AvailableNetOrientationSolverParams,
  Bounds,
  CandidateLabel,
  CandidatePhase,
  CandidateStatus,
  ChipSide,
  EvaluatedCandidate,
} from "./types"
import { visualizeAvailableNetOrientationSolver } from "./visualize"

const LABEL_TRACE_CLEARANCE = 0.1

export class AvailableNetOrientationSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputNetLabelPlacements: NetLabelPlacement[]
  queuedLabelIndices: number[] = []
  currentLabelIndex: number | null = null
  currentLabel: NetLabelPlacement | null = null
  currentCandidateResults: EvaluatedCandidate[] = []

  blockedStandaloneLabelIndex: number | null = null
  blockedStandaloneLabelTargetAnchorX: number | null = null
  private traceMap: Record<string, SolvedTracePath>
  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private maxSearchDistance: number
  private pinMap: Record<string, InputPin & { chipId: string }>

  constructor(params: AvailableNetOrientationSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = [...params.traces]
    this.netLabelPlacements = params.netLabelPlacements
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.traceMap = Object.fromEntries(
      this.traces.map((trace) => [trace.mspPairId, trace]),
    )
    this.pinMap = getPinMap(params.inputProblem)
    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
    this.maxSearchDistance = getMaxSearchDistance(params.inputProblem)
    this.queuedLabelIndices = this.getProcessableLabelIndices()
    this.setCurrentLabel(this.queuedLabelIndices[0] ?? null)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof AvailableNetOrientationSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    const labelIndex = this.queuedLabelIndices.shift()
    if (labelIndex === undefined) {
      this.finish()
      return
    }

    this.processLabel(labelIndex)
  }

  getOutput() {
    return {
      traces: this.traces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private getProcessableLabelIndices() {
    const indices: number[] = []

    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (this.shouldProcessLabel(this.outputNetLabelPlacements[i]!)) {
        indices.push(i)
      }
    }

    const blockedStandaloneLabelIndex = indices.find((index) => {
      const label = this.outputNetLabelPlacements[index]!
      const orientations = this.getAvailableOrientations(label)
      return (
        this.isPortOnlyLabel(label) &&
        this.isStandaloneSinglePinNetLabel(label) &&
        orientations.length === 1 &&
        isYOrientation(orientations[0]!) &&
        this.labelIntersectsDifferentNetTrace(label)
      )
    })
    if (blockedStandaloneLabelIndex === undefined) return indices
    this.blockedStandaloneLabelIndex = blockedStandaloneLabelIndex
    this.blockedStandaloneLabelTargetAnchorX = null

    const blockedLabel =
      this.outputNetLabelPlacements[blockedStandaloneLabelIndex]!
    const requiredOrientation = this.getAvailableOrientations(blockedLabel)[0]!
    const chipSide = this.getChipSideForPoint(blockedLabel.anchorPoint)
    const affectedSlots: number[] = []
    const labelsToOrder: number[] = []

    for (let slot = 0; slot < indices.length; slot++) {
      const index = indices[slot]!
      const label = this.outputNetLabelPlacements[index]!
      const orientations = this.getAvailableOrientations(label)
      if (
        this.getChipSideForPoint(label.anchorPoint) === chipSide &&
        orientations.length === 1 &&
        orientations[0] === requiredOrientation
      ) {
        affectedSlots.push(slot)
        labelsToOrder.push(index)
      }
    }

    // Place vertical labels on the same chip side from the outward end inward.
    // The standalone label is corrected first, then a lower neighbor yields
    // space during its own placement, keeping the standalone connector direct.
    labelsToOrder.sort((a, b) => {
      const aY = this.outputNetLabelPlacements[a]!.anchorPoint.y
      const bY = this.outputNetLabelPlacements[b]!.anchorPoint.y
      return requiredOrientation === "y+" ? bY - aY : aY - bY
    })
    const blockedLabelWidth = this.getNetLabelWidth(blockedLabel)
    let columnLabelIndex: number | undefined
    if (blockedLabelWidth !== undefined) {
      columnLabelIndex = labelsToOrder.find((index) => {
        if (index === blockedStandaloneLabelIndex) return false
        const label = this.outputNetLabelPlacements[index]!
        return this.getNetLabelWidth(label) === blockedLabelWidth
      })
    }
    if (columnLabelIndex !== undefined) {
      const columnLabel = this.outputNetLabelPlacements[columnLabelIndex]!
      // Reuse the established same-width column instead of a nearby search step.
      this.blockedStandaloneLabelTargetAnchorX = this.getSearchStartAnchor(
        columnLabel,
        requiredOrientation,
      ).x
    }
    for (let i = 0; i < affectedSlots.length; i++) {
      indices[affectedSlots[i]!] = labelsToOrder[i]!
    }

    return indices
  }

  private shouldProcessLabel(label: NetLabelPlacement) {
    const orientations = this.getAvailableOrientations(label)
    return orientations.length > 0 && !orientations.includes(label.orientation)
  }

  private processLabel(labelIndex: number) {
    const label = this.outputNetLabelPlacements[labelIndex]!
    this.setCurrentLabel(labelIndex)
    this.currentCandidateResults = []

    const candidate = this.findCorrectedCandidate(label, labelIndex)
    if (!candidate) return

    this.applyCandidate(label, candidate, labelIndex)
  }

  private applyCandidate(
    label: NetLabelPlacement,
    candidate: EvaluatedCandidate,
    labelIndex: number,
  ) {
    this.outputNetLabelPlacements[labelIndex] = {
      ...label,
      ...toNetLabelPlacementPatch(candidate),
    }
    this.addConnectorTrace(label, candidate, labelIndex)
  }

  private addConnectorTrace(
    label: NetLabelPlacement,
    candidate: EvaluatedCandidate,
    labelIndex: number,
  ) {
    if (candidate.phase === "trace-anchor") return

    const tracePath = this.getCandidateConnectorTrace(label, candidate)
    if (tracePath.length < 2) return

    const mspPairId = `available-net-orientation-${labelIndex}-${label.netId ?? label.globalConnNetId}`
    const connectorTrace: SolvedTracePath = {
      mspPairId,
      dcConnNetId: label.dcConnNetId ?? label.globalConnNetId,
      globalConnNetId: label.globalConnNetId,
      userNetId: label.netId,
      pins: getTracePins(label, this.pinMap),
      tracePath,
      mspConnectionPairIds: [mspPairId],
      pinIds: label.pinIds,
    }

    this.traces.push(connectorTrace)
    this.traceMap[mspPairId] = connectorTrace
  }

  private finish() {
    this.currentLabelIndex = null
    this.currentLabel = null
    this.currentCandidateResults = []
    this.solved = true
  }

  private setCurrentLabel(labelIndex: number | null) {
    this.currentLabelIndex = labelIndex
    this.currentLabel =
      labelIndex === null ? null : this.outputNetLabelPlacements[labelIndex]!
  }

  private findCorrectedCandidate(label: NetLabelPlacement, labelIndex: number) {
    const orientations = this.getAvailableOrientations(label)
    const requiredOrientation = orientations[0]!
    const netConnection = this.inputProblem.netConnections.find(
      (connection) => connection.netId === label.netId,
    )
    const isTwoPinNet = netConnection?.pinIds.length === 2
    const isDistanceSplitVerticalRail =
      (netConnection?.pinIds.length ?? 0) > 2 &&
      isYOrientation(requiredOrientation) &&
      this.hasPortOnlyLabelOnSameNet(label)
    const isPairedSameSidePowerRail =
      isYOrientation(requiredOrientation) &&
      this.hasOppositeVerticalRailOnSameChipSide(label, requiredOrientation)
    if (
      orientations.length === 1 &&
      isYOrientation(requiredOrientation) &&
      this.isOutwardHorizontalFallback(label) &&
      this.hasTraceContinuingInOrientation(label, requiredOrientation) &&
      (isDistanceSplitVerticalRail || isPairedSameSidePowerRail)
    ) {
      // Keep the established outward column, but attach at the furthest trace
      // point in the required vertical direction. This places y+ labels above
      // a rail and y- labels below it while using a short horizontal connector.
      const traceAnchorCandidate = this.findValidOutwardTraceAnchorCandidate(
        label,
        requiredOrientation,
        labelIndex,
      )
      if (traceAnchorCandidate) return traceAnchorCandidate
    }

    if (
      isTwoPinNet &&
      orientations.length === 1 &&
      isYOrientation(requiredOrientation) &&
      this.hasTraceContinuingInOrientation(label, requiredOrientation)
    ) {
      // Keep two-pin vertical net labels aligned with the existing trace.
      const alignedCandidate = this.findValidCandidateInShiftColumn({
        label,
        labelIndex,
        orientation: requiredOrientation,
        direction: dir(requiredOrientation),
        baseAnchor: this.getWickOffsetAnchor(
          label.anchorPoint,
          requiredOrientation,
        ),
        maxSearchDistance: this.maxSearchDistance,
        outwardDistance: 0,
        stopOnTraceCollision: false,
      })
      if (alignedCandidate) return alignedCandidate
    }

    const rotatedCandidate = this.findValidRotatedCandidate(
      label,
      labelIndex,
      orientations,
    )
    if (rotatedCandidate) return rotatedCandidate

    const traceAnchorCandidate = this.findValidTraceAnchorCandidate(
      label,
      orientations[0]!,
      labelIndex,
    )
    if (traceAnchorCandidate) return traceAnchorCandidate

    const shiftedCandidate = this.findValidShiftedCandidate(
      label,
      orientations[0]!,
      labelIndex,
    )
    if (shiftedCandidate) return shiftedCandidate

    return this.findValidLateralShiftedCandidate(
      label,
      orientations[0]!,
      labelIndex,
    )
  }

  private hasTraceContinuingInOrientation(
    label: NetLabelPlacement,
    orientation: "y+" | "y-",
  ) {
    const direction = dir(orientation)
    return Object.values(this.traceMap).some((trace) => {
      if (trace.globalConnNetId !== label.globalConnNetId) return false
      const path = trace.tracePath
      return path.some((point, pointIndex) => {
        if (
          Math.abs(point.x - label.anchorPoint.x) > EPS ||
          Math.abs(point.y - label.anchorPoint.y) > EPS
        ) {
          return false
        }
        return [path[pointIndex - 1], path[pointIndex + 1]].some(
          (neighbor) =>
            neighbor &&
            Math.abs(neighbor.x - point.x) <= EPS &&
            (neighbor.y - point.y) * direction.y > EPS,
        )
      })
    })
  }

  private findValidRotatedCandidate(
    label: NetLabelPlacement,
    labelIndex: number,
    orientations: FacingDirection[],
  ) {
    for (const orientation of orientations) {
      const candidate = this.createCandidate(
        label,
        this.getSearchStartAnchor(label, orientation),
        orientation,
      )
      const result = this.evaluateCandidate(
        candidate,
        label,
        labelIndex,
        "rotate",
      )
      this.currentCandidateResults.push(result)
      if (result.status === "valid") {
        result.selected = true
        return result
      }
    }

    return null
  }

  private findValidTraceAnchorCandidate(
    label: NetLabelPlacement,
    orientation: FacingDirection,
    labelIndex: number,
  ) {
    const direction = dir(orientation)
    const candidatePoints = this.getTraceAnchorCandidatePoints(label).sort(
      (a, b) => {
        const aAlongDirection = a.x * direction.x + a.y * direction.y
        const bAlongDirection = b.x * direction.x + b.y * direction.y
        return bAlongDirection - aAlongDirection
      },
    )

    for (const anchorPoint of candidatePoints) {
      const candidate = this.createCandidate(label, anchorPoint, orientation)
      const result = this.evaluateCandidate(
        candidate,
        label,
        labelIndex,
        "trace-anchor",
      )
      this.currentCandidateResults.push(result)

      if (result.status === "valid") {
        result.selected = true
        return result
      }
    }

    return null
  }

  private findValidOutwardTraceAnchorCandidate(
    label: NetLabelPlacement,
    orientation: FacingDirection,
    labelIndex: number,
  ) {
    const direction = dir(orientation)
    const candidatePoints = this.getTraceAnchorCandidatePoints(label).sort(
      (a, b) => {
        const aAlongDirection = a.x * direction.x + a.y * direction.y
        const bAlongDirection = b.x * direction.x + b.y * direction.y
        return bAlongDirection - aAlongDirection
      },
    )

    for (const connectorSource of candidatePoints) {
      const preservedColumnAnchor = this.getSearchStartAnchor(
        label,
        orientation,
      )
      const preservedColumnCandidate = this.createCandidate(
        label,
        {
          x: preservedColumnAnchor.x,
          y: connectorSource.y,
        },
        orientation,
        connectorSource,
      )
      const preservedColumnResult = this.evaluateCandidate(
        preservedColumnCandidate,
        label,
        labelIndex,
        "outward-trace-anchor",
      )
      this.currentCandidateResults.push(preservedColumnResult)
      if (preservedColumnResult.status === "valid") {
        preservedColumnResult.selected = true
        return preservedColumnResult
      }

      const outwardDirection = this.getPerpendicularOutwardDirection(
        connectorSource,
        orientation,
      )
      if (outwardDirection.x === 0 && outwardDirection.y === 0) continue

      for (
        let distance = LABEL_SEARCH_STEP;
        distance <= this.maxSearchDistance + EPS;
        distance += LABEL_SEARCH_STEP
      ) {
        const anchorPoint = {
          x: connectorSource.x + outwardDirection.x * distance,
          y: connectorSource.y + outwardDirection.y * distance,
        }
        const candidate = this.createCandidate(
          label,
          anchorPoint,
          orientation,
          connectorSource,
        )
        const result = this.evaluateCandidate(
          candidate,
          label,
          labelIndex,
          "outward-trace-anchor",
          distance,
        )
        this.currentCandidateResults.push(result)

        if (result.status === "valid") {
          result.selected = true
          return result
        }
      }
    }

    return null
  }

  private getTraceAnchorCandidatePoints(label: NetLabelPlacement) {
    const seen = new Set<string>()
    const points: Point[] = []

    for (const traceId of label.mspConnectionPairIds ?? []) {
      const trace = this.traceMap[traceId]
      if (!trace) continue
      for (const point of trace.tracePath) {
        const key = `${point.x.toFixed(9)},${point.y.toFixed(9)}`
        if (seen.has(key)) continue
        seen.add(key)
        points.push(point)
      }
    }

    return points
  }

  private getAvailableOrientations(label: NetLabelPlacement) {
    const effectiveNetId = label.netId ?? label.globalConnNetId
    return this.inputProblem.availableNetLabelOrientations[effectiveNetId] ?? []
  }

  private findValidShiftedCandidate(
    label: NetLabelPlacement,
    orientation: FacingDirection,
    labelIndex: number,
  ) {
    const direction = dir(orientation)
    const initialBaseAnchor = this.getSearchStartAnchor(label, orientation)
    const outwardDirection = this.getPerpendicularOutwardDirection(
      label.anchorPoint,
      orientation,
    )
    const maxSearchDistance = this.getSearchDistanceLimit(label, orientation)
    const maxOutwardDistance =
      outwardDirection.x === 0 && outwardDirection.y === 0
        ? 0
        : this.maxSearchDistance

    for (
      let outwardDistance = 0;
      outwardDistance <= maxOutwardDistance + EPS;
      outwardDistance += LABEL_SEARCH_STEP
    ) {
      const baseAnchor = {
        x: initialBaseAnchor.x + outwardDirection.x * outwardDistance,
        y: initialBaseAnchor.y + outwardDirection.y * outwardDistance,
      }
      const candidate = this.findValidCandidateInShiftColumn({
        label,
        labelIndex,
        orientation,
        direction,
        baseAnchor,
        maxSearchDistance,
        outwardDistance,
      })

      if (candidate) return candidate
    }

    return null
  }

  /**
   * When all candidates fail for the current (unshifted) position, try
   * shifting the label anchor laterally — x for y-orientations, y for
   * x-orientations — and re-attempting the required orientation.
   *
   * Offsets are tried in alternating sign order:
   *   -1·step, +1·step, -2·step, +2·step, …
   * so the nearest escape routes are tested first.
   */
  private findValidLateralShiftedCandidate(
    label: NetLabelPlacement,
    orientation: FacingDirection,
    labelIndex: number,
  ): EvaluatedCandidate | null {
    const direction = dir(orientation)
    const initialBaseAnchor = this.getSearchStartAnchor(label, orientation)

    // Lateral axis: perpendicular to the orientation direction
    const lateralDir: Point = {
      x: isYOrientation(orientation) ? 1 : 0,
      y: isXOrientation(orientation) ? 1 : 0,
    }

    const maxSteps = Math.ceil(this.maxSearchDistance / LABEL_SEARCH_STEP)

    for (let step = 1; step <= maxSteps; step++) {
      for (const sign of [-1, 1]) {
        const lateralOffset = sign * step * LABEL_SEARCH_STEP
        const baseAnchor = {
          x: initialBaseAnchor.x + lateralDir.x * lateralOffset,
          y: initialBaseAnchor.y + lateralDir.y * lateralOffset,
        }

        const maxSearchDistance = this.getLateralColumnMaxDistance(
          label,
          orientation,
          baseAnchor,
        )

        const candidate = this.findValidCandidateInShiftColumn({
          label,
          labelIndex,
          orientation,
          direction,
          baseAnchor,
          maxSearchDistance,
          outwardDistance: lateralOffset,
          phase: "lateral-shift",
        })

        if (candidate) return candidate
      }
    }

    return null
  }

  private findValidCandidateInShiftColumn(params: {
    label: NetLabelPlacement
    labelIndex: number
    orientation: FacingDirection
    direction: Point
    baseAnchor: Point
    maxSearchDistance: number
    outwardDistance: number
    phase?: CandidatePhase
    stopOnTraceCollision?: boolean
  }) {
    const {
      label,
      labelIndex,
      orientation,
      direction,
      baseAnchor,
      maxSearchDistance,
      outwardDistance,
      phase = "shift",
      stopOnTraceCollision = true,
    } = params

    for (
      let distance = LABEL_SEARCH_STEP;
      distance <= maxSearchDistance + EPS;
      distance += LABEL_SEARCH_STEP
    ) {
      const anchorPoint = {
        x: baseAnchor.x + direction.x * distance,
        y: baseAnchor.y + direction.y * distance,
      }
      const candidate = this.createCandidate(label, anchorPoint, orientation)
      const result = this.evaluateCandidate(
        candidate,
        label,
        labelIndex,
        phase,
        distance,
        outwardDistance,
      )
      this.currentCandidateResults.push(result)

      if (result.status === "valid") {
        result.selected = true
        return result
      }
      if (stopOnTraceCollision && result.status === "trace-collision") break
    }

    return null
  }

  private evaluateCandidate(
    candidate: CandidateLabel,
    label: NetLabelPlacement,
    labelIndex: number,
    phase: CandidatePhase,
    distance?: number,
    outwardDistance?: number,
  ): EvaluatedCandidate {
    return {
      ...candidate,
      phase,
      distance,
      outwardDistance,
      selected: false,
      status: this.getCandidateStatus({
        candidate,
        label,
        labelIndex,
        phase,
      }),
    }
  }

  private getCandidateConnectorTrace(
    label: NetLabelPlacement,
    candidate: Pick<
      EvaluatedCandidate,
      "anchorPoint" | "connectorSource" | "orientation" | "phase"
    >,
  ) {
    if (candidate.phase === "lateral-shift") {
      const orientDir = dir(candidate.orientation)
      const kickedSource = {
        x: label.anchorPoint.x - orientDir.x * LABEL_SEARCH_STEP,
        y: label.anchorPoint.y - orientDir.y * LABEL_SEARCH_STEP,
      }
      return simplifyOrthogonalPath([
        label.anchorPoint,
        ...getConnectorTracePath(
          kickedSource,
          candidate.anchorPoint,
          candidate.orientation,
        ),
      ])
    }

    return getConnectorTracePath(
      candidate.connectorSource ?? label.anchorPoint,
      candidate.anchorPoint,
      candidate.orientation,
    )
  }

  private isStandaloneSinglePinNetLabel(label: NetLabelPlacement) {
    return this.inputProblem.netConnections.some(
      (connection) =>
        connection.netId === label.netId &&
        connection.pinIds.length === 1 &&
        connection.pinIds[0] === label.pinIds[0],
    )
  }

  private labelIntersectsDifferentNetTrace(label: NetLabelPlacement) {
    const { width, height } = getDimsForOrientation({
      orientation: label.orientation,
      netLabelWidth: this.getNetLabelWidth(label),
      netLabelHeight: this.getNetLabelHeight(label),
    })
    const center = getCenterFromAnchor(
      label.anchorPoint,
      label.orientation,
      width,
      height,
    )
    const bounds = getRectBounds(center, width, height)
    return Object.values(this.traceMap).some(
      (trace) =>
        trace.globalConnNetId !== label.globalConnNetId &&
        tracePathIntersectsBounds(trace.tracePath, bounds),
    )
  }

  private getSearchStartAnchor(
    label: NetLabelPlacement,
    orientation: FacingDirection,
  ) {
    const anchorPoint = this.getWickOffsetAnchor(label.anchorPoint, orientation)
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth: this.getNetLabelWidth(label),
      netLabelHeight: this.getNetLabelHeight(label),
    })

    const searchStartAnchor = this.getSideOffsetAnchor({
      anchorPoint,
      labelAnchorPoint: label.anchorPoint,
      orientation,
      width,
      height,
    })
    if (
      this.blockedStandaloneLabelIndex !== null &&
      label ===
        this.outputNetLabelPlacements[this.blockedStandaloneLabelIndex] &&
      isYOrientation(orientation) &&
      this.blockedStandaloneLabelTargetAnchorX !== null
    ) {
      searchStartAnchor.x = this.blockedStandaloneLabelTargetAnchorX
    }
    return searchStartAnchor
  }

  private getWickOffsetAnchor(
    anchorPoint: Point,
    orientation: FacingDirection,
  ) {
    const direction = dir(orientation)
    return {
      x: anchorPoint.x + direction.x * WICK_CLEARANCE,
      y: anchorPoint.y + direction.y * WICK_CLEARANCE,
    }
  }

  private getSideOffsetAnchor(params: {
    anchorPoint: Point
    labelAnchorPoint: Point
    orientation: FacingDirection
    width: number
    height: number
  }) {
    const { anchorPoint, labelAnchorPoint, orientation, width, height } = params
    const chipSide = this.getChipSideForPoint(labelAnchorPoint)
    const sideClearance = this.getContainingChipSide(labelAnchorPoint)
      ? WICK_CLEARANCE
      : LABEL_SEARCH_STEP
    if (isYOrientation(orientation) && chipSide === "left") {
      return {
        x: anchorPoint.x - width / 2 - sideClearance,
        y: anchorPoint.y,
      }
    }
    if (isYOrientation(orientation) && chipSide === "right") {
      return {
        x: anchorPoint.x + width / 2 + sideClearance,
        y: anchorPoint.y,
      }
    }
    if (isXOrientation(orientation) && chipSide === "bottom") {
      return {
        x: anchorPoint.x,
        y: anchorPoint.y - height / 2 - sideClearance,
      }
    }
    if (isXOrientation(orientation) && chipSide === "top") {
      return {
        x: anchorPoint.x,
        y: anchorPoint.y + height / 2 + sideClearance,
      }
    }
    return anchorPoint
  }

  private getSearchDistanceLimit(
    label: NetLabelPlacement,
    orientation: FacingDirection,
  ) {
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth: this.getNetLabelWidth(label),
      netLabelHeight: this.getNetLabelHeight(label),
    })
    const labelLength =
      orientation === "y+" || orientation === "y-" ? height : width
    return Math.min(this.maxSearchDistance, labelLength * 2)
  }

  private getLateralColumnMaxDistance(
    label: NetLabelPlacement,
    orientation: FacingDirection,
    baseAnchor: Point,
  ) {
    const availableOrientations = this.getAvailableOrientations(label)
    const isSingleVerticalOrientation =
      availableOrientations.length === 1 &&
      isYOrientation(availableOrientations[0]!)

    // A vertical rail between components may need to branch laterally and then
    // search past either connected component before it can use its required
    // orientation. Keep other labels scoped to their first connected component
    // so an orientation correction does not move a signal label across the
    // entire connection.
    const labelChipIds = new Set(
      label.pinIds
        .map((pinId) => this.pinMap[pinId]?.chipId)
        .filter((chipId): chipId is string => Boolean(chipId)),
    )
    const connectedChips = this.chipObstacleSpatialIndex.chips.filter((chip) =>
      labelChipIds.has(chip.chipId),
    )
    const firstConnectedChipId = label.pinIds
      .map((pinId) => this.pinMap[pinId]?.chipId)
      .find(Boolean)
    const firstConnectedChip = connectedChips.find(
      (chip) => chip.chipId === firstConnectedChipId,
    )
    const labelChips = isSingleVerticalOrientation
      ? connectedChips
      : firstConnectedChip
        ? [firstConnectedChip]
        : []

    if (labelChips.length > 0) {
      if (orientation === "y-") {
        return Math.max(
          0,
          ...labelChips.map((chip) => baseAnchor.y - chip.bounds.minY),
        )
      }
      if (orientation === "y+") {
        return Math.max(
          0,
          ...labelChips.map((chip) => chip.bounds.maxY - baseAnchor.y),
        )
      }
      if (orientation === "x-") {
        return Math.max(
          0,
          ...labelChips.map((chip) => baseAnchor.x - chip.bounds.minX),
        )
      }
      if (orientation === "x+") {
        return Math.max(
          0,
          ...labelChips.map((chip) => chip.bounds.maxX - baseAnchor.x),
        )
      }
    }

    return this.getSearchDistanceLimit(label, orientation)
  }

  private createCandidate(
    label: NetLabelPlacement,
    anchorPoint: Point,
    orientation: FacingDirection,
    connectorSource?: Point,
  ): CandidateLabel {
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth: this.getNetLabelWidth(label),
      netLabelHeight: this.getNetLabelHeight(label),
    })
    return {
      orientation,
      anchorPoint,
      connectorSource,
      width,
      height,
      center: getCenterFromAnchor(anchorPoint, orientation, width, height),
    }
  }

  private getNetLabelWidth(label: NetLabelPlacement) {
    if (label.netId) {
      const ncWidth = this.inputProblem.netConnections.find(
        (connection) => connection.netId === label.netId,
      )?.netLabelWidth
      if (ncWidth !== undefined) return ncWidth

      const dcWidthByNetId = this.inputProblem.directConnections.find(
        (dc) => dc.netId === label.netId,
      )?.netLabelWidth
      if (dcWidthByNetId !== undefined) return dcWidthByNetId
    }

    const dcWidthByPinId = this.inputProblem.directConnections.find((dc) =>
      dc.pinIds.some((pid) => label.pinIds.includes(pid)),
    )?.netLabelWidth
    if (dcWidthByPinId !== undefined) return dcWidthByPinId

    return this.inputProblem.netConnections.find((nc) =>
      nc.pinIds.some((pid) => label.pinIds.includes(pid)),
    )?.netLabelWidth
  }

  private getNetLabelHeight(label: NetLabelPlacement) {
    if (label.netId) {
      const ncHeight = this.inputProblem.netConnections.find(
        (connection) => connection.netId === label.netId,
      )?.netLabelHeight
      if (ncHeight !== undefined) return ncHeight
    }

    return this.inputProblem.netConnections.find((nc) =>
      nc.pinIds.some((pid) => label.pinIds.includes(pid)),
    )?.netLabelHeight
  }

  private getCandidateStatus(params: {
    candidate: CandidateLabel
    label: NetLabelPlacement
    labelIndex: number
    phase: CandidatePhase
  }) {
    const { candidate, label, labelIndex, phase } = params
    const bounds = getRectBounds(
      candidate.center,
      candidate.width,
      candidate.height,
    )
    const boundsStatus = this.getBoundsStatus({
      bounds,
      labelIndex,
      label,
    })
    if (boundsStatus !== "valid") {
      if (
        phase !== "trace-anchor" ||
        boundsStatus !== "chip-collision" ||
        !this.isAcceptableTraceAnchorChipCollision(candidate, label, bounds)
      ) {
        return boundsStatus
      }

      const nonChipBoundsStatus = this.getBoundsStatus({
        bounds,
        labelIndex,
        label,
        ignoreChipCollisions: true,
      })
      if (nonChipBoundsStatus !== "valid") return nonChipBoundsStatus
    }

    const connectorTrace = this.getCandidateConnectorTrace(label, {
      anchorPoint: candidate.anchorPoint,
      orientation: candidate.orientation,
      phase,
    })

    for (const chip of this.chipObstacleSpatialIndex.chips) {
      if (tracePathCrossesAnyBounds(connectorTrace, chip.bounds)) {
        return "chip-collision"
      }
    }

    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (i === labelIndex) continue
      const otherLabel = this.outputNetLabelPlacements[i]!
      if (
        tracePathIntersectsBounds(
          connectorTrace,
          getRectBounds(otherLabel.center, otherLabel.width, otherLabel.height),
        )
      ) {
        return "netlabel-collision"
      }
    }

    return "valid"
  }

  private isAcceptableTraceAnchorChipCollision(
    candidate: CandidateLabel,
    label: NetLabelPlacement,
    bounds: Bounds,
  ) {
    const collidingChips =
      this.chipObstacleSpatialIndex.getChipsInBounds(bounds)
    if (collidingChips.length === 0) return false

    const labelChipIds = new Set(
      label.pinIds
        .map((pinId) => this.pinMap[pinId]?.chipId)
        .filter((chipId): chipId is string => Boolean(chipId)),
    )

    return collidingChips.every((chip) => {
      if (!labelChipIds.has(chip.chipId)) return false

      const { anchorPoint, orientation } = candidate
      const chipBounds = chip.bounds
      if (isYOrientation(orientation)) {
        return (
          anchorPoint.x < chipBounds.minX - EPS ||
          anchorPoint.x > chipBounds.maxX + EPS
        )
      }
      return (
        anchorPoint.y < chipBounds.minY - EPS ||
        anchorPoint.y > chipBounds.maxY + EPS
      )
    })
  }

  private getBoundsStatus(candidateBoundsCheck: {
    bounds: Bounds
    labelIndex: number
    label: NetLabelPlacement
    ignoreChipCollisions?: boolean
  }): CandidateStatus {
    const { bounds, labelIndex, label, ignoreChipCollisions } =
      candidateBoundsCheck

    if (!ignoreChipCollisions) {
      if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
        return "chip-collision"
      }
      if (this.sharesChipBoundary(bounds)) {
        return "chip-collision"
      }
    }
    if (rectIntersectsAnyTextBox(bounds, this.inputProblem)) {
      return "text-collision"
    }
    if (traceCrossesBoundsInterior(bounds, this.traceMap)) {
      return "trace-collision"
    }
    if (this.isTraceTooCloseToLabel(bounds, label)) {
      return "trace-clearance-violation"
    }
    if (this.intersectsAnyOtherNetLabel(bounds, labelIndex)) {
      return "netlabel-collision"
    }
    return "valid"
  }

  private isTraceTooCloseToLabel(bounds: Bounds, label: NetLabelPlacement) {
    if (!this.shouldCheckTraceClearanceForLabel(label)) return false

    const clearanceBounds = this.getLabelTraceClearanceBounds(bounds)
    for (const trace of Object.values(this.traceMap)) {
      if (trace.globalConnNetId === label.globalConnNetId) continue
      if (tracePathIntersectsBounds(trace.tracePath, clearanceBounds)) {
        return true
      }
    }

    return false
  }

  private getLabelTraceClearanceBounds(bounds: Bounds): Bounds {
    return {
      minX: bounds.minX - LABEL_TRACE_CLEARANCE,
      minY: bounds.minY - LABEL_TRACE_CLEARANCE,
      maxX: bounds.maxX + LABEL_TRACE_CLEARANCE,
      maxY: bounds.maxY + LABEL_TRACE_CLEARANCE,
    }
  }

  private shouldCheckTraceClearanceForLabel(label: NetLabelPlacement) {
    if (!this.isPortOnlyLabel(label)) return false
    if (!this.hasRoutedLabelOnSameNet(label)) return false

    const orientations = this.getAvailableOrientations(label)
    return orientations.length === 1
  }

  private hasRoutedLabelOnSameNet(label: NetLabelPlacement) {
    for (const otherLabel of this.outputNetLabelPlacements) {
      if (otherLabel.globalConnNetId !== label.globalConnNetId) continue
      if (otherLabel.mspConnectionPairIds.length > 0) return true
    }

    return false
  }

  private isOutwardHorizontalFallback(label: NetLabelPlacement) {
    const chipSide = this.getChipSideForPoint(label.anchorPoint)
    return (
      (chipSide === "left" && label.orientation === "x-") ||
      (chipSide === "right" && label.orientation === "x+")
    )
  }

  private hasPortOnlyLabelOnSameNet(label: NetLabelPlacement) {
    return this.outputNetLabelPlacements.some(
      (otherLabel) =>
        otherLabel !== label &&
        otherLabel.globalConnNetId === label.globalConnNetId &&
        this.isPortOnlyLabel(otherLabel),
    )
  }

  private hasOppositeVerticalRailOnSameChipSide(
    label: NetLabelPlacement,
    orientation: "y+" | "y-",
  ) {
    const currentConnection = this.inputProblem.netConnections.find(
      (connection) => connection.netId === label.netId,
    )
    if (!currentConnection) return false

    const currentSide =
      this.getSingleChipSideForNetConnection(currentConnection)
    if (!currentSide) return false

    const oppositeOrientation = orientation === "y+" ? "y-" : "y+"
    return this.inputProblem.netConnections.some((connection) => {
      if (connection === currentConnection || connection.pinIds.length < 2) {
        return false
      }
      const availableOrientations =
        this.inputProblem.availableNetLabelOrientations[connection.netId] ?? []
      if (
        availableOrientations.length !== 1 ||
        availableOrientations[0] !== oppositeOrientation
      ) {
        return false
      }

      const connectionSide = this.getSingleChipSideForNetConnection(connection)
      return (
        connectionSide?.chipId === currentSide.chipId &&
        connectionSide.side === currentSide.side
      )
    })
  }

  private getSingleChipSideForNetConnection(
    connection: InputNetConnection,
  ): { chipId: string; side: "left" | "right" } | null {
    if (connection.pinIds.length < 2) return null

    const pins = connection.pinIds.map((pinId) => this.pinMap[pinId])
    if (pins.some((pin) => !pin)) return null
    const chipIds = new Set(pins.map((pin) => pin!.chipId))
    if (chipIds.size !== 1) return null

    const chipId = pins[0]!.chipId
    const chip = this.chipObstacleSpatialIndex.chips.find(
      (candidate) => candidate.chipId === chipId,
    )
    if (!chip) return null

    const sides = new Set(
      pins.map((pin) => {
        if (Math.abs(pin!.x - chip.bounds.minX) <= EPS) return "left"
        if (Math.abs(pin!.x - chip.bounds.maxX) <= EPS) return "right"
        return null
      }),
    )
    if (sides.size !== 1 || sides.has(null)) return null

    return {
      chipId,
      side: [...sides][0] as "left" | "right",
    }
  }

  private isPortOnlyLabel(label: NetLabelPlacement) {
    return label.mspConnectionPairIds.length === 0
  }

  private intersectsAnyOtherNetLabel(bounds: Bounds, labelIndex: number) {
    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (i === labelIndex) continue
      const label = this.outputNetLabelPlacements[i]!
      const otherBounds = getRectBounds(label.center, label.width, label.height)
      if (
        i === this.blockedStandaloneLabelIndex &&
        isYOrientation(label.orientation)
      ) {
        // Keep later labels one search step away from the blocked label.
        otherBounds.minX -= LABEL_SEARCH_STEP
        otherBounds.maxX += LABEL_SEARCH_STEP
      }
      if (rectsOverlap(bounds, otherBounds)) return true
    }
    return false
  }

  private sharesChipBoundary(bounds: Bounds) {
    for (const chip of this.chipObstacleSpatialIndex.chips) {
      const chipBounds = chip.bounds
      const adjacentToVerticalSide =
        Math.abs(bounds.minX - chipBounds.maxX) <= WICK_CLEARANCE + EPS ||
        Math.abs(bounds.maxX - chipBounds.minX) <= WICK_CLEARANCE + EPS
      const adjacentToHorizontalSide =
        Math.abs(bounds.minY - chipBounds.maxY) <= WICK_CLEARANCE + EPS ||
        Math.abs(bounds.maxY - chipBounds.minY) <= WICK_CLEARANCE + EPS

      if (
        adjacentToVerticalSide &&
        rangesOverlap(
          bounds.minY,
          bounds.maxY,
          chipBounds.minY,
          chipBounds.maxY,
        )
      ) {
        return true
      }
      if (
        adjacentToHorizontalSide &&
        rangesOverlap(
          bounds.minX,
          bounds.maxX,
          chipBounds.minX,
          chipBounds.maxX,
        )
      ) {
        return true
      }
    }

    return false
  }

  private getChipSideForPoint(point: Point) {
    const containingSide = this.getContainingChipSide(point)
    if (containingSide) return containingSide

    const side = this.getOutsideChipSide(point)
    if (side) return side

    return this.getNearestChipSide(point)
  }

  private getPerpendicularOutwardDirection(
    point: Point,
    orientation: FacingDirection,
  ) {
    const chipSide = this.getChipSideForPoint(point)
    if (isYOrientation(orientation) && chipSide === "left") {
      return { x: -1, y: 0 }
    }
    if (isYOrientation(orientation) && chipSide === "right") {
      return { x: 1, y: 0 }
    }
    if (isXOrientation(orientation) && chipSide === "bottom") {
      return { x: 0, y: -1 }
    }
    if (isXOrientation(orientation) && chipSide === "top") {
      return { x: 0, y: 1 }
    }
    return { x: 0, y: 0 }
  }

  private getContainingChipSide(point: Point) {
    let nearestSide: ChipSide | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const chip of this.chipObstacleSpatialIndex.chips) {
      const bounds = chip.bounds
      if (
        point.x < bounds.minX - EPS ||
        point.x > bounds.maxX + EPS ||
        point.y < bounds.minY - EPS ||
        point.y > bounds.maxY + EPS
      ) {
        continue
      }

      for (const [side, distance] of getSideDistances(point, bounds)) {
        if (distance < nearestDistance) {
          nearestSide = side
          nearestDistance = distance
        }
      }
    }

    return nearestSide
  }

  private getOutsideChipSide(point: Point) {
    let nearestSide: ChipSide | null = null
    let nearestDistanceSq = Number.POSITIVE_INFINITY

    for (const chip of this.chipObstacleSpatialIndex.chips) {
      const bounds = chip.bounds
      const dx =
        point.x < bounds.minX - EPS
          ? bounds.minX - point.x
          : point.x > bounds.maxX + EPS
            ? point.x - bounds.maxX
            : 0
      const dy =
        point.y < bounds.minY - EPS
          ? bounds.minY - point.y
          : point.y > bounds.maxY + EPS
            ? point.y - bounds.maxY
            : 0

      if (dx === 0 && dy === 0) continue

      const distanceSq = dx ** 2 + dy ** 2
      if (distanceSq >= nearestDistanceSq) continue

      nearestDistanceSq = distanceSq
      if (dx > 0) {
        nearestSide = point.x < bounds.minX ? "left" : "right"
      } else {
        nearestSide = point.y < bounds.minY ? "bottom" : "top"
      }
    }

    return nearestSide
  }

  private getNearestChipSide(point: Point) {
    let nearestSide: ChipSide | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const chip of this.chipObstacleSpatialIndex.chips) {
      for (const [side, distance] of getSideDistances(point, chip.bounds)) {
        if (distance < nearestDistance) {
          nearestSide = side
          nearestDistance = distance
        }
      }
    }

    return nearestSide
  }

  override visualize(): GraphicsObject {
    return visualizeAvailableNetOrientationSolver({
      inputProblem: this.inputProblem,
      traces: this.traces,
      outputNetLabelPlacements: this.outputNetLabelPlacements,
      currentLabel: this.currentLabel,
      currentCandidateResults: this.currentCandidateResults,
      solved: this.solved,
    })
  }
}
