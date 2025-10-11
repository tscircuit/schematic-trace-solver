import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

interface LabelMergingSolverInput {
  netLabelPlacements: NetLabelPlacement[]
}

interface LabelMergingSolverOutput {
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

export class LabelMergingSolver extends BaseSolver {
  private input: LabelMergingSolverInput
  private output!: LabelMergingSolverOutput

  constructor(solverInput: LabelMergingSolverInput) {
    super()
    this.input = solverInput
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

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
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
}
