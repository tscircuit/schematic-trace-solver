import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { dir, type FacingDirection } from "lib/utils/dir"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import {
  getDimsForOrientation,
  getCenterFromAnchor,
  getRectBounds,
  NET_LABEL_HORIZONTAL_WIDTH,
  NET_LABEL_HORIZONTAL_HEIGHT,
} from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectIntersectsAnyTrace } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { isNetLabelTraceId } from "./netLabelTraceId"
import { visualizeSinglePinNetLabelPlacementSolver } from "./SinglePinNetLabelPlacementSolver_visualize"

export type SinglePinTestedCandidateStatus =
  | "ok"
  | "chip-collision"
  | "trace-collision"

export type SinglePinTestedCandidate = {
  center: { x: number; y: number }
  width: number
  height: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  anchor: { x: number; y: number }
  /** Axis-aligned pin → anchor path. Empty when anchor sits on the pin. */
  netLabelTracePath: Array<{ x: number; y: number }>
  orientation: FacingDirection
  step: number
  perpOffset: number
  status: SinglePinTestedCandidateStatus
}

const COLLISION_SHIM = 1e-3

const OPPOSITE_SIDE: Record<FacingDirection, FacingDirection> = {
  "x+": "x-",
  "x-": "x+",
  "y+": "y-",
  "y-": "y+",
}

/**
 * Places a net label for a single-pin (port-only) net by sweeping the
 * anchor outward from the pin (or along the chip side when the orientation
 * points back into the chip) until a collision-free candidate is found.
 * Fails rather than accept a colliding fallback.
 */
export class SinglePinNetLabelPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  overlappingSameNetTraceGroup: OverlappingSameNetTraceGroup
  availableOrientations: FacingDirection[]
  netLabelWidth?: number
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  searchStep: number
  xThreshold: number
  /** Cap for the along-chip-side slide used when orientation faces into the chip. */
  crossChipThreshold: number
  yOffsetMultipliers: number[]

  pinPosition: { x: number; y: number } | null = null
  pinSide: FacingDirection | null = null

  netLabelPlacement: NetLabelPlacement | null = null
  testedCandidates: SinglePinTestedCandidate[] = []

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
    overlappingSameNetTraceGroup: OverlappingSameNetTraceGroup
    availableOrientations: FacingDirection[]
    netLabelWidth?: number
    searchStep?: number
    xThreshold?: number
    crossChipThreshold?: number
    yOffsetMultipliers?: number[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.overlappingSameNetTraceGroup = params.overlappingSameNetTraceGroup
    this.availableOrientations = params.availableOrientations
    this.netLabelWidth = params.netLabelWidth

    this.searchStep = params.searchStep ?? 0.5 * NET_LABEL_HORIZONTAL_WIDTH
    this.xThreshold = params.xThreshold ?? 10 * NET_LABEL_HORIZONTAL_WIDTH
    this.crossChipThreshold =
      params.crossChipThreshold ?? 2.5 * NET_LABEL_HORIZONTAL_WIDTH
    this.yOffsetMultipliers = params.yOffsetMultipliers ?? [
      0.5, 1, 1.5, 2, 2.5, 3,
    ]

    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SinglePinNetLabelPlacementSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      overlappingSameNetTraceGroup: this.overlappingSameNetTraceGroup,
      availableOrientations: this.availableOrientations,
      netLabelWidth: this.netLabelWidth,
      searchStep: this.searchStep,
      xThreshold: this.xThreshold,
      crossChipThreshold: this.crossChipThreshold,
      yOffsetMultipliers: this.yOffsetMultipliers,
    }
  }

  private locatePin(): boolean {
    const pinId = this.overlappingSameNetTraceGroup.portOnlyPinId
    if (!pinId) {
      this.failed = true
      this.error = "No portOnlyPinId provided"
      return false
    }
    for (const chip of this.inputProblem.chips) {
      const p = chip.pins.find((pp) => pp.pinId === pinId)
      if (p) {
        this.pinPosition = { x: p.x, y: p.y }
        this.pinSide = p._facingDirection ?? getPinDirection(p, chip)
        return true
      }
    }
    this.failed = true
    this.error = `Port-only pin not found: ${pinId}`
    return false
  }

  private orientationPriority(): FacingDirection[] {
    const side = this.pinSide!
    const available =
      this.availableOrientations.length > 0
        ? this.availableOrientations
        : (["x-", "x+"] as FacingDirection[])

    const priority: FacingDirection[] = []
    if (available.includes(side)) priority.push(side)
    for (const h of ["x-", "x+"] as FacingDirection[]) {
      if (!priority.includes(h) && available.includes(h)) priority.push(h)
    }
    for (const v of ["y-", "y+"] as FacingDirection[]) {
      if (!priority.includes(v) && available.includes(v)) priority.push(v)
    }
    return priority
  }

  /** Skip synthesized net-label wires so they don't block their own pin's re-placement. */
  private getNonNetLabelTraceMap(): Record<
    MspConnectionPairId,
    SolvedTracePath
  > {
    const out: Record<MspConnectionPairId, SolvedTracePath> = {}
    for (const [id, trace] of Object.entries(this.inputTraceMap)) {
      if (isNetLabelTraceId(id)) continue
      out[id] = trace
    }
    return out
  }

  private testCandidate(
    anchor: { x: number; y: number },
    netLabelTracePath: Array<{ x: number; y: number }>,
    orientation: FacingDirection,
    step: number,
    perpOffset: number,
  ): SinglePinTestedCandidate {
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth: this.netLabelWidth,
    })
    const center = getCenterFromAnchor(anchor, orientation, width, height)
    const outward = dir(orientation)
    // Outward shim avoids edge-on-edge false positives.
    const shimmedCenter = {
      x: center.x + outward.x * COLLISION_SHIM,
      y: center.y + outward.y * COLLISION_SHIM,
    }
    const bounds = getRectBounds(shimmedCenter, width, height)

    const candidate: SinglePinTestedCandidate = {
      center: shimmedCenter,
      width,
      height,
      bounds,
      anchor,
      netLabelTracePath,
      orientation,
      step,
      perpOffset,
      status: "ok",
    }

    if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
      candidate.status = "chip-collision"
      return candidate
    }
    if (
      rectIntersectsAnyTrace(
        bounds,
        this.getNonNetLabelTraceMap(),
        "" as MspConnectionPairId,
        -1,
      ).hasIntersection
    ) {
      candidate.status = "trace-collision"
      return candidate
    }
    return candidate
  }

  /** Drop zero-length segments; return undefined if pin and anchor coincide. */
  private buildNetLabelTracePath(
    points: Array<{ x: number; y: number }>,
  ): Array<{ x: number; y: number }> | undefined {
    const eps = 1e-9
    const same = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps
    const out: Array<{ x: number; y: number }> = []
    for (const p of points) {
      if (out.length === 0 || !same(out[out.length - 1]!, p)) {
        out.push({ x: p.x, y: p.y })
      }
    }
    return out.length >= 2 ? out : undefined
  }

  private acceptCandidate(c: SinglePinTestedCandidate) {
    const pinId = this.overlappingSameNetTraceGroup.portOnlyPinId!
    const netLabelTracePath = this.buildNetLabelTracePath(c.netLabelTracePath)
    this.netLabelPlacement = {
      globalConnNetId: this.overlappingSameNetTraceGroup.globalConnNetId,
      dcConnNetId: undefined,
      netId: this.overlappingSameNetTraceGroup.netId,
      mspConnectionPairIds: [],
      pinIds: [pinId],
      orientation: c.orientation,
      anchorPoint: c.anchor,
      width: c.width,
      height: c.height,
      center: c.center,
      netLabelTracePath,
    }
    this.solved = true
  }

  private buildDistances(cap: number): number[] {
    const EPS = 1e-9
    const out: number[] = []
    for (let d = 0; d <= cap + EPS; d += this.searchStep) out.push(d)
    return out
  }

  private buildPerpAmplitudes(): number[] {
    const out: number[] = []
    for (const m of this.yOffsetMultipliers) {
      out.push(m * NET_LABEL_HORIZONTAL_HEIGHT)
      out.push(-m * NET_LABEL_HORIZONTAL_HEIGHT)
    }
    return out
  }

  override _step() {
    if (this.solved || this.failed) return
    if (!this.locatePin()) return

    const pin = this.pinPosition!
    const priority = this.orientationPriority()
    const pinOutward = dir(this.pinSide!)
    const pinPerp = { x: pinOutward.y, y: -pinOutward.x }
    const sweepDistances = this.buildDistances(this.xThreshold)
    const opposingDistances = this.buildDistances(this.crossChipThreshold)
    const perpAmplitudes = this.buildPerpAmplitudes()
    const preOffset = 0.5 * NET_LABEL_HORIZONTAL_HEIGHT

    const wickAmount = 0.5 * NET_LABEL_HORIZONTAL_HEIGHT

    /**
     * Vertical labels (y+/y-) get a small "wick" segment at the label
     * base — the anchor shifts by `wickAmount` in the orientation
     * direction and the previous anchor becomes a corner. Renders as a
     * visible kink where the wire enters the label. Collinear cases
     * (anchor already moving in the wick direction) just extend that
     * segment — harmless.
     */
    const applyWick = (
      anchor: { x: number; y: number },
      netLabelTracePath: Array<{ x: number; y: number }>,
      orientation: FacingDirection,
    ): {
      anchor: { x: number; y: number }
      netLabelTracePath: Array<{ x: number; y: number }>
    } => {
      if (orientation !== "y+" && orientation !== "y-") {
        return { anchor, netLabelTracePath }
      }
      const wickDir = orientation === "y+" ? 1 : -1
      const newAnchor = {
        x: anchor.x,
        y: anchor.y + wickDir * wickAmount,
      }
      return {
        anchor: newAnchor,
        netLabelTracePath: [...netLabelTracePath, newAnchor],
      }
    }

    for (const orientation of priority) {
      if (orientation === OPPOSITE_SIDE[this.pinSide!]) {
        // Orientation faces into the chip — slide along the chip side instead.
        const base = {
          x: pin.x + pinOutward.x * preOffset,
          y: pin.y + pinOutward.y * preOffset,
        }
        for (const d of opposingDistances) {
          for (const sign of [1, -1]) {
            const perpAmount = d * sign
            const rawAnchor = {
              x: base.x + pinPerp.x * perpAmount,
              y: base.y + pinPerp.y * perpAmount,
            }
            const { anchor, netLabelTracePath } = applyWick(
              rawAnchor,
              [{ x: pin.x, y: pin.y }, base, rawAnchor],
              orientation,
            )
            const c = this.testCandidate(
              anchor,
              netLabelTracePath,
              orientation,
              0,
              perpAmount,
            )
            this.testedCandidates.push(c)
            if (c.status === "ok") return this.acceptCandidate(c)
          }
        }
        continue
      }

      // Sweep away from the chip along pinOutward.
      for (const d of sweepDistances) {
        const rawAnchor = {
          x: pin.x + pinOutward.x * d,
          y: pin.y + pinOutward.y * d,
        }
        const { anchor, netLabelTracePath } = applyWick(
          rawAnchor,
          [{ x: pin.x, y: pin.y }, rawAnchor],
          orientation,
        )
        const c = this.testCandidate(
          anchor,
          netLabelTracePath,
          orientation,
          d,
          0,
        )
        this.testedCandidates.push(c)
        if (c.status === "ok") return this.acceptCandidate(c)
      }

      for (const perpAmount of perpAmplitudes) {
        for (const d of sweepDistances) {
          const sweepCorner = {
            x: pin.x + pinOutward.x * d,
            y: pin.y + pinOutward.y * d,
          }
          const rawAnchor = {
            x: sweepCorner.x + pinPerp.x * perpAmount,
            y: sweepCorner.y + pinPerp.y * perpAmount,
          }
          const { anchor, netLabelTracePath } = applyWick(
            rawAnchor,
            [{ x: pin.x, y: pin.y }, sweepCorner, rawAnchor],
            orientation,
          )
          const c = this.testCandidate(
            anchor,
            netLabelTracePath,
            orientation,
            d,
            perpAmount,
          )
          this.testedCandidates.push(c)
          if (c.status === "ok") return this.acceptCandidate(c)
        }
      }
    }

    this.failed = true
    this.error = "Could not place single-pin net label without collisions"
  }

  override visualize(): GraphicsObject {
    return visualizeSinglePinNetLabelPlacementSolver(this)
  }
}
