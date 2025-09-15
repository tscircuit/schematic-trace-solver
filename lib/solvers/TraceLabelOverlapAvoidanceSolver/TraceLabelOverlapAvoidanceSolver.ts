import { BaseSolver } from "../BaseSolver/BaseSolver"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"
import { rerouteCollidingTrace } from "./rerouteCollidingTrace"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getColorFromString } from "lib/utils/getColorFromString"
import type { InputProblem } from "lib/types/InputProblem"
import { minimizeTurnsWithFilteredLabels } from "./turnMinimization"
import { balanceLShapes } from "./zShapeBalancing"

interface TraceLabelOverlapAvoidanceSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  private problem: InputProblem
  private traces: SolvedTracePath[]
  private netTempLabelPlacements: NetLabelPlacement[]
  private netLabelPlacements: NetLabelPlacement[]
  private updatedTraces: SolvedTracePath[]
  private updatedTracesMap: Map<string, SolvedTracePath>
  private mergedLabelNetIdMap: Map<string, Set<string>>
  private detourCountByLabel: Map<string, number>
  private readonly PADDING_BUFFER = 0.1

  constructor(solverInput: TraceLabelOverlapAvoidanceSolverInput) {
    super()
    this.problem = solverInput.inputProblem
    this.traces = solverInput.traces
    this.updatedTraces = [...solverInput.traces]
    this.updatedTracesMap = new Map()
    this.mergedLabelNetIdMap = new Map()
    this.detourCountByLabel = new Map()

    const originalLabels = solverInput.netLabelPlacements
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
    if (
      !this.traces ||
      this.traces.length === 0 ||
      !this.netTempLabelPlacements ||
      this.netTempLabelPlacements.length === 0
    ) {
      this.solved = true
      return
    }

    this.detourCountByLabel.clear()

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
      const labelId = overlap.label.globalConnNetId
      const detourCount = this.detourCountByLabel.get(labelId) || 0

      const newTrace = rerouteCollidingTrace({
        trace: currentTraceState,
        label: overlap.label,
        problem: this.problem,
        paddingBuffer: this.PADDING_BUFFER,
        detourCount,
      })

      if (newTrace.tracePath !== currentTraceState.tracePath) {
        this.detourCountByLabel.set(labelId, detourCount + 1)
      }

      updatedTracesMap.set(currentTraceState.mspPairId, newTrace)
      processedTraceIds.add(currentTraceState.mspPairId)
    }

    this.updatedTraces = Array.from(updatedTracesMap.values())

    const minimizedTraces = minimizeTurnsWithFilteredLabels({
      traces: this.updatedTraces,
      problem: this.problem,
      allLabelPlacements: this.netTempLabelPlacements, // Use temp labels which include merged ones
      mergedLabelNetIdMap: this.mergedLabelNetIdMap,
      paddingBuffer: this.PADDING_BUFFER,
    })
    if (minimizedTraces) {
      this.updatedTraces = minimizedTraces
    }
    console.log(this.updatedTraces.map(e => {
      return {
        "len": e.tracePath.length,
        "PairIds": e.globalConnNetId
      }
    }));
    

    const balancedTraces = balanceLShapes({
      traces: this.updatedTraces,
      problem: this.problem,
      allLabelPlacements: this.netLabelPlacements,
    })
    if (balancedTraces) {
      this.updatedTraces = balancedTraces
    }

    this.updatedTracesMap.clear()
    for (const trace of this.updatedTraces) {
      this.updatedTracesMap.set(trace.mspPairId, trace)
    }

    this.solved = true
  }

  getOutputTraces(): SolvedTracePath[] {
    return this.updatedTraces
  }

  getOutputTraceMap(): Map<string, SolvedTracePath> {
    return this.updatedTracesMap
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
