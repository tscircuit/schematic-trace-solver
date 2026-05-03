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
  traceCrossesBoundsInterior,
  tracePathCrossesAnyTrace,
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
    candidate: CandidateLabel,
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
    candidate: CandidateLabel,
    labelIndex: number,
  ) {
    const tracePath = getConnectorTracePath(
      label.anchorPoint,
      candidate.anchorPoint,
      candidate.orientation,
    )
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
    const rotatedCandidate = this.findValidRotatedCandidate(
      label,
      labelIndex,
      orientations,
    )

    return (
      rotatedCandidate ??
      this.findValidShiftedCandidate(label, orientations[0]!, labelIndex)
    )
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

  private findValidCandidateInShiftColumn(params: {
    label: NetLabelPlacement
    labelIndex: number
    orientation: FacingDirection
    direction: Point
    baseAnchor: Point
    maxSearchDistance: number
    outwardDistance: number
  }) {
    const {
      label,
      labelIndex,
      orientation,
      direction,
      baseAnchor,
      maxSearchDistance,
      outwardDistance,
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
        "shift",
        distance,
        outwardDistance,
      )
      this.currentCandidateResults.push(result)

      if (result.status === "valid") {
        result.selected = true
        return result
      }
      if (result.status === "trace-collision") break
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
      status: this.getCandidateStatus(candidate, label, labelIndex),
    }
  }

  private getSearchStartAnchor(
    label: NetLabelPlacement,
    orientation: FacingDirection,
  ) {
    const anchorPoint = this.getWickOffsetAnchor(label.anchorPoint, orientation)
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth: this.getNetLabelWidth(label),
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
    if (isYOrientation(orientation) && chipSide === "left") {
      return {
        x: anchorPoint.x - width / 2 - WICK_CLEARANCE,
        y: anchorPoint.y,
      }
    }
    if (isYOrientation(orientation) && chipSide === "right") {
      return {
        x: anchorPoint.x + width / 2 + WICK_CLEARANCE,
        y: anchorPoint.y,
      }
    }
    if (isXOrientation(orientation) && chipSide === "bottom") {
      return {
        x: anchorPoint.x,
        y: anchorPoint.y - height / 2 - WICK_CLEARANCE,
      }
    }
    if (isXOrientation(orientation) && chipSide === "top") {
      return {
        x: anchorPoint.x,
        y: anchorPoint.y + height / 2 + WICK_CLEARANCE,
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
    })
    const labelLength =
      orientation === "y+" || orientation === "y-" ? height : width
    return Math.min(this.maxSearchDistance, labelLength * 2)
  }

  private createCandidate(
    label: NetLabelPlacement,
    anchorPoint: Point,
    orientation: FacingDirection,
  ): CandidateLabel {
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth: this.getNetLabelWidth(label),
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
    if (!label.netId) return undefined
    return this.inputProblem.netConnections.find(
      (connection) => connection.netId === label.netId,
    )?.netLabelWidth
  }

  private getCandidateStatus(
    candidate: CandidateLabel,
    label: NetLabelPlacement,
    labelIndex: number,
  ) {
    const boundsStatus = this.getBoundsStatus(
      getRectBounds(candidate.center, candidate.width, candidate.height),
      labelIndex,
    )
    if (boundsStatus !== "valid") return boundsStatus

    if (
      tracePathCrossesAnyTrace(
        getConnectorTracePath(
          label.anchorPoint,
          candidate.anchorPoint,
          candidate.orientation,
        ),
        this.traceMap,
      )
    ) {
      return "trace-collision"
    }

    return "valid"
  }

  private getBoundsStatus(bounds: Bounds, labelIndex: number): CandidateStatus {
    if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
      return "chip-collision"
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
