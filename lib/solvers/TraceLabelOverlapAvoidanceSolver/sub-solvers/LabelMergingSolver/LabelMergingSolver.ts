import type { SolvedTracePath } from "../../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../../../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { GraphicsObject, Line } from "graphics-debug"
import { getColorFromString } from "lib/utils/getColorFromString"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { groupLabelsByChipAndOrientation } from "./groupLabelsByChipAndOrientation"
import { mergeLabelGroup } from "./mergeLabelGroup"
import { filterLabelsAtTraceEdges } from "./filterLabelsAtTraceEdges"

interface LabelMergingSolverInput {
  netLabelPlacements: NetLabelPlacement[]
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

interface LabelMergingSolverOutput {
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

type PipelineStep =
  | "filtering_labels"
  | "grouping_labels"
  | "merging_groups"
  | "finalizing"

/**
 * Merges multiple net labels into a single, larger label if they are on the
 * same side of the same chip and physically adjacent.
 */
export class MergedNetLabelObstacleSolver extends BaseSolver {
  private input: LabelMergingSolverInput
  private output!: LabelMergingSolverOutput
  private inputProblem: InputProblem
  private traces: SolvedTracePath[]

  // State for the new pipeline
  private pipelineStep: PipelineStep = "filtering_labels"
  private filteredLabels: NetLabelPlacement[] = []
  private labelGroups: Record<string, NetLabelPlacement[]> = {}
  private groupKeysToProcess: string[] = []
  private finalPlacements: NetLabelPlacement[] = []
  private mergedLabelNetIdMap: Record<string, Set<string>> = {}
  private activeMergingGroupKey: string | null = null

  constructor(solverInput: LabelMergingSolverInput) {
    super()
    this.input = solverInput
    this.inputProblem = solverInput.inputProblem
    this.traces = solverInput.traces

    this.output = {
      netLabelPlacements: solverInput.netLabelPlacements,
      mergedLabelNetIdMap: {},
    }
  }

  override _step() {
    switch (this.pipelineStep) {
      case "filtering_labels":
        this.filteredLabels = filterLabelsAtTraceEdges({
          labels: this.input.netLabelPlacements,
          traces: this.traces,
        })
        this.pipelineStep = "grouping_labels"
        break

      case "grouping_labels":
        this.labelGroups = groupLabelsByChipAndOrientation({
          labels: this.filteredLabels,
          chips: this.inputProblem.chips,
        })
        this.groupKeysToProcess = Object.keys(this.labelGroups)
        this.pipelineStep = "merging_groups"
        break

      case "merging_groups":
        if (this.groupKeysToProcess.length === 0) {
          this.pipelineStep = "finalizing"
          this.activeMergingGroupKey = null
          break
        }

        const groupKey = this.groupKeysToProcess.pop()!
        this.activeMergingGroupKey = groupKey
        const group = this.labelGroups[groupKey]!

        if (group.length > 1) {
          const { mergedLabel, originalNetIds } = mergeLabelGroup(
            group,
            groupKey,
          )
          this.finalPlacements.push(mergedLabel)
          this.mergedLabelNetIdMap[mergedLabel.globalConnNetId] = originalNetIds
        } else {
          this.finalPlacements.push(...group)
        }
        break

      case "finalizing":
        // Any labels that were filtered out and not part of any group should be added back
        const processedOriginalIds = new Set(
          this.finalPlacements.flatMap((p) =>
            this.mergedLabelNetIdMap[p.globalConnNetId]
              ? [...this.mergedLabelNetIdMap[p.globalConnNetId]!]
              : [p.globalConnNetId],
          ),
        )
        const unprocessedLabels = this.input.netLabelPlacements.filter(
          (l) => !processedOriginalIds.has(l.globalConnNetId),
        )

        this.output = {
          netLabelPlacements: [...this.finalPlacements, ...unprocessedLabels],
          mergedLabelNetIdMap: this.mergedLabelNetIdMap,
        }
        this.solved = true
        break
    }
  }

  getOutput(): LabelMergingSolverOutput {
    return this.output
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.rects) graphics.rects = []
    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []
    if (!graphics.texts) graphics.texts = []

    const originalLabelsById = new Map<string, NetLabelPlacement>()
    for (const label of this.input.netLabelPlacements) {
      originalLabelsById.set(label.globalConnNetId, label)
    }

    for (const trace of this.traces) {
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }

    // Highlight the active sub-group being merged
    if (
      this.activeMergingGroupKey &&
      this.labelGroups[this.activeMergingGroupKey]
    ) {
      const activeGroup = this.labelGroups[this.activeMergingGroupKey]!
      for (const label of activeGroup) {
        graphics.rects.push({
          center: label.center,
          width: label.width,
          height: label.height,
          fill: "rgba(255, 165, 0, 0.5)", // Orange highlight
          stroke: "orange",
        })
      }
    }

    for (const finalLabel of this.output.netLabelPlacements) {
      const isMerged = finalLabel.globalConnNetId.startsWith("merged-group-")
      const color = getColorFromString(finalLabel.globalConnNetId)

      if (isMerged) {
        graphics.rects.push({
          center: finalLabel.center,
          width: finalLabel.width,
          height: finalLabel.height,
          fill: color.replace(/, 1\)/, ", 0.2)"),
          stroke: color,
          label: finalLabel.globalConnNetId,
        })

        const originalNetIds =
          this.output.mergedLabelNetIdMap[finalLabel.globalConnNetId]
        if (originalNetIds) {
          for (const originalNetId of originalNetIds) {
            const originalLabel = originalLabelsById.get(originalNetId)
            if (originalLabel) {
              const bounds = getRectBounds(
                originalLabel.center,
                originalLabel.width,
                originalLabel.height,
              )
              const p1 = { x: bounds.minX, y: bounds.minY }
              const p2 = { x: bounds.maxX, y: bounds.minY }
              const p3 = { x: bounds.maxX, y: bounds.maxY }
              const p4 = { x: bounds.minX, y: bounds.maxY }
              graphics.lines.push({
                points: [p1, p2, p3, p4, p1],
                strokeColor: color,
                strokeDash: "4 4",
              })
              graphics.lines.push({
                points: [originalLabel.center, finalLabel.center],
                strokeColor: color,
                strokeDash: "2 2",
              })
            }
          }
        }
      } else {
        graphics.rects.push({
          center: finalLabel.center,
          width: finalLabel.width,
          height: finalLabel.height,
          stroke: color,
          label: finalLabel.globalConnNetId,
        })
      }
    }

    return graphics
  }
}
