import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { getColorFromString } from "lib/utils/getColorFromString"
import { getNetLabelWidthForConnection } from "lib/utils/getNetLabelWidthForConnection"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { computeOverlappingSameNetTraceGroups } from "./computeOverlappingSameNetTraceGroups"
import { createFallbackTraceGroupLabelPlacement } from "./createFallbackTraceGroupLabelPlacement"
import { getNetLabelHeightForGroup } from "./getNetLabelHeightForGroup"
import { SingleNetLabelPlacementSolver } from "./SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"

/**
 * A group of traces that have at least one overlapping segment and
 * are part of the same global connectivity net
 */
export type OverlappingSameNetTraceGroup = {
  globalConnNetId: string
  netId?: string
  netLabelText?: string
  overlappingTraces?: SolvedTracePath
  portOnlyPinId?: string
  mspConnectionPairIds?: MspConnectionPairId[]
}

export interface NetLabelPlacement {
  globalConnNetId: string
  dcConnNetId?: string
  /**
   * Optional user-provided net identifier (if present in the input problem).
   */
  netId?: string
  /** User-facing label content, separate from the connectivity identifier. */
  netLabelText?: string
  /**
   * MSP pair ids that the label is associated with. Port-only labels use [].
   */
  mspConnectionPairIds: MspConnectionPairId[]
  /**
   * Pin ids relevant to this label. For a host trace, the two pins of that pair;
   * for a port-only label, the single port pin id.
   */
  pinIds: PinId[]
  orientation: FacingDirection

  /**
   * The anchor point is the point on the trace where the net label connects
   */
  anchorPoint: Point

  width: number
  height: number

  /**
   * The center point is computed from the anchor point, the width and height
   * and the orientation.
   */
  center: Point
  requiresCollisionResolution?: boolean
}

/**
 * Places net labels in an available orientation along a trace in each group.
 *
 * Trace groups each receive either one net label or no net label if there
 * isn't a netId.
 *
 * The specific placement of the net label is solved for using the
 */
export class NetLabelPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>

  overlappingSameNetTraceGroups: Array<OverlappingSameNetTraceGroup>

  queuedOverlappingSameNetTraceGroups: Array<OverlappingSameNetTraceGroup>

  declare activeSubSolver: SingleNetLabelPlacementSolver | null

  netLabelPlacements: Array<NetLabelPlacement> = []
  deferredFallbackPlacements: Array<NetLabelPlacement> = []
  failedGroups: Array<OverlappingSameNetTraceGroup> = []
  currentGroup: OverlappingSameNetTraceGroup | null = null
  triedAnyOrientationFallbackForCurrentGroup = false
  allowObstructedRailFallback: boolean

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
    allowObstructedRailFallback?: boolean
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.allowObstructedRailFallback =
      params.allowObstructedRailFallback ?? false

    this.overlappingSameNetTraceGroups =
      this.computeOverlappingSameNetTraceGroups()

    this.queuedOverlappingSameNetTraceGroups = [
      ...this.overlappingSameNetTraceGroups,
    ]
  }

  computeOverlappingSameNetTraceGroups(): Array<OverlappingSameNetTraceGroup> {
    return computeOverlappingSameNetTraceGroups({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
    })
  }

  private getNetLabelWidthForGroup(
    group: OverlappingSameNetTraceGroup,
  ): number | undefined {
    const pinIds = group.overlappingTraces?.pins.map((p) => p.pinId) ?? []
    if (group.portOnlyPinId) {
      pinIds.push(group.portOnlyPinId)
    }
    return getNetLabelWidthForConnection({
      inputProblem: this.inputProblem,
      netId: group.netId,
      pinIds,
      isPortOnlyLabel: group.portOnlyPinId !== undefined,
    })
  }

  private getNetLabelHeightForGroup(
    group: OverlappingSameNetTraceGroup,
  ): number | undefined {
    return (
      getNetLabelHeightForGroup({ inputProblem: this.inputProblem, group }) ??
      undefined
    )
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.netLabelPlacements.push(this.activeSubSolver.netLabelPlacement!)
      this.activeSubSolver = null
      this.currentGroup = null
      this.triedAnyOrientationFallbackForCurrentGroup = false
      return
    }

    if (this.activeSubSolver?.failed) {
      const fullOrients: FacingDirection[] = ["x+", "x-", "y+", "y-"]
      const currOrients = this.activeSubSolver.availableOrientations
      const isAlreadyFull =
        currOrients.length === 4 &&
        fullOrients.every((o) => currOrients.includes(o))
      if (
        !this.triedAnyOrientationFallbackForCurrentGroup &&
        !isAlreadyFull &&
        this.currentGroup
      ) {
        this.triedAnyOrientationFallbackForCurrentGroup = true
        const netLabelWidth = this.getNetLabelWidthForGroup(this.currentGroup)
        const netLabelHeight = this.getNetLabelHeightForGroup(this.currentGroup)
        this.activeSubSolver = new SingleNetLabelPlacementSolver({
          inputProblem: this.inputProblem,
          inputTraceMap: this.inputTraceMap,
          overlappingSameNetTraceGroup: this.currentGroup,
          availableOrientations: fullOrients,
          netLabelWidth,
          netLabelHeight,
        })
        return
      }
      if (this.currentGroup) {
        const fallbackPlacement = this.allowObstructedRailFallback
          ? createFallbackTraceGroupLabelPlacement({
              inputProblem: this.inputProblem,
              group: this.currentGroup,
              testedCandidates: this.activeSubSolver.testedCandidates,
            })
          : null
        if (fallbackPlacement) {
          this.deferredFallbackPlacements.push(fallbackPlacement)
        } else {
          this.failedGroups.push(this.currentGroup)
        }
      }
      this.activeSubSolver = null
      this.currentGroup = null
      this.triedAnyOrientationFallbackForCurrentGroup = false
      return
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    const nextOverlappingSameNetTraceGroup =
      this.queuedOverlappingSameNetTraceGroups.shift()

    if (!nextOverlappingSameNetTraceGroup) {
      if (this.deferredFallbackPlacements.length > 0) {
        this.netLabelPlacements.push(...this.deferredFallbackPlacements)
        this.deferredFallbackPlacements = []
      }
      this.solved = true
      return
    }

    const netId =
      nextOverlappingSameNetTraceGroup.netId ??
      nextOverlappingSameNetTraceGroup.globalConnNetId

    this.currentGroup = nextOverlappingSameNetTraceGroup
    this.triedAnyOrientationFallbackForCurrentGroup = false

    const netLabelWidth = this.getNetLabelWidthForGroup(this.currentGroup)
    const netLabelHeight = this.getNetLabelHeightForGroup(this.currentGroup)

    this.activeSubSolver = new SingleNetLabelPlacementSolver({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      overlappingSameNetTraceGroup: nextOverlappingSameNetTraceGroup,
      availableOrientations: this.inputProblem.availableNetLabelOrientations[
        netId
      ] ?? ["x+", "x-", "y+", "y-"],
      netLabelWidth,
      netLabelHeight,
    })
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }
    const graphics = visualizeInputProblem(this.inputProblem)

    for (const trace of Object.values(this.inputTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    for (const p of this.netLabelPlacements) {
      graphics.rects!.push({
        center: p.center,
        width: p.width,
        height: p.height,
        fill: getColorFromString(p.globalConnNetId, 0.35),
        strokeColor: getColorFromString(p.globalConnNetId, 0.9),
        label: `netId: ${p.netId}\nglobalConnNetId: ${p.globalConnNetId}`,
      } as any)
      graphics.points!.push({
        x: p.anchorPoint.x,
        y: p.anchorPoint.y,
        color: getColorFromString(p.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${p.orientation}`,
      } as any)
    }

    return graphics
  }
}
