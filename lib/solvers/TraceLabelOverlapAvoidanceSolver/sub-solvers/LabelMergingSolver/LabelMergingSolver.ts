import type { SolvedTracePath } from "../../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../../../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { GraphicsObject, Line } from "graphics-debug"
import { getColorFromString } from "lib/utils/getColorFromString"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

interface LabelMergingSolverInput {
  netLabelPlacements: NetLabelPlacement[]
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

interface LabelMergingSolverOutput {
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

/**
 * Merges multiple net labels into a single, larger label if they are on the
 * same side of the same chip, reducing schematic clutter.
 */
export class MergedNetLabelObstacleSolver extends BaseSolver {
  private input: LabelMergingSolverInput
  private output!: LabelMergingSolverOutput
  private inputProblem: InputProblem
  private traces: SolvedTracePath[]

  constructor(solverInput: LabelMergingSolverInput) {
    // console.log(JSON.stringify(solverInput));

    super()
    this.input = solverInput
    this.inputProblem = solverInput.inputProblem
    this.traces = solverInput.traces

    // Initialize output to a default state to allow visualization before the first step
    this.output = {
      netLabelPlacements: solverInput.netLabelPlacements,
      mergedLabelNetIdMap: {},
    }
  }

  override _step() {
    const originalLabels = this.input.netLabelPlacements
    const mergedLabelNetIdMap: Record<string, Set<string>> = {}

    if (!originalLabels || originalLabels.length === 0) {
      this.output = {
        netLabelPlacements: [],
        mergedLabelNetIdMap: {},
      }
      this.solved = true
      return
    }

    const labelGroups: Record<string, NetLabelPlacement[]> = {}

    for (const p of originalLabels) {
      if (p.pinIds.length === 0) continue
      const chipId = p.pinIds[0].split(".")[0]
      if (!chipId) continue
      const key = `${chipId}-${p.orientation}`
      if (!(key in labelGroups)) {
        labelGroups[key] = []
      }
      labelGroups[key]!.push(p)
    }

    const finalPlacements: NetLabelPlacement[] = []
    for (const [key, group] of Object.entries(labelGroups)) {
      if (group.length <= 1) {
        finalPlacements.push(...group)
        continue
      }

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of group) {
        const bounds = getRectBounds(p.center, p.width, p.height)
        minX = Math.min(minX, bounds.minX)
        minY = Math.min(minY, bounds.minY)
        maxX = Math.max(maxX, bounds.maxX)
        maxY = Math.max(maxY, bounds.maxY)
      }

      const newWidth = maxX - minX
      const newHeight = maxY - minY
      const template = group[0]!
      const syntheticId = `merged-group-${key}`
      const originalNetIds = new Set(group.map((p) => p.globalConnNetId))
      mergedLabelNetIdMap[syntheticId] = originalNetIds

      finalPlacements.push({
        ...template,
        globalConnNetId: syntheticId,
        width: newWidth,
        height: newHeight,
        center: { x: minX + newWidth / 2, y: minY + newHeight / 2 },
        pinIds: [...new Set(group.flatMap((p) => p.pinIds))],
        mspConnectionPairIds: [
          ...new Set(group.flatMap((p) => p.mspConnectionPairIds)),
        ],
      })
    }

    this.output = {
      netLabelPlacements: finalPlacements,
      mergedLabelNetIdMap,
    }
    this.solved = true
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

    for (const finalLabel of this.output.netLabelPlacements) {
      const isMerged = finalLabel.globalConnNetId.startsWith("merged-group-")
      const color = getColorFromString(finalLabel.globalConnNetId)

      if (isMerged) {
        // Draw the new merged label
        graphics.rects.push({
          center: finalLabel.center,
          width: finalLabel.width,
          height: finalLabel.height,
          fill: color.replace(/, 1\)/, ", 0.2)"), // semi-transparent
          stroke: color,
          label: finalLabel.globalConnNetId,
        })

        const originalNetIds =
          this.output.mergedLabelNetIdMap[finalLabel.globalConnNetId]
        if (originalNetIds) {
          for (const originalNetId of originalNetIds) {
            const originalLabel = originalLabelsById.get(originalNetId)
            if (originalLabel) {
              // Draw the original label as a dashed box
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
              // Draw line from original to new center
              graphics.lines.push({
                points: [originalLabel.center, finalLabel.center],
                strokeColor: color,
                strokeDash: "2 2",
              })
            }
          }
        }
      } else {
        // Draw un-merged labels
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
