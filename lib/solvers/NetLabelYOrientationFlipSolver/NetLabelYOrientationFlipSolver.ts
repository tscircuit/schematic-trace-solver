import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { getColorFromString } from "lib/utils/getColorFromString"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

interface NetLabelYOrientationFlipSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

type PinWithChipId = InputPin & { chipId: string }
type FallbackAnchorCandidate = {
  traceAnchor: Point
  connectorVia?: Point
}
type CandidateStatus = "accepted" | "rejected"
type CandidateRejectReason =
  | "chip-collision"
  | "label-collision"
  | "trace-collision"
type FlipCandidate = {
  label: NetLabelPlacement
  connectorPath: Point[] | null
  source: "host-trace" | "fallback"
}
type FlipCandidateAttempt = FlipCandidate & {
  labelIndex: number
  originalLabel: NetLabelPlacement
  status: CandidateStatus
  rejectReason?: CandidateRejectReason
}
type FlipSearchState = {
  labelIndex: number
  originalLabel: NetLabelPlacement
  candidates: FlipCandidate[]
  candidateIndex: number
}
const NET_LABEL_WICK_LENGTH = 0.05
const CHIP_EDGE_ESCAPE_LENGTH = 0.1

function rectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
  EPS = 1e-9,
) {
  const xOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const yOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return xOverlap > EPS && yOverlap > EPS
}

function pointOnSegment(point: Point, a: Point, b: Point, EPS = 1e-6) {
  const isVertical = Math.abs(a.x - b.x) < EPS
  const isHorizontal = Math.abs(a.y - b.y) < EPS

  if (isVertical) {
    return (
      Math.abs(point.x - a.x) < EPS &&
      point.y >= Math.min(a.y, b.y) - EPS &&
      point.y <= Math.max(a.y, b.y) + EPS
    )
  }

  if (isHorizontal) {
    return (
      Math.abs(point.y - a.y) < EPS &&
      point.x >= Math.min(a.x, b.x) - EPS &&
      point.x <= Math.max(a.x, b.x) + EPS
    )
  }

  return false
}

export class NetLabelYOrientationFlipSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  flippedNetLabelIds = new Set<string>()
  candidateAttempts: FlipCandidateAttempt[] = []
  currentLabelIndex = 0

  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private pinMap = new Map<string, PinWithChipId>()
  private chipMap = new Map<string, InputChip>()
  private eligibleLabelQueue: number[] | null = null
  private eligibleLabelCount = 0
  private flipSearchState: FlipSearchState | null = null

  constructor(params: NetLabelYOrientationFlipSolverInput) {
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
    typeof NetLabelYOrientationFlipSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      netLabelPlacements: this.inputNetLabelPlacements,
    }
  }

  override _step() {
    if (!this.eligibleLabelQueue) {
      this.eligibleLabelQueue = this.getEligibleLabelIndexes()
      this.eligibleLabelCount = this.eligibleLabelQueue.length
    }

    if (!this.flipSearchState) {
      const labelIndex = this.eligibleLabelQueue.shift()
      if (labelIndex === undefined) {
        this.solved = true
        return
      }

      const label = this.outputNetLabelPlacements[labelIndex]!
      this.currentLabelIndex = labelIndex
      this.flipSearchState = {
        labelIndex,
        originalLabel: label,
        candidates: this.getFlippedPlacementCandidates(label),
        candidateIndex: 0,
      }
    }

    const searchState = this.flipSearchState
    const candidate = searchState.candidates[searchState.candidateIndex++]
    if (!candidate) {
      this.flipSearchState = null
      return
    }

    const rejectReason = this.getInvalidCandidateReason(
      candidate.label,
      searchState.labelIndex,
    )
    const attempt: FlipCandidateAttempt = {
      ...candidate,
      labelIndex: searchState.labelIndex,
      originalLabel: searchState.originalLabel,
      status: rejectReason ? "rejected" : "accepted",
      rejectReason: rejectReason ?? undefined,
    }
    this.candidateAttempts.push(attempt)

    if (!rejectReason) {
      let nextLabel = candidate.label
      if (candidate.connectorPath) {
        const connectorTrace = this.createConnectorTrace({
          label: searchState.originalLabel,
          tracePath: candidate.connectorPath,
          index: this.outputTraces.length,
        })
        nextLabel = this.addTraceIdToLabel(nextLabel, connectorTrace.mspPairId)
        this.outputTraces.push(connectorTrace)
      }
      this.outputNetLabelPlacements[searchState.labelIndex] = nextLabel
      this.flippedNetLabelIds.add(searchState.originalLabel.globalConnNetId)
      this.flipSearchState = null
    }
  }

  computeProgress() {
    if (!this.eligibleLabelQueue) return 0
    if (this.eligibleLabelCount === 0) return 1

    const remaining =
      this.eligibleLabelQueue.length + (this.flipSearchState ? 1 : 0)
    return Math.min(1, Math.max(0, 1 - remaining / this.eligibleLabelCount))
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private shouldFlipLabel(label: NetLabelPlacement) {
    if (label.orientation !== "y+" && label.orientation !== "y-") {
      return false
    }

    const netId = label.netId ?? label.globalConnNetId
    const availableOrientations =
      this.inputProblem.availableNetLabelOrientations[netId]

    return !availableOrientations?.some(
      (orientation) => orientation === "y+" || orientation === "y-",
    )
  }

  private getEligibleLabelIndexes() {
    const indexes: number[] = []

    this.outputNetLabelPlacements.forEach((label, index) => {
      if (this.shouldFlipLabel(label)) indexes.push(index)
    })

    return indexes
  }

  private getFlippedPlacementCandidates(label: NetLabelPlacement) {
    const hostTrace = this.findHostTrace(label)
    const orientations = this.getCandidateOrientations(label)
    const dimensions = this.getHorizontalDimensions(label)
    const candidates: FlipCandidate[] = []

    if (hostTrace) {
      const anchors = this.getVerticalSegmentAnchors(
        hostTrace,
        label.anchorPoint,
      )

      for (const anchor of anchors) {
        for (const orientation of orientations) {
          const candidate = this.createCandidate({
            label,
            traceAnchor: anchor,
            orientation,
            width: dimensions.width,
            height: dimensions.height,
            includeOriginalAnchor: false,
          })
          candidates.push({ ...candidate, source: "host-trace" })
        }
      }
    }

    for (const anchor of this.getFallbackAnchors(label)) {
      for (const orientation of orientations) {
        const candidate = this.createCandidate({
          label,
          traceAnchor: anchor.traceAnchor,
          connectorVia: anchor.connectorVia,
          orientation,
          width: dimensions.width,
          height: dimensions.height,
          includeOriginalAnchor: true,
        })
        candidates.push({ ...candidate, source: "fallback" })
      }
    }

    return candidates
  }

  private findHostTrace(label: NetLabelPlacement) {
    if (label.mspConnectionPairIds.length === 0) return null

    const ids = new Set(label.mspConnectionPairIds)
    const tracesById = this.outputTraces.filter((trace) =>
      ids.has(trace.mspPairId),
    )
    const tracesToSearch =
      tracesById.length > 0
        ? tracesById
        : this.outputTraces.filter(
            (trace) => trace.globalConnNetId === label.globalConnNetId,
          )

    return (
      tracesToSearch.find((trace) =>
        trace.tracePath
          .slice(0, -1)
          .some((point, index) =>
            pointOnSegment(
              label.anchorPoint,
              point,
              trace.tracePath[index + 1]!,
            ),
          ),
      ) ?? tracesToSearch[0]
    )
  }

  private getVerticalSegmentAnchors(trace: SolvedTracePath, original: Point) {
    const anchors: Point[] = []

    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const a = trace.tracePath[i]!
      const b = trace.tracePath[i + 1]!
      if (Math.abs(a.x - b.x) > 1e-6) continue

      anchors.push(a, { x: a.x, y: (a.y + b.y) / 2 }, b)
    }

    return anchors
      .filter(
        (anchor, index, all) =>
          all.findIndex(
            (other) =>
              Math.abs(other.x - anchor.x) < 1e-9 &&
              Math.abs(other.y - anchor.y) < 1e-9,
          ) === index,
      )
      .sort(
        (a, b) =>
          Math.abs(a.x - original.x) +
          Math.abs(a.y - original.y) -
          (Math.abs(b.x - original.x) + Math.abs(b.y - original.y)),
      )
  }

  private getFallbackAnchors(label: NetLabelPlacement) {
    const step = 0.1
    const edgeEscapeAnchor = this.getChipEdgeEscapeAnchor(label)
    const anchor = edgeEscapeAnchor ?? label.anchorPoint
    const connectorVia = edgeEscapeAnchor ? anchor : undefined
    const xDirection = this.getOutwardXDirection(label)
    const traceAnchors = xDirection
      ? [
          anchor,
          { x: anchor.x + xDirection * step, y: anchor.y },
          { x: anchor.x + xDirection * 2 * step, y: anchor.y },
        ]
      : [
          anchor,
          { x: anchor.x + step, y: anchor.y },
          { x: anchor.x - step, y: anchor.y },
          { x: anchor.x + 2 * step, y: anchor.y },
          { x: anchor.x - 2 * step, y: anchor.y },
        ]

    return traceAnchors.map(
      (traceAnchor): FallbackAnchorCandidate => ({
        traceAnchor,
        connectorVia,
      }),
    )
  }

  private getChipEdgeEscapeAnchor(label: NetLabelPlacement): Point | null {
    const chip = this.getAssociatedChip(label)
    if (!chip) return null

    const left = chip.center.x - chip.width / 2
    const right = chip.center.x + chip.width / 2
    const bottom = chip.center.y - chip.height / 2
    const top = chip.center.y + chip.height / 2
    const anchor = label.anchorPoint
    const EPS = 1e-6

    if (anchor.x >= left - EPS && anchor.x <= right + EPS) {
      if (Math.abs(anchor.y - bottom) < EPS) {
        return { x: anchor.x, y: anchor.y - CHIP_EDGE_ESCAPE_LENGTH }
      }
      if (Math.abs(anchor.y - top) < EPS) {
        return { x: anchor.x, y: anchor.y + CHIP_EDGE_ESCAPE_LENGTH }
      }
    }

    if (anchor.y >= bottom - EPS && anchor.y <= top + EPS) {
      if (Math.abs(anchor.x - left) < EPS) {
        return { x: anchor.x - CHIP_EDGE_ESCAPE_LENGTH, y: anchor.y }
      }
      if (Math.abs(anchor.x - right) < EPS) {
        return { x: anchor.x + CHIP_EDGE_ESCAPE_LENGTH, y: anchor.y }
      }
    }

    return null
  }

  private getCandidateOrientations(label: NetLabelPlacement) {
    const xDirection = this.getOutwardXDirection(label)
    if (!xDirection) return ["x+", "x-"] as FacingDirection[]

    return [xDirection > 0 ? "x+" : "x-"] as FacingDirection[]
  }

  private getOutwardXDirection(label: NetLabelPlacement) {
    const chip = this.getAssociatedChip(label)
    if (!chip) return null

    return label.anchorPoint.x >= chip.center.x ? 1 : -1
  }

  private getHorizontalDimensions(label: NetLabelPlacement) {
    return {
      width: label.height,
      height: label.width,
    }
  }

  private createCandidate({
    label,
    traceAnchor,
    connectorVia,
    orientation,
    width,
    height,
    includeOriginalAnchor,
  }: {
    label: NetLabelPlacement
    traceAnchor: Point
    connectorVia?: Point
    orientation: FacingDirection
    width: number
    height: number
    includeOriginalAnchor: boolean
  }): { label: NetLabelPlacement; connectorPath: Point[] | null } {
    const labelAnchor = this.addWickOffset(traceAnchor, orientation)
    const connectorPath = this.dedupeConsecutivePoints(
      includeOriginalAnchor
        ? [
            label.anchorPoint,
            ...(connectorVia ? [connectorVia] : []),
            traceAnchor,
            labelAnchor,
          ]
        : [traceAnchor, labelAnchor],
    )

    return {
      label: {
        ...label,
        orientation,
        anchorPoint: labelAnchor,
        width,
        height,
        center: getCenterFromAnchor(labelAnchor, orientation, width, height),
      },
      connectorPath: connectorPath.length > 1 ? connectorPath : null,
    }
  }

  private addWickOffset(anchor: Point, orientation: FacingDirection): Point {
    switch (orientation) {
      case "x+":
        return { x: anchor.x + NET_LABEL_WICK_LENGTH, y: anchor.y }
      case "x-":
        return { x: anchor.x - NET_LABEL_WICK_LENGTH, y: anchor.y }
      case "y+":
        return { x: anchor.x, y: anchor.y + NET_LABEL_WICK_LENGTH }
      case "y-":
        return { x: anchor.x, y: anchor.y - NET_LABEL_WICK_LENGTH }
    }
  }

  private areSamePoint(a: Point, b: Point) {
    return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
  }

  private dedupeConsecutivePoints(points: Point[]) {
    return points.filter((point, index) => {
      if (index === 0) return true
      return !this.areSamePoint(point, points[index - 1]!)
    })
  }

  private getInvalidCandidateReason(
    label: NetLabelPlacement,
    labelIndex: number,
  ): CandidateRejectReason | null {
    const bounds = getRectBounds(label.center, label.width, label.height)

    if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
      return "chip-collision"
    }

    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (i === labelIndex) continue
      const other = this.outputNetLabelPlacements[i]!
      const otherBounds = getRectBounds(other.center, other.width, other.height)
      if (rectsOverlap(bounds, otherBounds)) return "label-collision"
    }

    if (this.hasTraceCollision(label, bounds)) {
      return "trace-collision"
    }

    return null
  }

  private hasTraceCollision(
    label: NetLabelPlacement,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ) {
    for (const trace of this.outputTraces) {
      if (trace.globalConnNetId === label.globalConnNetId) continue

      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        if (
          segmentIntersectsRect(
            trace.tracePath[i]!,
            trace.tracePath[i + 1]!,
            bounds,
          )
        ) {
          return true
        }
      }
    }

    return false
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
    const mspPairId = `netlabel-wick-${label.globalConnNetId}-${index}`

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
          `source: ${attempt.source}`,
          `orientation: ${label.orientation}`,
          attempt.rejectReason ? `reason: ${attempt.rejectReason}` : null,
          `netId: ${label.netId}`,
        ]
          .filter(Boolean)
          .join("\n"),
      } as any)

      if (attempt.connectorPath) {
        graphics.lines!.push({
          points: attempt.connectorPath,
          strokeColor: style.stroke,
          strokeDash: attempt.status === "rejected" ? "4 2" : undefined,
          strokeWidth: isLatest ? 0.04 : 0.025,
        } as any)
      }

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
    attempt: FlipCandidateAttempt,
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
        return {
          fill: isLatest ? "rgba(220, 0, 0, 0.32)" : "rgba(220, 0, 0, 0.18)",
          stroke: "red",
        }
      case "trace-collision":
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
