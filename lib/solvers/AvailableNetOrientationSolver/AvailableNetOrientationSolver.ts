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
import type { InputPin, InputProblem } from "lib/types/InputProblem"
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

  private traceMap: Record<string, SolvedTracePath>
  private allowConnectorTraceCrossings = false
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

    // Prefer candidates whose connector trace doesn't cross other nets'
    // traces; if none exist, retry allowing crossings so the orientation
    // constraint is still satisfied.
    this.allowConnectorTraceCrossings = false
    let candidate = this.findCorrectedCandidate(label, labelIndex)
    if (!candidate) {
      this.allowConnectorTraceCrossings = true
      this.currentCandidateResults = []
      candidate = this.findCorrectedCandidate(label, labelIndex)
      this.allowConnectorTraceCrossings = false
    }
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
    const isTwoPinNet = this.inputProblem.netConnections.some(
      (connection) =>
        connection.netId === label.netId && connection.pinIds.length === 2,
    )
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
      "anchorPoint" | "orientation" | "phase"
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
      label.anchorPoint,
      candidate.anchorPoint,
      candidate.orientation,
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

    return this.getSideOffsetAnchor({
      anchorPoint,
      labelAnchorPoint: label.anchorPoint,
      orientation,
      width,
      height,
    })
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
    const chipId = label.pinIds
      .map((pid) => this.pinMap[pid]?.chipId)
      .find(Boolean)
    const chip = chipId
      ? this.chipObstacleSpatialIndex.chips.find((c) => c.chipId === chipId)
      : null

    if (chip) {
      if (orientation === "y-")
        return Math.max(0, baseAnchor.y - chip.bounds.minY)
      if (orientation === "y+")
        return Math.max(0, chip.bounds.maxY - baseAnchor.y)
      if (orientation === "x-")
        return Math.max(0, baseAnchor.x - chip.bounds.minX)
      if (orientation === "x+")
        return Math.max(0, chip.bounds.maxX - baseAnchor.x)
    }

    return this.getSearchDistanceLimit(label, orientation)
  }

  private createCandidate(
    label: NetLabelPlacement,
    anchorPoint: Point,
    orientation: FacingDirection,
  ): CandidateLabel {
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth: this.getNetLabelWidth(label),
      netLabelHeight: this.getNetLabelHeight(label),
    })
    return {
      orientation,
      anchorPoint,
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

    if (
      !this.allowConnectorTraceCrossings &&
      this.connectorTraceCrossesOtherNetTrace(connectorTrace, label)
    ) {
      return "trace-collision"
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

  /**
   * A generated connector trace must not cross an existing trace from a
   * different net — a perpendicular crossing reads as a false junction
   * on the schematic.
   */
  private connectorTraceCrossesOtherNetTrace(
    connectorTrace: Array<{ x: number; y: number }>,
    label: NetLabelPlacement,
  ): boolean {
    for (const trace of Object.values(this.traceMap)) {
      if (trace.globalConnNetId === label.globalConnNetId) continue
      for (let i = 0; i < connectorTrace.length - 1; i++) {
        const a1 = connectorTrace[i]!
        const a2 = connectorTrace[i + 1]!
        const aIsHorizontal = Math.abs(a1.y - a2.y) < EPS
        for (let j = 0; j < trace.tracePath.length - 1; j++) {
          const b1 = trace.tracePath[j]!
          const b2 = trace.tracePath[j + 1]!
          const bIsHorizontal = Math.abs(b1.y - b2.y) < EPS
          if (aIsHorizontal === bIsHorizontal) continue
          const [h1, h2, v1, v2] = aIsHorizontal
            ? [a1, a2, b1, b2]
            : [b1, b2, a1, a2]
          const horizontalY = h1.y
          const verticalX = v1.x
          if (
            verticalX > Math.min(h1.x, h2.x) + EPS &&
            verticalX < Math.max(h1.x, h2.x) - EPS &&
            horizontalY > Math.min(v1.y, v2.y) + EPS &&
            horizontalY < Math.max(v1.y, v2.y) - EPS
          ) {
            return true
          }
        }
      }
    }
    return false
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

  private isPortOnlyLabel(label: NetLabelPlacement) {
    return label.mspConnectionPairIds.length === 0
  }

  private intersectsAnyOtherNetLabel(bounds: Bounds, labelIndex: number) {
    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (i === labelIndex) continue
      const label = this.outputNetLabelPlacements[i]!
      const otherBounds = getRectBounds(label.center, label.width, label.height)
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
