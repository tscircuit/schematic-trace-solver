import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { SingleNetLabelPlacementSolver } from "./SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"
import type { FacingDirection } from "lib/utils/dir"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { computeOverlappingSameNetTraceGroups } from "./computeOverlappingSameNetTraceGroups"

/**
 * A group of traces that have at least one overlapping segment and
 * are part of the same global connectivity net
 */
export type OverlappingSameNetTraceGroup = {
  globalConnNetId: string
  netId?: string
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

  /** Pin → anchor wire when the anchor sits off-pin. Undefined otherwise. */
  netLabelTracePath?: Point[]
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
  currentGroup: OverlappingSameNetTraceGroup | null = null
  triedAnyOrientationFallbackForCurrentGroup = false

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap

    this.overlappingSameNetTraceGroups = computeOverlappingSameNetTraceGroups({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
    })

    this.queuedOverlappingSameNetTraceGroups = [
      ...this.overlappingSameNetTraceGroups,
    ]
  }

  private getNetLabelWidth(group: OverlappingSameNetTraceGroup) {
    if (!group.netId) return undefined
    return this.inputProblem.netConnections.find(
      (nc) => nc.netId === group.netId,
    )?.netLabelWidth
  }

  private createSubSolverForGroup(
    group: OverlappingSameNetTraceGroup,
    availableOrientations: FacingDirection[],
  ): SingleNetLabelPlacementSolver {
    return new SingleNetLabelPlacementSolver({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      overlappingSameNetTraceGroup: group,
      availableOrientations,
      netLabelWidth: this.getNetLabelWidth(group),
    })
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
      // Retry once with all orientations as a fallback before failing
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
        this.activeSubSolver = this.createSubSolverForGroup(
          this.currentGroup,
          fullOrients,
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

    const nextGroup = this.queuedOverlappingSameNetTraceGroups.shift()
    if (!nextGroup) {
      this.solved = true
      return
    }

    const netId = nextGroup.netId ?? nextGroup.globalConnNetId
    this.currentGroup = nextGroup
    this.triedAnyOrientationFallbackForCurrentGroup = false

    this.activeSubSolver = this.createSubSolverForGroup(
      nextGroup,
      this.inputProblem.availableNetLabelOrientations[netId] ?? [
        "x+",
        "x-",
        "y+",
        "y-",
      ],
    )
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
