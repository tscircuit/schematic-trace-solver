import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import {
  isXOrientation,
  segmentCrossesBoundsInterior,
  simplifyOrthogonalPath,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { getInlineTerminalBounds } from "lib/solvers/InlineNetLabelSolver/getInlineLabelObstacles"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import {
  getCenterFromAnchor,
  getDimsForOrientation,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import {
  findFirstCollision,
  segmentOverlapsRectBoundary,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"
import { doesPathOverlapTraceStrokes } from "lib/utils/doesPathCoincideWithTraces"
import { getColorFromString } from "lib/utils/getColorFromString"
import { rectIntersectsAnyTextBox } from "lib/utils/textBoxBounds"

const EPS = 1e-6
const MIN_PIN_EXIT = 0.06
const SEARCH_RADIUS = 2.6
const CHIP_CLEARANCE_PREFERRED = 0.035
const CHANNEL_OFFSET = 0.08
const MAX_CONNECTOR_BENDS = 3
const ANCHOR_NUDGE = 1e-4

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type PinContext = InputPin & {
  chipId: string
  facing: FacingDirection
  chip: InputChip
}

type ConnectorSolution = {
  anchor: Point
  orientation: FacingDirection
  center: Point
  width: number
  height: number
  path: Point[]
  crossings: number
  len: number
  score: number
}

function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

function expandBounds(b: Bounds, margin: number): Bounds {
  return {
    minX: b.minX - margin,
    minY: b.minY - margin,
    maxX: b.maxX + margin,
    maxY: b.maxY + margin,
  }
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.minX < b.maxX - EPS &&
    a.maxX > b.minX + EPS &&
    a.minY < b.maxY - EPS &&
    a.maxY > b.minY + EPS
  )
}

function getPathBounds(pts: Point[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

function getCombinedLabelBounds(label: NetLabelPlacement): Bounds {
  return unionBounds(
    getRectBounds(label.center, label.width, label.height),
    getAnchoredNetLabelRenderedBounds(label),
  )
}

function getInlineLabelTextBounds(label: InlineNetLabelPlacement): Bounds {
  const halfW = (label.axis === "x" ? label.width : label.height) / 2
  const halfH = (label.axis === "x" ? label.height : label.width) / 2
  return {
    minX: label.center.x - halfW,
    maxX: label.center.x + halfW,
    minY: label.center.y - halfH,
    maxY: label.center.y + halfH,
  }
}

function countSegmentCrossings(
  a1: Point,
  a2: Point,
  traces: Array<{ tracePath: Point[] }>,
): number {
  let crossings = 0
  const aVert = Math.abs(a1.x - a2.x) <= EPS
  for (const trace of traces) {
    for (let j = 0; j < trace.tracePath.length - 1; j++) {
      const b1 = trace.tracePath[j]!
      const b2 = trace.tracePath[j + 1]!
      const bVert = Math.abs(b1.x - b2.x) <= EPS
      if (aVert === bVert) continue
      const v1 = aVert ? a1 : b1
      const v2 = aVert ? a2 : b2
      const h1 = aVert ? b1 : a1
      const h2 = aVert ? b2 : a2
      if (
        v1.x >= Math.min(h1.x, h2.x) - EPS &&
        v1.x <= Math.max(h1.x, h2.x) + EPS &&
        h1.y >= Math.min(v1.y, v2.y) - EPS &&
        h1.y <= Math.max(v1.y, v2.y) + EPS
      ) {
        crossings++
      }
    }
  }
  return crossings
}

function buildLocalAxisCoords(
  vals: number[],
  minVal: number,
  maxVal: number,
  exactPinCoord: number,
): number[] {
  const sorted = vals
    .filter(
      (v) =>
        v >= minVal - EPS &&
        v <= maxVal + EPS &&
        Math.abs(v - exactPinCoord) > 0.02,
    )
    .sort((a, b) => a - b)
  const deduped: number[] = []
  for (const v of sorted) {
    if (deduped.length === 0 || v - deduped[deduped.length - 1]! > 0.025) {
      deduped.push(Number(v.toFixed(4)))
    }
  }
  deduped.push(exactPinCoord)
  deduped.sort((a, b) => a - b)
  return deduped
}

export interface PortOnlyNetLabelCollisionSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements?: InlineNetLabelPlacement[]
  netLabelConnectorTraceIds?: ReadonlySet<MspConnectionPairId>
}

/**
 * Resolves residual collisions on isolated port-only net labels by routing a
 * short orthogonal connector trace from the pin into nearby unobstructed space.
 */
export class PortOnlyNetLabelCollisionSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  outputNetLabelConnectorTraceIds: Set<MspConnectionPairId>

  private obstacles: ObstacleRect[]
  private chipObstacles: Array<Extract<ObstacleRect, { kind: "chip" }>>
  private chipBoundsList: Bounds[]
  private inlineObstacleBounds: Bounds[]
  private inlineStubTraces: Array<{
    globalConnNetId: string
    tracePath: Point[]
    bounds: Bounds
  }>
  private allPins: PinContext[]
  private pinMap: Map<string, PinContext>
  private attemptedSingle = new Set<number>()
  private attemptedPairs = new Set<string>()
  private didRetryPass = false
  private unresolvedEarlier = new Set<number>()
  private anyLabelMoved = false

  constructor(private params: PortOnlyNetLabelCollisionSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.inlineNetLabelPlacements = params.inlineNetLabelPlacements ?? []
    this.outputTraces = [...params.traces]
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.outputNetLabelConnectorTraceIds = new Set(
      params.netLabelConnectorTraceIds ?? [],
    )

    this.obstacles = getObstacleRects(params.inputProblem)
    this.chipObstacles = this.obstacles.filter(
      (o): o is Extract<ObstacleRect, { kind: "chip" }> => o.kind === "chip",
    )
    this.chipBoundsList = params.inputProblem.chips.map((c) =>
      getRectBounds(c.center, c.width, c.height),
    )
    this.inlineObstacleBounds = this.inlineNetLabelPlacements.flatMap((il) => {
      const tb = getInlineTerminalBounds(il)
      return tb
        ? [getInlineLabelTextBounds(il), tb]
        : [getInlineLabelTextBounds(il)]
    })
    this.inlineStubTraces = this.inlineNetLabelPlacements.flatMap((il) =>
      il.stubTracePath && il.stubTracePath.length >= 2
        ? [
            {
              globalConnNetId: il.globalConnNetId,
              tracePath: il.stubTracePath,
              bounds: getPathBounds(il.stubTracePath),
            },
          ]
        : [],
    )
    this.allPins = params.inputProblem.chips.flatMap((chip) =>
      chip.pins.map((pin) => ({
        ...pin,
        chipId: chip.chipId,
        facing: pin._facingDirection ?? getPinDirection(pin, chip),
        chip,
      })),
    )
    this.pinMap = new Map(this.allPins.map((p) => [p.pinId, p]))
  }

  getSolverName(): string {
    return "PortOnlyNetLabelCollisionSolver"
  }

  override getConstructorParams(): ConstructorParameters<
    typeof PortOnlyNetLabelCollisionSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
      netLabelConnectorTraceIds: this.params.netLabelConnectorTraceIds,
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
      netLabelConnectorTraceIds: this.outputNetLabelConnectorTraceIds,
    }
  }

  override _step() {
    for (let idx = 0; idx < this.outputNetLabelPlacements.length; idx++) {
      if (this.attemptedSingle.has(idx)) continue
      if (!this.isEligiblePortOnlyLabel(idx)) continue
      if (!this.hasFixedOrAnchoredCollision(idx)) continue

      this.attemptedSingle.add(idx)
      const sol = this.findBestConnectorSolution(idx)
      if (sol) {
        this.applyConnectorSolution(idx, sol)
        this.anyLabelMoved = true
      } else {
        this.unresolvedEarlier.add(idx)
      }
      return
    }

    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      if (!this.isEligiblePortOnlyLabel(i)) continue
      const bi = getCombinedLabelBounds(this.outputNetLabelPlacements[i]!)
      for (let j = i + 1; j < this.outputNetLabelPlacements.length; j++) {
        if (!this.isEligiblePortOnlyLabel(j)) continue
        const pairKey = `${i}:${j}`
        if (this.attemptedPairs.has(pairKey)) continue
        const bj = getCombinedLabelBounds(this.outputNetLabelPlacements[j]!)
        if (!boundsOverlap(bi, bj)) continue

        this.attemptedPairs.add(pairKey)
        const solI = this.findBestConnectorSolution(i)
        const solJ = this.findBestConnectorSolution(j)
        if (solI && (!solJ || solI.score <= solJ.score)) {
          this.applyConnectorSolution(i, solI)
          this.anyLabelMoved = true
        } else if (solJ) {
          this.applyConnectorSolution(j, solJ)
          this.anyLabelMoved = true
        }
        return
      }
    }

    if (
      !this.didRetryPass &&
      this.anyLabelMoved &&
      this.unresolvedEarlier.size > 0
    ) {
      this.didRetryPass = true
      for (const idx of this.unresolvedEarlier) {
        if (!this.isEligiblePortOnlyLabel(idx)) continue
        if (!this.isLabelObstructed(idx)) continue
        const sol = this.findBestConnectorSolution(idx)
        if (sol) {
          this.applyConnectorSolution(idx, sol)
        }
      }
      return
    }

    this.solved = true
  }

  private isEligiblePortOnlyLabel(idx: number): boolean {
    const label = this.outputNetLabelPlacements[idx]
    if (!label) return false
    if (label.mspConnectionPairIds.length > 0 || label.pinIds.length !== 1) {
      return false
    }
    const pinId = label.pinIds[0]!
    const pinInfo = this.pinMap.get(pinId)
    if (!pinInfo) return false
    if (
      Math.hypot(
        label.anchorPoint.x - pinInfo.x,
        label.anchorPoint.y - pinInfo.y,
      ) > 1e-3
    ) {
      return false
    }
    if (
      this.outputTraces.some(
        (t) =>
          t.pinIds.includes(pinId) ||
          tracePathContainsPoint(t.tracePath, label.anchorPoint),
      )
    ) {
      return false
    }
    return true
  }

  private hasFixedOrAnchoredCollision(idx: number): boolean {
    const label = this.outputNetLabelPlacements[idx]!
    const b = getCombinedLabelBounds(label)
    if (this.chipBoundsList.some((cb) => boundsOverlap(b, cb))) {
      return true
    }
    if (rectIntersectsAnyTextBox(b, this.inputProblem)) return true
    if (this.inlineObstacleBounds.some((ib) => boundsOverlap(b, ib))) {
      return true
    }
    if (
      this.inlineStubTraces.some(
        (st) =>
          st.globalConnNetId !== label.globalConnNetId &&
          boundsOverlap(b, expandBounds(st.bounds, 0.02)) &&
          st.tracePath
            .slice(1)
            .some((end, si) =>
              segmentIntersectsRect(st.tracePath[si]!, end, b),
            ),
      )
    ) {
      return true
    }
    if (
      this.outputTraces.some((trace) =>
        trace.globalConnNetId === label.globalConnNetId
          ? trace.tracePath
              .slice(1)
              .some((end, si) =>
                segmentCrossesBoundsInterior(trace.tracePath[si]!, end, b),
              )
          : trace.tracePath
              .slice(1)
              .some((end, si) =>
                segmentIntersectsRect(trace.tracePath[si]!, end, b),
              ),
      )
    ) {
      return true
    }
    for (let j = 0; j < this.outputNetLabelPlacements.length; j++) {
      if (j === idx) continue
      if (this.isEligiblePortOnlyLabel(j)) continue
      if (
        boundsOverlap(
          b,
          getCombinedLabelBounds(this.outputNetLabelPlacements[j]!),
        )
      ) {
        return true
      }
    }
    return false
  }

  private isLabelObstructed(idx: number): boolean {
    if (this.hasFixedOrAnchoredCollision(idx)) return true
    const b = getCombinedLabelBounds(this.outputNetLabelPlacements[idx]!)
    return this.outputNetLabelPlacements.some(
      (other, j) =>
        j !== idx && boundsOverlap(b, getCombinedLabelBounds(other)),
    )
  }

  private applyConnectorSolution(idx: number, sol: ConnectorSolution) {
    const label = this.outputNetLabelPlacements[idx]!
    const pinInfo = this.pinMap.get(label.pinIds[0]!)!

    if (sol.path.length >= 2) {
      const mspPairId = `port-only-label-connector-${idx}-${label.netId ?? label.globalConnNetId}`
      const connTrace: SolvedTracePath = {
        mspPairId,
        dcConnNetId: label.dcConnNetId ?? label.globalConnNetId,
        globalConnNetId: label.globalConnNetId,
        userNetId: label.netId,
        pins: [pinInfo, pinInfo],
        tracePath: sol.path,
        mspConnectionPairIds: [mspPairId],
        pinIds: [pinInfo.pinId],
      }
      this.outputTraces.push(connTrace)
      this.outputNetLabelConnectorTraceIds.add(mspPairId)
    }

    this.outputNetLabelPlacements[idx] = {
      ...label,
      orientation: sol.orientation,
      anchorPoint: sol.anchor,
      center: sol.center,
      width: sol.width,
      height: sol.height,
    }
  }

  private findBestConnectorSolution(idx: number): ConnectorSolution | null {
    const label = this.outputNetLabelPlacements[idx]!
    const pinInfo = this.pinMap.get(label.pinIds[0]!)
    if (!pinInfo) return null

    const baseWidth = isXOrientation(label.orientation)
      ? label.width
      : label.height
    const baseHeight = isXOrientation(label.orientation)
      ? label.height
      : label.width
    const configured = label.netId
      ? this.inputProblem.availableNetLabelOrientations[label.netId]
      : undefined
    const pinFacing = pinInfo.facing
    const perpOrientations: FacingDirection[] = isXOrientation(pinFacing)
      ? ["y+", "y-"]
      : ["x+", "x-"]
    const oppOrientation: FacingDirection =
      pinFacing === "x+"
        ? "x-"
        : pinFacing === "x-"
          ? "x+"
          : pinFacing === "y+"
            ? "y-"
            : "y+"
    const defaultOrder: FacingDirection[] = [
      pinFacing,
      ...perpOrientations,
      oppOrientation,
    ]
    const allowedOrientations =
      configured && configured.length > 0
        ? defaultOrder.filter((o) => configured.includes(o))
        : defaultOrder
    if (allowedOrientations.length === 0) return null

    const pin: Point = { x: pinInfo.x, y: pinInfo.y }
    const minX = pin.x - SEARCH_RADIUS
    const maxX = pin.x + SEARCH_RADIUS
    const minY = pin.y - SEARCH_RADIUS
    const maxY = pin.y + SEARCH_RADIUS
    const labelReach = Math.max(baseWidth, baseHeight, 1.0) + 0.25
    const winMinX = minX - labelReach
    const winMaxX = maxX + labelReach
    const winMinY = minY - labelReach
    const winMaxY = maxY + labelReach
    const inEvalWindow = (r: Bounds) =>
      r.maxX >= winMinX &&
      r.minX <= winMaxX &&
      r.maxY >= winMinY &&
      r.minY <= winMaxY
    const inRouteWindow = (r: Bounds) =>
      r.maxX >= minX - 0.15 &&
      r.minX <= maxX + 0.15 &&
      r.maxY >= minY - 0.15 &&
      r.minY <= maxY + 0.15

    const ownChipObstacle = this.chipObstacles.find(
      (o) => o.chipId === pinInfo.chipId,
    )
    const localChipBounds = this.chipBoundsList.filter(inEvalWindow)
    const localRouteObstacles = this.obstacles.filter(
      (o) => o === ownChipObstacle || inRouteWindow(o),
    )

    const localForeignTraces: SolvedTracePath[] = []
    const localRouteForeignTraces: SolvedTracePath[] = []
    const localSameNetTraces: SolvedTracePath[] = []
    for (const t of this.outputTraces) {
      if (t.tracePath.length < 2) continue
      const tb = getPathBounds(t.tracePath)
      if (!inEvalWindow(tb)) continue
      if (t.globalConnNetId === label.globalConnNetId) {
        localSameNetTraces.push(t)
      } else {
        localForeignTraces.push(t)
        if (inRouteWindow(tb)) localRouteForeignTraces.push(t)
      }
    }

    const localForeignStubs = this.inlineStubTraces.filter(
      (st) =>
        st.globalConnNetId !== label.globalConnNetId && inEvalWindow(st.bounds),
    )
    const localEvalForeignPaths: Array<{ tracePath: Point[] }> = [
      ...localForeignTraces,
      ...localForeignStubs,
    ]
    const localRouteForeignPaths: Array<{ tracePath: Point[] }> = [
      ...localRouteForeignTraces,
      ...localForeignStubs.filter((st) => inRouteWindow(st.bounds)),
    ]

    const localOtherLabelBounds: Bounds[] = []
    const localRouteLabelBounds: Bounds[] = []
    for (const ib of this.inlineObstacleBounds) {
      if (inEvalWindow(ib)) {
        localOtherLabelBounds.push(ib)
        if (inRouteWindow(ib)) localRouteLabelBounds.push(ib)
      }
    }
    for (let j = 0; j < this.outputNetLabelPlacements.length; j++) {
      if (j === idx) continue
      const ob = getCombinedLabelBounds(this.outputNetLabelPlacements[j]!)
      if (inEvalWindow(ob)) {
        localOtherLabelBounds.push(ob)
        if (inRouteWindow(ob)) localRouteLabelBounds.push(ob)
      }
    }

    const localForeignPinBoxes: Bounds[] = []
    for (const p of this.allPins) {
      if (p.pinId === pinInfo.pinId) continue
      if (
        p.x >= minX - 0.1 &&
        p.x <= maxX + 0.1 &&
        p.y >= minY - 0.1 &&
        p.y <= maxY + 0.1
      ) {
        localForeignPinBoxes.push({
          minX: p.x - 0.02,
          maxX: p.x + 0.02,
          minY: p.y - 0.02,
          maxY: p.y + 0.02,
        })
      }
    }

    const evaluatePlacementAtAnchor = (
      anchor: Point,
      path: Point[],
      oRank: number,
      baseCost: number,
    ) => {
      const orientation = allowedOrientations[oRank]!
      const { width, height } = getDimsForOrientation({
        orientation,
        netLabelWidth: baseWidth,
        netLabelHeight: baseHeight,
      })
      const oDir = dir(orientation)
      const baseCenter = getCenterFromAnchor(anchor, orientation, width, height)
      const center = {
        x: baseCenter.x + oDir.x * ANCHOR_NUDGE,
        y: baseCenter.y + oDir.y * ANCHOR_NUDGE,
      }
      const candLabel: NetLabelPlacement = {
        ...label,
        orientation,
        anchorPoint: anchor,
        center,
        width,
        height,
      }
      const b = getCombinedLabelBounds(candLabel)
      const bTight = expandBounds(b, 1e-3)
      if (localChipBounds.some((cb) => boundsOverlap(bTight, cb))) {
        return null
      }
      if (rectIntersectsAnyTextBox(b, this.inputProblem)) return null
      if (
        path.length > 1 &&
        path
          .slice(1)
          .some((end, si) => segmentCrossesBoundsInterior(path[si]!, end, b))
      ) {
        return null
      }
      if (
        localSameNetTraces.some((t) =>
          t.tracePath
            .slice(1)
            .some((end, si) =>
              segmentCrossesBoundsInterior(t.tracePath[si]!, end, b),
            ),
        )
      ) {
        return null
      }
      if (
        localEvalForeignPaths.some((t) =>
          t.tracePath
            .slice(1)
            .some((end, si) => segmentIntersectsRect(t.tracePath[si]!, end, b)),
        )
      ) {
        return null
      }
      if (localOtherLabelBounds.some((ob) => boundsOverlap(b, ob))) return null

      const bPref = expandBounds(b, CHIP_CLEARANCE_PREFERRED)
      const nearChip = localChipBounds.some((cb) => boundsOverlap(bPref, cb))
      const score = baseCost + oRank * 1.5 + (nearChip ? 6 : 0)
      return { anchor, orientation, center, width, height, path, score }
    }

    let chosen: ConnectorSolution | null = null
    for (let oRank = 0; oRank < allowedOrientations.length; oRank++) {
      const res = evaluatePlacementAtAnchor(pin, [pin], oRank, 0)
      if (res && (!chosen || res.score < chosen.score)) {
        chosen = { ...res, crossings: 0, len: 0 }
      }
    }
    if (chosen) return chosen

    const rawXs: number[] = []
    const rawYs: number[] = []
    for (const d of [
      0.06, 0.1, 0.15, 0.2, 0.3, 0.45, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0, 2.4,
    ]) {
      rawXs.push(pin.x - d, pin.x + d)
      rawYs.push(pin.y - d, pin.y + d)
    }
    const localRects = [
      ...localRouteObstacles,
      ...localRouteLabelBounds,
    ].filter(
      (r) =>
        r.maxX >= minX && r.minX <= maxX && r.maxY >= minY && r.minY <= maxY,
    )
    for (const r of localRects) {
      rawXs.push(r.minX - CHANNEL_OFFSET, r.maxX + CHANNEL_OFFSET)
      rawYs.push(r.minY - CHANNEL_OFFSET, r.maxY + CHANNEL_OFFSET)
    }
    const xEdges = localRects
      .flatMap((r) => [r.minX, r.maxX])
      .sort((a, b) => a - b)
    for (let i = 0; i < xEdges.length - 1; i++) {
      const gap = xEdges[i + 1]! - xEdges[i]!
      if (gap > 0.06 && gap < 0.5) {
        rawXs.push((xEdges[i]! + xEdges[i + 1]!) / 2)
      }
    }
    const yEdges = localRects
      .flatMap((r) => [r.minY, r.maxY])
      .sort((a, b) => a - b)
    for (let i = 0; i < yEdges.length - 1; i++) {
      const gap = yEdges[i + 1]! - yEdges[i]!
      if (gap > 0.06 && gap < 0.5) {
        rawYs.push((yEdges[i]! + yEdges[i + 1]!) / 2)
      }
    }

    const xs = buildLocalAxisCoords(rawXs, minX, maxX, pin.x)
    const ys = buildLocalAxisCoords(rawYs, minY, maxY, pin.y)
    const nx = xs.length
    const ny = ys.length

    const ownExcludeSet = ownChipObstacle
      ? new Set<ObstacleRect>([ownChipObstacle])
      : new Set<ObstacleRect>()
    const emptyExcludeSet = new Set<ObstacleRect>()

    const isSegmentValid = (a: Point, b: Point, isFirstFromPin: boolean) => {
      if (
        isFirstFromPin &&
        ownChipObstacle &&
        segmentOverlapsRectBoundary(a, b, ownChipObstacle)
      ) {
        return false
      }
      const col = findFirstCollision([a, b], localRouteObstacles, {
        excludeRectsForSegment: () =>
          isFirstFromPin ? ownExcludeSet : emptyExcludeSet,
      })
      if (col !== null) return false
      if (localRouteLabelBounds.some((ob) => segmentIntersectsRect(a, b, ob))) {
        return false
      }
      if (localForeignPinBoxes.some((pb) => segmentIntersectsRect(a, b, pb))) {
        return false
      }
      if (doesPathOverlapTraceStrokes([a, b], localRouteForeignTraces)) {
        return false
      }
      if (
        localForeignStubs.some((st) =>
          doesPathOverlapTraceStrokes(
            [a, b],
            [{ tracePath: st.tracePath } as SolvedTracePath],
          ),
        )
      ) {
        return false
      }
      return true
    }

    // Memoize unit grid edge validity & crossings: -1 = invalid, >= 0 = crossings + 1
    const edgeMemo = new Int16Array(nx * ny * 2)
    const getUnitEdgeCrossings = (
      ix1: number,
      iy1: number,
      ix2: number,
      iy2: number,
    ): number => {
      const isHoriz = iy1 === iy2
      const baseIx = isHoriz ? Math.min(ix1, ix2) : ix1
      const baseIy = isHoriz ? iy1 : Math.min(iy1, iy2)
      const memoIdx = (baseIx * ny + baseIy) * 2 + (isHoriz ? 0 : 1)
      const cached = edgeMemo[memoIdx]!
      if (cached !== 0) return cached === -1 ? -1 : cached - 1

      const p1 = { x: xs[ix1]!, y: ys[iy1]! }
      const p2 = { x: xs[ix2]!, y: ys[iy2]! }
      if (!isSegmentValid(p1, p2, false)) {
        edgeMemo[memoIdx] = -1
        return -1
      }
      const cr = countSegmentCrossings(p1, p2, localRouteForeignPaths)
      edgeMemo[memoIdx] = cr + 1
      return cr
    }

    type State = {
      ix: number
      iy: number
      dirIdx: number
      cost: number
      crossings: number
      bends: number
      len: number
      prev: State | null
    }
    const bestCost = new Float64Array(nx * ny * 4).fill(Infinity)
    const pq: State[] = []
    const pushState = (s: State) => {
      const key = (s.ix * ny + s.iy) * 4 + s.dirIdx
      if (s.cost >= bestCost[key]!) return
      bestCost[key] = s.cost
      let i = pq.length
      pq.push(s)
      while (i > 0) {
        const parent = (i - 1) >> 1
        if (pq[parent]!.cost <= pq[i]!.cost) break
        const tmp = pq[parent]!
        pq[parent] = pq[i]!
        pq[i] = tmp
        i = parent
      }
    }
    const popMin = (): State | undefined => {
      if (pq.length === 0) return undefined
      const top = pq[0]!
      const last = pq.pop()!
      if (pq.length > 0) {
        pq[0] = last
        let i = 0
        const n = pq.length
        while (true) {
          let smallest = i
          const l = (i << 1) + 1
          const r = l + 1
          if (l < n && pq[l]!.cost < pq[smallest]!.cost) smallest = l
          if (r < n && pq[r]!.cost < pq[smallest]!.cost) smallest = r
          if (smallest === i) break
          const tmp = pq[i]!
          pq[i] = pq[smallest]!
          pq[smallest] = tmp
          i = smallest
        }
      }
      return top
    }

    const pinIx = xs.indexOf(pin.x)
    const pinIy = ys.indexOf(pin.y)
    if (pinIx === -1 || pinIy === -1) return null

    const initDirIdx =
      pinFacing === "x+"
        ? 0
        : pinFacing === "x-"
          ? 1
          : pinFacing === "y+"
            ? 2
            : 3
    const stepD =
      initDirIdx === 0
        ? [1, 0]
        : initDirIdx === 1
          ? [-1, 0]
          : initDirIdx === 2
            ? [0, 1]
            : [0, -1]
    let cx = pinIx + stepD[0]!
    let cy = pinIy + stepD[1]!
    while (cx >= 0 && cx < nx && cy >= 0 && cy < ny) {
      const targetPt = { x: xs[cx]!, y: ys[cy]! }
      const dist = Math.abs(targetPt.x - pin.x) + Math.abs(targetPt.y - pin.y)
      if (dist >= MIN_PIN_EXIT - EPS) {
        if (!isSegmentValid(pin, targetPt, true)) break
        const cr = countSegmentCrossings(pin, targetPt, localRouteForeignPaths)
        pushState({
          ix: cx,
          iy: cy,
          dirIdx: initDirIdx,
          cost: cr * 1000 + dist * 10,
          crossings: cr,
          bends: 0,
          len: dist,
          prev: null,
        })
      }
      cx += stepD[0]!
      cy += stepD[1]!
    }

    const DIRS: Array<[number, number, number]> = [
      [1, 0, 0],
      [-1, 0, 1],
      [0, 1, 2],
      [0, -1, 3],
    ]

    while (pq.length > 0) {
      const cur = popMin()!
      const key = (cur.ix * ny + cur.iy) * 4 + cur.dirIdx
      if (cur.cost > bestCost[key]! + EPS) continue
      if (chosen && cur.cost >= chosen.score) break
      if (cur.bends > MAX_CONNECTOR_BENDS || cur.len > SEARCH_RADIUS * 1.8) {
        continue
      }

      const anchor = { x: xs[cur.ix]!, y: ys[cur.iy]! }
      const ptsRev: Point[] = []
      let walk: State | null = cur
      while (walk) {
        ptsRev.push({ x: xs[walk.ix]!, y: ys[walk.iy]! })
        walk = walk.prev
      }
      ptsRev.push(pin)
      const path = simplifyOrthogonalPath(ptsRev.reverse())

      for (let oRank = 0; oRank < allowedOrientations.length; oRank++) {
        const res = evaluatePlacementAtAnchor(anchor, path, oRank, cur.cost)
        if (res && (!chosen || res.score < chosen.score)) {
          chosen = { ...res, crossings: cur.crossings, len: cur.len }
        }
      }

      for (const [dx, dy, nextDir] of DIRS) {
        if ((cur.dirIdx ^ 1) === nextDir) continue
        const nix = cur.ix + dx
        const niy = cur.iy + dy
        if (nix < 0 || nix >= nx || niy < 0 || niy >= ny) continue
        const nextPt = { x: xs[nix]!, y: ys[niy]! }
        const stepLen =
          Math.abs(nextPt.x - anchor.x) + Math.abs(nextPt.y - anchor.y)
        const nextBends = cur.bends + (nextDir === cur.dirIdx ? 0 : 1)
        if (nextBends > MAX_CONNECTOR_BENDS) continue
        const cr = getUnitEdgeCrossings(cur.ix, cur.iy, nix, niy)
        if (cr < 0) continue
        const nextCrossings = cur.crossings + cr
        const nextLen = cur.len + stepLen
        const nextCost = nextCrossings * 1000 + nextLen * 10 + nextBends * 2
        pushState({
          ix: nix,
          iy: niy,
          dirIdx: nextDir,
          cost: nextCost,
          crossings: nextCrossings,
          bends: nextBends,
          len: nextLen,
          prev: cur,
        })
      }
    }

    return chosen
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []
    if (!graphics.rects) graphics.rects = []

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    for (const placement of this.outputNetLabelPlacements) {
      graphics.rects.push({
        center: placement.center,
        width: placement.width,
        height: placement.height,
        fill: getColorFromString(placement.globalConnNetId, 0.35),
        stroke: "black",
        label: [
          placement.netId ? `netId: ${placement.netId}` : undefined,
          `globalConnNetId: ${placement.globalConnNetId}`,
        ]
          .filter(Boolean)
          .join("\n"),
      })
    }

    return graphics
  }
}
