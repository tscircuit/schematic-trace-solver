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
import { rectIntersectsAnyTextBox } from "lib/utils/textBoxBounds"

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

    return indices.sort(
      (a, b) =>
        this.getAvailableOrientationPriority(
          this.outputNetLabelPlacements[b]!,
        ) -
        this.getAvailableOrientationPriority(this.outputNetLabelPlacements[a]!),
    )
  }

  private getAvailableOrientationPriority(label: NetLabelPlacement) {
    return this.getAvailableOrientations(label).some(isYOrientation) ? 1 : 0
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
    const orientations = this.getPreferredOrientations(
      label,
      this.getAvailableOrientations(label),
    )
    const candidateResults: EvaluatedCandidate[] = []

    for (const orientation of orientations) {
      candidateResults.push(
        this.evaluateCandidate(
          this.createCandidate(
            label,
            this.getSearchStartAnchor(label, orientation),
            orientation,
          ),
          label,
          labelIndex,
          "rotate",
        ),
      )
    }

    for (const orientation of orientations) {
      candidateResults.push(
        ...this.getShiftedCandidateResults(label, orientation, labelIndex),
      )
    }

    for (const orientation of orientations) {
      candidateResults.push(
        ...this.getLateralShiftedCandidateResults(
          label,
          orientation,
          labelIndex,
        ),
      )
    }

    this.currentCandidateResults = candidateResults
    const selectedCandidate = this.selectBestCandidate(
      label,
      orientations,
      candidateResults,
    )
    if (selectedCandidate) selectedCandidate.selected = true

    return selectedCandidate
  }

  private selectBestCandidate(
    label: NetLabelPlacement,
    orientations: FacingDirection[],
    candidateResults: EvaluatedCandidate[],
  ) {
    return candidateResults
      .filter((candidate) => candidate.status === "valid")
      .sort((a, b) => {
        const scoreDelta =
          this.getCandidateScore(label, orientations, a) -
          this.getCandidateScore(label, orientations, b)
        if (Math.abs(scoreDelta) > EPS) return scoreDelta

        const phaseDelta =
          this.getPhasePenalty(a.phase) - this.getPhasePenalty(b.phase)
        if (phaseDelta !== 0) return phaseDelta

        const orientationDelta =
          orientations.indexOf(a.orientation) -
          orientations.indexOf(b.orientation)
        if (orientationDelta !== 0) return orientationDelta

        return (
          a.anchorPoint.x - b.anchorPoint.x || a.anchorPoint.y - b.anchorPoint.y
        )
      })[0]
  }

  private getCandidateScore(
    label: NetLabelPlacement,
    orientations: FacingDirection[],
    candidate: EvaluatedCandidate,
  ) {
    const anchorMovement =
      Math.abs(candidate.anchorPoint.x - label.anchorPoint.x) +
      Math.abs(candidate.anchorPoint.y - label.anchorPoint.y)
    const connectorLength = this.getPathLength(
      this.getCandidateConnectorTrace(label, candidate),
    )
    const orientationPenalty =
      orientations.indexOf(candidate.orientation) * 0.05
    const outwardDirection = this.getChipOutwardDirection(label.anchorPoint)
    const outwardBonus = outwardDirection
      ? this.getDirectionDot(dir(candidate.orientation), outwardDirection) * 0.2
      : 0

    return (
      anchorMovement +
      connectorLength * 0.1 +
      this.getPhasePenalty(candidate.phase) +
      orientationPenalty -
      outwardBonus
    )
  }

  private getPhasePenalty(phase: CandidatePhase) {
    switch (phase) {
      case "rotate":
        return 0
      case "shift":
        return 0.1
      case "lateral-shift":
        return 0.2
    }
  }

  private getPathLength(path: Point[]) {
    let length = 0
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i]!
      const end = path[i + 1]!
      length += Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
    }
    return length
  }

  private getAvailableOrientations(label: NetLabelPlacement) {
    const effectiveNetId = label.netId ?? label.globalConnNetId
    return this.inputProblem.availableNetLabelOrientations[effectiveNetId] ?? []
  }

  private getPreferredOrientations(
    label: NetLabelPlacement,
    orientations: FacingDirection[],
  ) {
    const chipOutwardDirection = this.getChipOutwardDirection(label.anchorPoint)
    if (!chipOutwardDirection) return orientations

    return orientations
      .map((orientation, index) => ({
        orientation,
        index,
        score: this.getDirectionDot(dir(orientation), chipOutwardDirection),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ orientation }) => orientation)
  }

  private getShiftedCandidateResults(
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
    const results: EvaluatedCandidate[] = []

    for (
      let outwardDistance = 0;
      outwardDistance <= maxOutwardDistance + EPS;
      outwardDistance += LABEL_SEARCH_STEP
    ) {
      const baseAnchor = {
        x: initialBaseAnchor.x + outwardDirection.x * outwardDistance,
        y: initialBaseAnchor.y + outwardDirection.y * outwardDistance,
      }
      results.push(
        ...this.getCandidateResultsInShiftColumn({
          label,
          labelIndex,
          orientation,
          direction,
          baseAnchor,
          maxSearchDistance,
          outwardDistance,
        }),
      )
    }

    return results
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
  private getLateralShiftedCandidateResults(
    label: NetLabelPlacement,
    orientation: FacingDirection,
    labelIndex: number,
  ) {
    const direction = dir(orientation)
    const initialBaseAnchor = this.getSearchStartAnchor(label, orientation)

    // Lateral axis: perpendicular to the orientation direction
    const lateralDir: Point = {
      x: isYOrientation(orientation) ? 1 : 0,
      y: isXOrientation(orientation) ? 1 : 0,
    }

    const maxSteps = Math.ceil(this.maxSearchDistance / LABEL_SEARCH_STEP)
    const results: EvaluatedCandidate[] = []

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

        results.push(
          ...this.getCandidateResultsInShiftColumn({
            label,
            labelIndex,
            orientation,
            direction,
            baseAnchor,
            maxSearchDistance,
            outwardDistance: lateralOffset,
            phase: "lateral-shift",
          }),
        )
      }
    }

    return results
  }

  private getCandidateResultsInShiftColumn(params: {
    label: NetLabelPlacement
    labelIndex: number
    orientation: FacingDirection
    direction: Point
    baseAnchor: Point
    maxSearchDistance: number
    outwardDistance: number
    phase?: CandidatePhase
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
    } = params
    const results: EvaluatedCandidate[] = []

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
      results.push(result)

      if (result.status === "trace-collision") break
    }

    return results
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
    const chipOutwardDirection = this.getChipOutwardDirection(label.anchorPoint)
    if (
      chipOutwardDirection &&
      this.getDirectionDot(dir(orientation), chipOutwardDirection) > 0
    ) {
      return this.getSearchDistanceLimit(label, orientation)
    }

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

  private getChipOutwardDirection(point: Point): Point | null {
    const chipSide = this.getChipSideForPoint(point)
    if (chipSide === "left") return { x: -1, y: 0 }
    if (chipSide === "right") return { x: 1, y: 0 }
    if (chipSide === "bottom") return { x: 0, y: -1 }
    if (chipSide === "top") return { x: 0, y: 1 }
    return null
  }

  private getDirectionDot(a: Point, b: Point) {
    return a.x * b.x + a.y * b.y
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
    const boundsStatus = this.getBoundsStatus(
      getRectBounds(candidate.center, candidate.width, candidate.height),
      labelIndex,
    )
    if (boundsStatus !== "valid") return boundsStatus

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

  private getBoundsStatus(bounds: Bounds, labelIndex: number): CandidateStatus {
    if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
      return "chip-collision"
    }
    if (rectIntersectsAnyTextBox(bounds, this.inputProblem)) {
      return "text-collision"
    }
    if (this.sharesChipBoundary(bounds)) {
      return "chip-collision"
    }
    if (traceCrossesBoundsInterior(bounds, this.traceMap)) {
      return "trace-collision"
    }
    if (this.intersectsAnyOtherNetLabel(bounds, labelIndex)) {
      return "netlabel-collision"
    }
    return "valid"
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
