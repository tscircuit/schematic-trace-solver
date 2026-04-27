import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { computeOverlappingSameNetTraceGroups } from "../NetLabelPlacementSolver/computeOverlappingSameNetTraceGroups"
import { type FacingDirection } from "lib/utils/dir"
import { SinglePinNetLabelPlacementSolver } from "./SinglePinNetLabelPlacementSolver"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import {
  NET_LABEL_TRACE_ID_PREFIX,
  NET_LABEL_ANCHOR_PIN_ID_PREFIX,
  NET_LABEL_CHIP_ID,
  isNetLabelTraceId,
} from "./netLabelTraceId"

export {
  NET_LABEL_TRACE_ID_PREFIX,
  isNetLabelTraceId,
} from "./netLabelTraceId"

export interface SinglePinNetLabelPlacementPipelineSolverParams {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  /**
   * Placements already produced by NetLabelPlacementSolver. The pipeline
   * only re-processes port-only pins whose existing placement is missing
   * or whose label rect collides with a chip or trace.
   */
  existingPlacements: NetLabelPlacement[]
}

const FULL_ORIENTATIONS: FacingDirection[] = ["x+", "x-", "y+", "y-"]

/**
 * Pipeline-level solver dedicated to single-pin (port-only) net labels.
 *
 * Owns the full single-pin flow that the previous design scattered between
 * NetLabelPlacementSolver (group dispatch), SingleNetLabelPlacementSolver
 * (delegation) and SchematicTracePipelineSolver (trace synthesis):
 *
 *  1. Recomputes the per-net trace groups from the current trace map and
 *     keeps only port-only ones.
 *  2. Iterates them as sub-solvers (SinglePinNetLabelPlacementSolver per
 *     group), with the same all-orientation-fallback retry that
 *     NetLabelPlacementSolver uses for multi-pin groups.
 *  3. After every placement is collected, synthesizes the orthogonal
 *     pin → anchor wires as SolvedTracePath entries (so downstream stages
 *     treat them as real traces) and exposes both the merged placement
 *     list and the merged trace list for the pipeline to consume.
 */
export class SinglePinNetLabelPlacementPipelineSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  existingPlacements: NetLabelPlacement[]

  portOnlyGroups: OverlappingSameNetTraceGroup[]
  queuedPortOnlyGroups: OverlappingSameNetTraceGroup[]
  currentGroup: OverlappingSameNetTraceGroup | null = null
  triedAnyOrientationFallbackForCurrentGroup = false

  declare activeSubSolver: SinglePinNetLabelPlacementSolver | null

  placements: NetLabelPlacement[] = []
  synthesizedTraces: SolvedTracePath[] = []
  tracesWithSynthesized: SolvedTracePath[] = []

  constructor(params: SinglePinNetLabelPlacementPipelineSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.existingPlacements = params.existingPlacements

    const allPortOnlyGroups = computeOverlappingSameNetTraceGroups({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
    }).filter((g) => g.portOnlyPinId)

    const placementByPinId = new Map<string, NetLabelPlacement>()
    for (const p of this.existingPlacements) {
      if (p.pinIds.length === 1) {
        placementByPinId.set(p.pinIds[0]!, p)
      }
    }

    const chipObstacleSpatialIndex =
      this.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(this.inputProblem.chips)

    this.portOnlyGroups = allPortOnlyGroups.filter((g) => {
      const existing = placementByPinId.get(g.portOnlyPinId!)
      if (!existing) return true
      const bounds = getRectBounds(
        existing.center,
        existing.width,
        existing.height,
      )
      if (chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
        return true
      }
      // A trace VERTEX (turn point) inside the label rect means the trace
      // is doing something structural at the label site (e.g. wrapping
      // around the pin). A trace just passing straight through with no
      // vertex inside is tolerated. Synthesized pin → anchor wires are
      // skipped — their anchor endpoint sits on the label rect edge by
      // design and would always trigger this check.
      for (const [id, trace] of Object.entries(this.inputTraceMap)) {
        if (isNetLabelTraceId(id)) continue
        for (const pt of trace.tracePath) {
          if (
            pt.x >= bounds.minX &&
            pt.x <= bounds.maxX &&
            pt.y >= bounds.minY &&
            pt.y <= bounds.maxY
          ) {
            return true
          }
        }
      }
      const directiveKey = g.netId ?? g.globalConnNetId
      const directive =
        this.inputProblem.availableNetLabelOrientations[directiveKey]
      if (
        directive &&
        directive.length > 0 &&
        !directive.includes(existing.orientation)
      ) {
        return true
      }
      return false
    })

    this.queuedPortOnlyGroups = [...this.portOnlyGroups]
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SinglePinNetLabelPlacementPipelineSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      existingPlacements: this.existingPlacements,
    }
  }

  private getNetLabelWidth(group: OverlappingSameNetTraceGroup) {
    if (!group.netId) return undefined
    return this.inputProblem.netConnections.find(
      (nc) => nc.netId === group.netId,
    )?.netLabelWidth
  }

  private createSubSolver(
    group: OverlappingSameNetTraceGroup,
    availableOrientations: FacingDirection[],
  ): SinglePinNetLabelPlacementSolver {
    return new SinglePinNetLabelPlacementSolver({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      overlappingSameNetTraceGroup: group,
      availableOrientations,
      netLabelWidth: this.getNetLabelWidth(group),
    })
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.placements.push(this.activeSubSolver.netLabelPlacement!)
      this.activeSubSolver = null
      this.currentGroup = null
      this.triedAnyOrientationFallbackForCurrentGroup = false
      return
    }

    if (this.activeSubSolver?.failed) {
      const currOrients = this.activeSubSolver.availableOrientations
      const isAlreadyFull =
        currOrients.length === 4 &&
        FULL_ORIENTATIONS.every((o) => currOrients.includes(o))

      if (
        !this.triedAnyOrientationFallbackForCurrentGroup &&
        !isAlreadyFull &&
        this.currentGroup
      ) {
        this.triedAnyOrientationFallbackForCurrentGroup = true
        this.activeSubSolver = this.createSubSolver(
          this.currentGroup,
          FULL_ORIENTATIONS,
        )
        return
      }

      this.failed = true
      this.error = this.activeSubSolver.error
      return
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    const nextGroup = this.queuedPortOnlyGroups.shift()
    if (!nextGroup) {
      this.finalize()
      this.solved = true
      return
    }

    const netId = nextGroup.netId ?? nextGroup.globalConnNetId
    this.currentGroup = nextGroup
    this.triedAnyOrientationFallbackForCurrentGroup = false

    this.activeSubSolver = this.createSubSolver(
      nextGroup,
      this.inputProblem.availableNetLabelOrientations[netId] ??
        FULL_ORIENTATIONS,
    )
  }

  /**
   * Build SolvedTracePath entries representing the pin → net-label wires
   * for the placements collected during this run, then concatenate them
   * with the pre-existing trace map. Synthesis runs once at the end
   * because each placement is independent — order doesn't matter.
   */
  private finalize() {
    const pinIdToPin = new Map<
      string,
      { pinId: string; x: number; y: number; chipId: string }
    >()
    for (const chip of this.inputProblem.chips) {
      for (const pin of chip.pins) {
        pinIdToPin.set(pin.pinId, {
          pinId: pin.pinId,
          x: pin.x,
          y: pin.y,
          chipId: chip.chipId,
        })
      }
    }

    const synthesized: SolvedTracePath[] = []
    for (const p of this.placements) {
      if (!p.netLabelTracePath || p.netLabelTracePath.length < 2) continue
      if (p.pinIds.length !== 1) continue

      const realPinId = p.pinIds[0]!
      const realPin = pinIdToPin.get(realPinId)
      if (!realPin) continue

      const anchorPinId = `${NET_LABEL_ANCHOR_PIN_ID_PREFIX}${realPinId}`
      const tracePairId = `${NET_LABEL_TRACE_ID_PREFIX}${realPinId}`
      const newAnchorPin = {
        pinId: anchorPinId,
        x: p.anchorPoint.x,
        y: p.anchorPoint.y,
        chipId: NET_LABEL_CHIP_ID,
      }
      const newTracePath = p.netLabelTracePath.map((pt) => ({
        x: pt.x,
        y: pt.y,
      }))

      // If the synthesized trace already exists in the input map (second
      // pipeline pass), mutate it in place so downstream consumers — like
      // TraceCleanupSolver's outputTraces array, which the SVG renderer
      // reads — see the updated path.
      const existing = this.inputTraceMap[tracePairId]
      if (existing) {
        existing.tracePath = newTracePath
        existing.pins = [realPin, newAnchorPin]
        existing.pinIds = [realPinId, anchorPinId]
        continue
      }

      synthesized.push({
        mspPairId: tracePairId,
        dcConnNetId: p.dcConnNetId ?? p.globalConnNetId,
        globalConnNetId: p.globalConnNetId,
        userNetId: p.netId,
        pins: [realPin, newAnchorPin],
        tracePath: newTracePath,
        mspConnectionPairIds: [tracePairId],
        pinIds: [realPinId, anchorPinId],
      })
    }

    this.synthesizedTraces = synthesized
    this.tracesWithSynthesized = [
      ...Object.values(this.inputTraceMap),
      ...synthesized,
    ]
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }
    return { lines: [], points: [], rects: [], circles: [], texts: [] }
  }
}
