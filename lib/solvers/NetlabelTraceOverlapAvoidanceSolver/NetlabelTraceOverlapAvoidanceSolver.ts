import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { GraphicsObject } from "graphics-debug"
import { generateElbowVariants } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/generateElbowVariants"
import { rectIntersectsAnyTrace } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { SingleNetLabelPlacementSolver } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"
import type { Point } from "@tscircuit/math-utils"

export interface NetlabelTraceOverlapAvoidanceSolverInput {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  failedNetlabelPlacements: Array<{
    globalConnNetId: string
    netId?: string
    overlappingTraces?: SolvedTracePath
    mspConnectionPairIds?: MspConnectionPairId[]
    portOnlyPinId?: string
    lastFailedAttempt?: NetLabelPlacement
  }>
}

/**
 * This solver attempts to create space for netlabels that couldn't be placed
 * by the NetLabelPlacementSolver due to trace collisions. It does this by:
 * 
 * 1. Identifying traces near where a netlabel should be placed
 * 2. Using generateElbowVariants to create alternative routing for those traces  
 * 3. Selecting the most aesthetic variant that minimizes netlabel-trace collisions
 * 4. Re-attempting netlabel placement with the modified traces
 */
export class NetlabelTraceOverlapAvoidanceSolver extends BaseSolver {
  inputProblem: InputProblem
  originalTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  failedNetlabelPlacements: NetlabelTraceOverlapAvoidanceSolverInput["failedNetlabelPlacements"]
  
  modifiedTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  successfullyPlacedNetlabels: NetLabelPlacement[] = []
  
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  
  currentFailedPlacementIndex = 0

  constructor(params: NetlabelTraceOverlapAvoidanceSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    this.originalTraceMap = params.inputTraceMap
    this.failedNetlabelPlacements = params.failedNetlabelPlacements
    
    // Start with original traces
    this.modifiedTraceMap = { ...params.inputTraceMap }
    
    this.chipObstacleSpatialIndex = 
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
  }

  override _step() {
    if (this.currentFailedPlacementIndex >= this.failedNetlabelPlacements.length) {
      this.solved = true
      return
    }

    const failedPlacement = this.failedNetlabelPlacements[this.currentFailedPlacementIndex]!
    
    if (!failedPlacement.overlappingTraces) {
      // Skip port-only placements for now (could be enhanced later)
      this.currentFailedPlacementIndex++
      return
    }

    const success = this.attemptToCreateSpaceForNetlabel(failedPlacement)
    
    if (success) {
      // Move to next failed placement
      this.currentFailedPlacementIndex++
    } else {
      // Try next variant or move on
      this.currentFailedPlacementIndex++
    }
  }

  private attemptToCreateSpaceForNetlabel(failedPlacement: NetlabelTraceOverlapAvoidanceSolverInput["failedNetlabelPlacements"][0]): boolean {
    if (!failedPlacement.overlappingTraces || !failedPlacement.netId) {
      return false
    }

    const hostTrace = failedPlacement.overlappingTraces
    const hostTracePath = hostTrace.tracePath

    // Get guidelines (empty for now, could be enhanced)
    const guidelines: any[] = []

    // Generate elbow variants for the host trace
    const { elbowVariants } = generateElbowVariants({
      baseElbow: hostTracePath,
      guidelines,
      maxVariants: 50 // Keep reasonable number of variants
    })

    let bestVariant: Point[] | null = null
    let bestPlacement: NetLabelPlacement | null = null
    let bestScore = -Infinity

    // Test each variant
    for (const variant of elbowVariants) {
      // Create a modified trace map with this variant
      const testTraceMap = {
        ...this.modifiedTraceMap,
        [hostTrace.mspPairId]: {
          ...hostTrace,
          tracePath: variant
        }
      }

      // Try to place the netlabel with this modified trace
      const placement = this.tryPlaceNetlabelWithModifiedTraces(
        failedPlacement,
        testTraceMap
      )

      if (placement) {
        // Score the placement based on aesthetics 
        const score = this.scoreTraceVariant(variant, hostTracePath, placement)
        
        if (score > bestScore) {
          bestScore = score
          bestVariant = variant
          bestPlacement = placement
        }
      }
    }

    if (bestVariant && bestPlacement) {
      // Apply the best variant
      this.modifiedTraceMap[hostTrace.mspPairId] = {
        ...hostTrace,
        tracePath: bestVariant
      }
      
      this.successfullyPlacedNetlabels.push(bestPlacement)
      return true
    }

    return false
  }

  private tryPlaceNetlabelWithModifiedTraces(
    failedPlacement: NetlabelTraceOverlapAvoidanceSolverInput["failedNetlabelPlacements"][0],
    testTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  ): NetLabelPlacement | null {
    if (!failedPlacement.overlappingTraces) return null

    // Create a group similar to what NetLabelPlacementSolver uses
    const group = {
      globalConnNetId: failedPlacement.globalConnNetId,
      netId: failedPlacement.netId,
      overlappingTraces: testTraceMap[failedPlacement.overlappingTraces.mspPairId],
      mspConnectionPairIds: failedPlacement.mspConnectionPairIds ?? []
    }

    if (!group.overlappingTraces) return null

    // Use SingleNetLabelPlacementSolver to try placement
    const solver = new SingleNetLabelPlacementSolver({
      inputProblem: this.inputProblem,
      inputTraceMap: testTraceMap,
      overlappingSameNetTraceGroup: group,
      availableOrientations: ["x+", "x-", "y+", "y-"]
    })

    // Run the solver to completion
    while (!solver.solved && !solver.failed) {
      solver.step()
    }

    return solver.solved ? solver.netLabelPlacement : null
  }

  /**
   * Score a trace variant based on aesthetics and placement quality
   * Higher scores are better
   */
  private scoreTraceVariant(
    variant: Point[], 
    original: Point[], 
    placement: NetLabelPlacement
  ): number {
    let score = 0

    // Prefer variants that require minimal changes from original
    const originalLength = this.calculatePathLength(original)
    const variantLength = this.calculatePathLength(variant)
    const lengthDiff = Math.abs(variantLength - originalLength)
    score -= lengthDiff * 0.1 // Penalty for length changes

    // Prefer variants with fewer turns
    const originalTurns = this.countTurns(original)
    const variantTurns = this.countTurns(variant)
    score -= Math.max(0, variantTurns - originalTurns) * 2 // Penalty for additional turns

    // Bonus for successfully placing the netlabel
    score += 100

    // Prefer central placement on trace
    const placementDistance = this.getDistanceFromTraceCenter(variant, placement.anchorPoint)
    score -= placementDistance * 0.5

    return score
  }

  private calculatePathLength(path: Point[]): number {
    let length = 0
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1]!.x - path[i]!.x
      const dy = path[i + 1]!.y - path[i]!.y
      length += Math.sqrt(dx * dx + dy * dy)
    }
    return length
  }

  private countTurns(path: Point[]): number {
    if (path.length < 3) return 0
    
    let turns = 0
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1]!
      const curr = path[i]!
      const next = path[i + 1]!
      
      const dir1 = { x: curr.x - prev.x, y: curr.y - prev.y }
      const dir2 = { x: next.x - curr.x, y: next.y - curr.y }
      
      // Normalize directions to check for turns
      const dot = dir1.x * dir2.x + dir1.y * dir2.y
      const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y)
      const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y)
      
      if (len1 > 1e-6 && len2 > 1e-6) {
        const cosAngle = dot / (len1 * len2)
        if (Math.abs(cosAngle) < 0.999) { // Not parallel
          turns++
        }
      }
    }
    return turns
  }

  private getDistanceFromTraceCenter(path: Point[], point: Point): number {
    // Find the center of the trace path
    const totalLength = this.calculatePathLength(path)
    const targetLength = totalLength / 2
    
    let currentLength = 0
    for (let i = 0; i < path.length - 1; i++) {
      const segmentStart = path[i]!
      const segmentEnd = path[i + 1]!
      const segmentLength = Math.sqrt(
        (segmentEnd.x - segmentStart.x) ** 2 + (segmentEnd.y - segmentStart.y) ** 2
      )
      
      if (currentLength + segmentLength >= targetLength) {
        // The center is on this segment
        const ratio = (targetLength - currentLength) / segmentLength
        const centerPoint = {
          x: segmentStart.x + ratio * (segmentEnd.x - segmentStart.x),
          y: segmentStart.y + ratio * (segmentEnd.y - segmentStart.y)
        }
        
        return Math.sqrt(
          (point.x - centerPoint.x) ** 2 + (point.y - centerPoint.y) ** 2
        )
      }
      currentLength += segmentLength
    }
    
    // Fallback to distance from last point
    const lastPoint = path[path.length - 1]!
    return Math.sqrt((point.x - lastPoint.x) ** 2 + (point.y - lastPoint.y) ** 2)
  }

  getOutput() {
    return {
      modifiedTraceMap: this.modifiedTraceMap,
      successfullyPlacedNetlabels: this.successfullyPlacedNetlabels
    }
  }

  override visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: []
    }

    // Visualize modified traces in a different color
    for (const [mspPairId, trace] of Object.entries(this.modifiedTraceMap)) {
      const originalTrace = this.originalTraceMap[mspPairId]
      if (!originalTrace || JSON.stringify(trace.tracePath) === JSON.stringify(originalTrace.tracePath)) {
        continue // Skip unchanged traces
      }

      // Draw modified trace in red
      const path = trace.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        graphics.lines!.push({
          points: [
            { x: path[i]!.x, y: path[i]!.y },
            { x: path[i + 1]!.x, y: path[i + 1]!.y }
          ],
          strokeColor: "red",
          strokeWidth: 0.1
        })
      }
    }

    // Visualize successfully placed netlabels
    for (const placement of this.successfullyPlacedNetlabels) {
      const bounds = getRectBounds(placement.center, placement.width, placement.height)
      graphics.rects!.push({
        center: placement.center,
        width: placement.width,
        height: placement.height,
        fill: "rgba(0, 255, 0, 0.3)"
      })
      
      graphics.points!.push({
        x: placement.center.x,
        y: placement.center.y,
        label: placement.netId || placement.globalConnNetId,
        color: "green"
      })
    }

    return graphics
  }
}