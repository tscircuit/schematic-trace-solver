import type { GraphicsObject } from "graphics-debug"
import {
  getPinMap,
  getTracePins,
} from "lib/solvers/AvailableNetOrientationSolver/traces"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import {
  rectIntersectsAnyTextBox,
  boundsOverlap,
  getTextBoxBounds,
} from "lib/utils/textBoxBounds"
import {
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"

type Side = "left" | "right"

type SideLabel = {
  labelIndex: number
  chipId: string
  side: Side
}

type AlignmentProposal = {
  labelIndex: number
  originalLabel: NetLabelPlacement
  movedLabel: NetLabelPlacement
  connectorTrace: SolvedTracePath
}

const EPS = 1e-6

/**
 * Basic V1: place horizontal labels from the same chip side in one column.
 *
 * The column is chosen from the outermost existing label anchor, so labels
 * only move outward. A short horizontal connector keeps each moved label
 * attached to its original trace.
 */
export class SideChildNetLabelAlignmentSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]

  private pinMap: ReturnType<typeof getPinMap>

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
    netLabelPlacements: NetLabelPlacement[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputTraces = [...params.traces]
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.pinMap = getPinMap(params.inputProblem)
  }

  override _step() {
    for (const group of this.getSideLabelGroups()) {
      this.alignGroup(group)
    }
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.points) graphics.points = []

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      } as any)
    }
    for (const label of this.outputNetLabelPlacements) {
      graphics.rects!.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
      } as any)
      graphics.points!.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: getColorFromString(label.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${label.orientation}`,
      } as any)
    }
    return graphics
  }

  private getSideLabelGroups() {
    const groups = new Map<string, SideLabel[]>()

    for (let index = 0; index < this.outputNetLabelPlacements.length; index++) {
      const sideLabel = this.getSideLabel(index)
      if (!sideLabel) continue

      const key = `${sideLabel.chipId}:${sideLabel.side}`
      groups.set(key, [...(groups.get(key) ?? []), sideLabel])
    }

    return [...groups.values()].filter((group) => group.length > 1)
  }

  private getSideLabel(labelIndex: number): SideLabel | null {
    const label = this.outputNetLabelPlacements[labelIndex]!
    if (label.orientation !== "x-" && label.orientation !== "x+") return null

    for (const pinId of label.pinIds) {
      const pin = this.pinMap[pinId]
      if (!pin) continue

      const chip = this.inputProblem.chips.find(
        (candidate) => candidate.chipId === pin.chipId,
      )
      if (!chip) continue

      const leftEdge = chip.center.x - chip.width / 2
      const rightEdge = chip.center.x + chip.width / 2
      if (label.orientation === "x-" && Math.abs(pin.x - leftEdge) <= EPS) {
        return { labelIndex, chipId: chip.chipId, side: "left" }
      }
      if (label.orientation === "x+" && Math.abs(pin.x - rightEdge) <= EPS) {
        return { labelIndex, chipId: chip.chipId, side: "right" }
      }
    }

    return null
  }

  private alignGroup(group: SideLabel[]) {
    const side = group[0]!.side
    const columnX =
      side === "left"
        ? Math.min(
            ...group.map(
              ({ labelIndex }) =>
                this.outputNetLabelPlacements[labelIndex]!.anchorPoint.x,
            ),
          )
        : Math.max(
            ...group.map(
              ({ labelIndex }) =>
                this.outputNetLabelPlacements[labelIndex]!.anchorPoint.x,
            ),
          )

    const proposals: AlignmentProposal[] = []
    for (const { labelIndex } of group) {
      const label = this.outputNetLabelPlacements[labelIndex]!
      if (Math.abs(label.anchorPoint.x - columnX) <= EPS) continue

      const movedLabel = {
        ...label,
        anchorPoint: { ...label.anchorPoint, x: columnX },
        center: {
          ...label.center,
          x: label.center.x + columnX - label.anchorPoint.x,
        },
      }
      proposals.push({
        labelIndex,
        originalLabel: label,
        movedLabel,
        connectorTrace: {
          mspPairId: `side-child-net-label-${group[0]!.chipId}-${side}-${labelIndex}`,
        dcConnNetId: label.dcConnNetId ?? label.globalConnNetId,
        globalConnNetId: label.globalConnNetId,
        userNetId: label.netId,
        pins: getTracePins(label, this.pinMap),
        tracePath: [label.anchorPoint, movedLabel.anchorPoint],
        mspConnectionPairIds: [],
        pinIds: label.pinIds,
        },
      })
    }

    if (proposals.length === 0 || this.hasCollision(proposals)) return

    for (const proposal of proposals) {
      this.outputNetLabelPlacements[proposal.labelIndex] = proposal.movedLabel
      this.outputTraces.push(proposal.connectorTrace)
    }
  }

  private hasCollision(proposals: AlignmentProposal[]) {
    const proposedLabels = this.outputNetLabelPlacements.map(
      (label, index) =>
        proposals.find((proposal) => proposal.labelIndex === index)?.movedLabel ??
        label,
    )

    for (const proposal of proposals) {
      const labelBounds = getRectBounds(
        proposal.movedLabel.center,
        proposal.movedLabel.width,
        proposal.movedLabel.height,
      )

      if (
        this.inputProblem.chips.some((chip) =>
          boundsOverlap(labelBounds, getInputChipBounds(chip)),
        ) || rectIntersectsAnyTextBox(labelBounds, this.inputProblem)
      ) {
        return true
      }

      if (
        this.outputTraces.some(
          (trace) =>
            trace.globalConnNetId !== proposal.movedLabel.globalConnNetId &&
            trace.tracePath.some((point, index) =>
            index > 0
              ? segmentIntersectsRect(
                  trace.tracePath[index - 1]!,
                  point,
                  labelBounds,
              )
              : false,
          ),
        )
      ) {
        return true
      }

      if (
        proposedLabels.some(
          (label, index) =>
            index !== proposal.labelIndex &&
            boundsOverlap(
              labelBounds,
              getRectBounds(label.center, label.width, label.height),
            ),
        )
      ) {
        return true
      }

      if (this.connectorCollides(proposal, proposedLabels, proposals)) {
        return true
      }
    }

    return false
  }

  private connectorCollides(
    proposal: AlignmentProposal,
    labels: NetLabelPlacement[],
    proposals: AlignmentProposal[],
  ) {
    const [start, end] = proposal.connectorTrace.tracePath

    if (
      this.inputProblem.chips.some((chip) =>
        segmentIntersectsRect(start!, end!, getInputChipBounds(chip)),
      ) ||
      (this.inputProblem.textBoxes ?? []).some((textBox) =>
        segmentIntersectsRect(start!, end!, getTextBoxBounds(textBox)),
      )
    ) {
      return true
    }

    if (
      labels.some(
        (label, index) =>
          index !== proposal.labelIndex &&
          segmentIntersectsRect(
            start!,
            end!,
            getRectBounds(label.center, label.width, label.height),
          ),
      )
    ) {
      return true
    }

    return [...this.outputTraces, ...proposals.map((p) => p.connectorTrace)].some(
      (trace) =>
        trace !== proposal.connectorTrace &&
        trace.globalConnNetId !== proposal.connectorTrace.globalConnNetId &&
        this.segmentsIntersect(start!, end!, trace.tracePath),
    )
  }

  private segmentsIntersect(
    start: { x: number; y: number },
    end: { x: number; y: number },
    path: { x: number; y: number }[],
  ) {
    for (let index = 1; index < path.length; index++) {
      const otherStart = path[index - 1]!
      const otherEnd = path[index]!
      const horizontal = Math.abs(start.y - end.y) <= EPS
      const otherHorizontal = Math.abs(otherStart.y - otherEnd.y) <= EPS

      if (horizontal === otherHorizontal) {
        if (horizontal && Math.abs(start.y - otherStart.y) > EPS) continue
        if (!horizontal && Math.abs(start.x - otherStart.x) > EPS) continue
        const overlap = horizontal
          ? Math.min(Math.max(start.x, end.x), Math.max(otherStart.x, otherEnd.x)) -
            Math.max(Math.min(start.x, end.x), Math.min(otherStart.x, otherEnd.x))
          : Math.min(Math.max(start.y, end.y), Math.max(otherStart.y, otherEnd.y)) -
            Math.max(Math.min(start.y, end.y), Math.min(otherStart.y, otherEnd.y))
        if (overlap > EPS) return true
        continue
      }

      const horizontalStart = horizontal ? start : otherStart
      const horizontalEnd = horizontal ? end : otherEnd
      const verticalStart = horizontal ? otherStart : start
      const verticalEnd = horizontal ? otherEnd : end
      if (
        verticalStart.x >= Math.min(horizontalStart.x, horizontalEnd.x) - EPS &&
        verticalStart.x <= Math.max(horizontalStart.x, horizontalEnd.x) + EPS &&
        horizontalStart.y >= Math.min(verticalStart.y, verticalEnd.y) - EPS &&
        horizontalStart.y <= Math.max(verticalStart.y, verticalEnd.y) + EPS
      ) {
        return true
      }
    }

    return false
  }
}
