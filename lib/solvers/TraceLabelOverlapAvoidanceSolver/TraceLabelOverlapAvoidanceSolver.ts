import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { InputProblem } from "../../types/InputProblem"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap.ts"
import { rerouteCollidingTrace } from "./rerouteCollidingTrace.ts"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getColorFromString } from "lib/utils/getColorFromString.ts"

interface TraceLabelOverlapAvoidanceSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  private problem: InputProblem
  private traces: SolvedTracePath[]
  private netTempLabelPlacements: NetLabelPlacement[]
  private netLabelPlacements: NetLabelPlacement[]
  public updatedTraces: SolvedTracePath[]
  private mergedLabelNetIdMap: Map<string, Set<string>>

  constructor(params: TraceLabelOverlapAvoidanceSolverParams) {
    super()
    this.problem = params.inputProblem
    this.traces = params.traces
    this.updatedTraces = [...params.traces]
    this.mergedLabelNetIdMap = new Map()

    const originalLabels = params.netLabelPlacements
    this.netLabelPlacements = originalLabels
    if (!originalLabels || originalLabels.length === 0) {
      this.netTempLabelPlacements = []
      return
    }

    const labelGroups = new Map<string, NetLabelPlacement[]>()

    for (const p of originalLabels) {
      if (p.pinIds.length === 0) continue
      const chipId = p.pinIds[0].split(".")[0]
      if (!chipId) continue
      const key = `${chipId}-${p.orientation}`
      if (!labelGroups.has(key)) {
        labelGroups.set(key, [])
      }
      labelGroups.get(key)!.push(p)
    }

    const finalPlacements: NetLabelPlacement[] = []
    for (const [key, group] of labelGroups.entries()) {
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
      this.mergedLabelNetIdMap.set(syntheticId, originalNetIds)

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

    this.netTempLabelPlacements = finalPlacements
  }

  override _step() {
    if (!this.traces || this.traces.length === 0) {
      this.solved = true
      return
    }
    if (
      !this.netTempLabelPlacements ||
      this.netTempLabelPlacements.length === 0
    ) {
      this.solved = true
      return
    }

    const overlaps = detectTraceLabelOverlap(
      this.traces,
      this.netTempLabelPlacements,
    )

    if (overlaps.length === 0) {
      this.solved = true
      return
    }

    const unfriendlyOverlaps = overlaps.filter((o) => {
      const originalNetIds = this.mergedLabelNetIdMap.get(
        o.label.globalConnNetId,
      )
      if (originalNetIds) {
        return !originalNetIds.has(o.trace.globalConnNetId)
      }
      return o.trace.globalConnNetId !== o.label.globalConnNetId
    })

    if (unfriendlyOverlaps.length === 0) {
      this.solved = true
      return
    }

    const updatedTracesMap = new Map<string, SolvedTracePath>()
    for (const trace of this.traces) {
      updatedTracesMap.set(trace.mspPairId, trace)
    }

    const processedTraceIds = new Set<string>()

    for (const overlap of unfriendlyOverlaps) {
      if (processedTraceIds.has(overlap.trace.mspPairId)) {
        continue
      }

      const currentTraceState = updatedTracesMap.get(overlap.trace.mspPairId)!

      const newTrace = rerouteCollidingTrace(
        currentTraceState,
        overlap.label,
        this.problem,
      )

      updatedTracesMap.set(currentTraceState.mspPairId, newTrace)
      processedTraceIds.add(currentTraceState.mspPairId)
    }

    this.updatedTraces = Array.from(updatedTracesMap.values())
    this.solved = true
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.problem)

    if (!graphics.lines) graphics.lines = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []
    if (!graphics.rects) graphics.rects = []

    for (const trace of Object.values(this.updatedTraces)) {
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
      })
      graphics.points!.push({
        x: p.anchorPoint.x,
        y: p.anchorPoint.y,
        color: getColorFromString(p.globalConnNetId, 0.9),
      })
    }

    return graphics
  }
}
