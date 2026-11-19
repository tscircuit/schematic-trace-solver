import type { GraphicsObject, Rect } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { alignSameNetJunctions } from "./alignSameNetJunctions"
import { removeRedundantTerminalSegments } from "./removeRedundantTerminalSegments"
import { placeGroundRailLabelsAtOuterEnd } from "./placeGroundRailLabelsAtOuterEnd"
import { shortenSameSideRailToLabelAnchor } from "./shortenSameSideRailToLabelAnchor"

interface SameNetJunctionAlignmentSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
}

/** Turns separate same-net load traces into one shared rail with short junction branches. */
export class SameNetJunctionAlignmentSolver extends BaseSolver {
  private input: SameNetJunctionAlignmentSolverInput
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]

  constructor(input: SameNetJunctionAlignmentSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
    this.outputNetLabelPlacements = input.netLabelPlacements
  }

  override _step() {
    const alignment = alignSameNetJunctions(this.input)
    this.outputTraces = shortenSameSideRailToLabelAnchor({
      traces: alignment.traces,
      netLabelPlacements: alignment.netLabelPlacements,
    })
    this.outputTraces = removeRedundantTerminalSegments({
      inputProblem: this.input.inputProblem,
      traces: this.outputTraces,
      netLabelPlacements: alignment.netLabelPlacements,
    })
    this.outputNetLabelPlacements = placeGroundRailLabelsAtOuterEnd({
      inputProblem: this.input.inputProblem,
      traces: this.outputTraces,
      netLabelPlacements: alignment.netLabelPlacements,
      netLabelConnectorTraceIds: this.input.netLabelConnectorTraceIds,
    })
    // A ground label moved from its connector stub onto its rail leaves the
    // stub without a label; drop it.
    const movedLabelAnchors = alignment.netLabelPlacements.flatMap(
      (label, index) => {
        const moved = this.outputNetLabelPlacements[index]!
        return moved.mspConnectionPairIds === label.mspConnectionPairIds
          ? []
          : [label.anchorPoint]
      },
    )
    this.outputTraces = this.outputTraces.filter(
      (trace) =>
        !this.input.netLabelConnectorTraceIds.has(trace.mspPairId) ||
        !movedLabelAnchors.some((anchor) =>
          tracePathContainsPoint(trace.tracePath, anchor),
        ),
    )
    this.stats.alignedJunctionCount = alignment.alignedJunctionCount
    this.stats.collapsedCycleCount = alignment.collapsedCycleCount
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem)
    graphics.lines ??= []
    graphics.rects ??= []
    graphics.points ??= []
    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }
    for (const label of this.outputNetLabelPlacements) {
      const labelRect: Rect & { strokeColor: string } = {
        center: label.center,
        width: label.width,
        height: label.height,
        fill: getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
      }
      graphics.rects.push(labelRect)
      graphics.points.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: getColorFromString(label.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${label.orientation}`,
      })
    }
    return graphics
  }
}
