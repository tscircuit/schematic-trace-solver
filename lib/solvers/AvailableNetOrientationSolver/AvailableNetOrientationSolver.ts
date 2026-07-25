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
import {
  CONNECTOR_DETOUR_OFFSETS,
  EPS,
  LABEL_SEARCH_STEP,
  WICK_CLEARANCE,
} from "./constants"
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
  pathsStrictlyCross,
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
  /**
   * Connector traces this solver generated, keyed by mspPairId, along with
   * the label and candidate they came from. Needed by the post-pass, which
   * has to re-derive alternate routes after every connector exists.
   */
  private generatedConnectors: Record<
    string,
    {
      labelIndex: number
      candidate: Pick<
        EvaluatedCandidate,
        "anchorPoint" | "orientation" | "phase"
      >
    }
  > = {}

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

    const tracePath = this.resolveConnectorTrace(label, candidate)
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
    this.generatedConnectors[mspPairId] = {
      labelIndex,
      candidate: {
        anchorPoint: candidate.anchorPoint,
        orientation: candidate.orientation,
        phase: candidate.phase,
      },
    }
  }

  private finish() {
    this.rerouteCrossingConnectorTraces()
    this.currentLabelIndex = null
    this.currentLabel = null
    this.currentCandidateResults = []
    this.solved = true
  }

  /**
   * Labels are processed one at a time, so a connector is validated against
   * only the traces that exist when its own label is handled. On the #674
   * board that ordering hides real crossings: the `orientation-4` connector
   * is routed at index 14, but the `orientation-9` connector it collides
   * with is not created until index 17, so the earlier one never had a
   * chance to avoid it.
   *
   * Once every connector exists, re-check each one against the finished set
   * and swap in the mirrored L-route where that removes a crossing. Only
   * connectors generated by this solver are moved — pin-to-pin traces from
   * earlier solvers are left untouched.
   */
  private rerouteCrossingConnectorTraces() {
    for (const trace of this.traces) {
      const generated = this.generatedConnectors[trace.mspPairId]
      if (!generated) continue

      const { labelIndex, candidate } = generated
      const label = this.outputNetLabelPlacements[labelIndex]
      if (!label) continue

      if (!this.tracePathCrossesOtherNetTraces(trace.tracePath, trace)) continue

      // `label.anchorPoint` has already been moved to the corrected position
      // by `applyCandidate`, so re-deriving the route from it would collapse
      // to a single point. The drawn trace still carries the original
      // endpoints, so mirror those instead.
      const source = trace.tracePath[0]!
      const target = trace.tracePath[trace.tracePath.length - 1]!
      const replacement = this.getAlternateConnectorRoutes(
        source,
        target,
        candidate.orientation,
      ).find(
        (route) =>
          route.length >= 2 &&
          !this.tracePathCrossesOtherNetTraces(route, trace) &&
          !this.routeHitsChip(route) &&
          !this.routeHitsOtherLabel(route, labelIndex),
      )

      if (replacement) trace.tracePath = replacement
    }
  }

  /**
   * Alternate orthogonal routes between the same two endpoints, cheapest
   * first.
   *
   * 1. The mirrored L — turn on the other axis. Same length as the original,
   *    so it is always preferred when it clears the crossing.
   * 2. U-shaped detours — step away from the source, run across, then come
   *    back. These are needed when the blocking trace sits between the two
   *    endpoints on both axes, so no L-shape can avoid it. Offsets are tried
   *    smallest first, in both directions, so the connector deviates as
   *    little as possible.
   */
  private getAlternateConnectorRoutes(
    source: Point,
    target: Point,
    orientation: FacingDirection,
  ): Point[][] {
    const routes: Point[][] = [
      isYOrientation(orientation)
        ? [source, { x: source.x, y: target.y }, target]
        : [source, { x: target.x, y: source.y }, target],
    ]

    for (const offset of CONNECTOR_DETOUR_OFFSETS) {
      for (const sign of [1, -1]) {
        const delta = offset * sign
        routes.push([
          source,
          { x: source.x, y: source.y + delta },
          { x: target.x, y: source.y + delta },
          target,
        ])
        routes.push([
          source,
          { x: source.x + delta, y: source.y },
          { x: source.x + delta, y: target.y },
          target,
        ])
      }
    }

    return routes.map(simplifyOrthogonalPath)
  }

  private routeHitsChip(route: Point[]) {
    for (const chip of this.chipObstacleSpatialIndex.chips) {
      if (tracePathCrossesAnyBounds(route, chip.bounds)) return true
    }
    return false
  }

  private routeHitsOtherLabel(route: Point[], labelIndex: number) {
    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (i === labelIndex) continue
      const otherLabel = this.outputNetLabelPlacements[i]!
      if (
        tracePathIntersectsBounds(
          route,
          getRectBounds(otherLabel.center, otherLabel.width, otherLabel.height),
        )
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Like `connectorTraceCrossesOtherNetTrace`, but compares against every
   * finished trace rather than the partially-built `traceMap`, and skips the
   * trace being re-routed so it never counts as colliding with itself.
   */
  private tracePathCrossesOtherNetTraces(
    tracePath: Array<{ x: number; y: number }>,
    self: SolvedTracePath,
  ): boolean {
    const seen = new Set<SolvedTracePath>()
    for (const other of [...this.traces, ...Object.values(this.traceMap)]) {
      if (other === self || seen.has(other)) continue
      seen.add(other)
      if (other.globalConnNetId === self.globalConnNetId) continue
      if (pathsStrictlyCross(tracePath, other.tracePath)) return true
    }

    return false
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

  /**
   * Resolve the connector route actually used for a candidate: the default
   * L-shape, or the mirrored one when the default crosses another net's
   * trace and the mirror does not. Both `getCandidateStatus` and
   * `addConnectorTrace` go through this so the route that was validated is
   * the route that gets drawn.
   */
  private resolveConnectorTrace(
    label: NetLabelPlacement,
    candidate: Pick<
      EvaluatedCandidate,
      "anchorPoint" | "orientation" | "phase"
    >,
  ) {
    const preferred = this.getCandidateConnectorTrace(label, candidate)
    if (!this.connectorTraceCrossesOtherNetTrace(preferred, label)) {
      return preferred
    }

    const mirrored = this.getMirroredConnectorTrace(label, candidate)
    if (mirrored.length < 2) return preferred
    if (this.connectorTraceCrossesOtherNetTrace(mirrored, label)) {
      return preferred
    }

    // Only take the mirror if it is otherwise as legal as the default.
    for (const chip of this.chipObstacleSpatialIndex.chips) {
      if (tracePathCrossesAnyBounds(mirrored, chip.bounds)) return preferred
    }

    return mirrored
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

  /**
   * An orthogonal connector between two points has two L-shaped routes: turn
   * on the source axis first, or on the target axis first.
   * `getConnectorTracePath` always picks the one implied by the orientation,
   * which is the right default because it leaves the label travelling along
   * its own facing direction.
   *
   * When that default happens to cross another net's trace, the mirrored L
   * sometimes reaches the same anchor without crossing anything (#674). This
   * returns that mirrored route so callers can fall back to it before giving
   * up on the candidate entirely.
   */
  private getMirroredConnectorTrace(
    label: NetLabelPlacement,
    candidate: Pick<
      EvaluatedCandidate,
      "anchorPoint" | "orientation" | "phase"
    >,
  ) {
    const source =
      candidate.phase === "lateral-shift"
        ? (() => {
            const orientDir = dir(candidate.orientation)
            return {
              x: label.anchorPoint.x - orientDir.x * LABEL_SEARCH_STEP,
              y: label.anchorPoint.y - orientDir.y * LABEL_SEARCH_STEP,
            }
          })()
        : label.anchorPoint

    const target = candidate.anchorPoint
    const mirrored = isYOrientation(candidate.orientation)
      ? [source, { x: source.x, y: target.y }, target]
      : [source, { x: target.x, y: source.y }, target]

    return candidate.phase === "lateral-shift"
      ? simplifyOrthogonalPath([label.anchorPoint, ...mirrored])
      : simplifyOrthogonalPath(mirrored)
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

    const connectorTrace = this.resolveConnectorTrace(label, {
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
