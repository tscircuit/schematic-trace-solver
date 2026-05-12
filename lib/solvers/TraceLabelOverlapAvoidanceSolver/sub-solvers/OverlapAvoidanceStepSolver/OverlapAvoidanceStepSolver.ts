import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { detectTraceLabelOverlap } from "../../detectTraceLabelOverlap"
import { SingleOverlapSolver } from "../SingleOverlapSolver/SingleOverlapSolver"
import { doesTraceStartOrEndInLabel } from "./doesTraceStartOrEndInLabel"
import { visualizeDecomposition } from "./visualizeDecomposition"

type Overlap = ReturnType<typeof detectTraceLabelOverlap>[0]

// Define a type for the input of the internal overlap solver to avoid conflicts
export interface OverlapCollectionSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  initialNetLabelPlacements: NetLabelPlacement[]
  mergedNetLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  detourCounts: Map<string, number>
}

/**
 * This is an internal solver that manages the step-by-step process of avoiding
 * multiple overlaps. It follows the pattern of SchematicTraceLinesSolver.
 */
export class OverlapAvoidanceStepSolver extends BaseSolver {
  inputProblem: InputProblem
  initialNetLabelPlacements: NetLabelPlacement[]
  mergedNetLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>

  allTraces: SolvedTracePath[]
  modifiedTraces: SolvedTracePath[] = []

  private readonly PADDING_BUFFER = 0.1
  private detourCounts: Map<string, number> = new Map()

  public override activeSubSolver: SingleOverlapSolver | null = null
  private overlapQueue: Overlap[] = []
  private recentlyFailed: Set<string> = new Set()

  private currentlyProcessingOverlap: Overlap | null = null
  private decomposedChildLabels: NetLabelPlacement[] | null = null

  constructor(solverInput: OverlapCollectionSolverInput) {
    super()
    this.inputProblem = solverInput.inputProblem
    this.initialNetLabelPlacements = solverInput.initialNetLabelPlacements
    this.mergedNetLabelPlacements = solverInput.mergedNetLabelPlacements
    this.mergedLabelNetIdMap = solverInput.mergedLabelNetIdMap
    this.allTraces = [...solverInput.traces]
    this.detourCounts = solverInput.detourCounts
  }

  override _step() {
    this.currentlyProcessingOverlap = null
    this.decomposedChildLabels = null
    if (this.activeSubSolver) {
      this.activeSubSolver.step()

      if (this.activeSubSolver.solved) {
        const solvedPath = this.activeSubSolver.solvedTracePath
        if (solvedPath) {
          const traceIndex = this.allTraces.findIndex(
            (t) => t.mspPairId === this.activeSubSolver!.initialTrace.mspPairId,
          )
          if (traceIndex !== -1) {
            this.allTraces[traceIndex].tracePath = solvedPath
            this.modifiedTraces.push(this.allTraces[traceIndex])
          }
        }
        this.activeSubSolver = null
        this.recentlyFailed.clear()
      } else if (this.activeSubSolver.failed) {
        const overlapId = `${this.activeSubSolver.initialTrace.mspPairId}-${this.activeSubSolver.label.globalConnNetId}`
        this.recentlyFailed.add(overlapId)
        this.activeSubSolver = null
      } else {
      }
      return
    }

    const overlaps = detectTraceLabelOverlap({
      traces: this.allTraces,
      netLabels: this.mergedNetLabelPlacements,
    })

    if (overlaps.length === 0) {
      this.solved = true
      return
    }

    // Filter out overlaps that have recently failed to avoid infinite loops
    const nonFailedOverlaps = overlaps.filter((o) => {
      const overlapId = `${o.trace.mspPairId}-${o.label.globalConnNetId}`
      return !this.recentlyFailed.has(overlapId)
    })

    if (nonFailedOverlaps.length === 0) {
      this.solved = true // No more progress can be made
      return
    }

    this.overlapQueue = nonFailedOverlaps

    const nextOverlap = this.overlapQueue.shift()
    this.currentlyProcessingOverlap = nextOverlap ?? null

    if (nextOverlap) {
      const traceToFix = this.allTraces.find(
        (t) => t.mspPairId === nextOverlap.trace.mspPairId,
      )!
      const labelToAvoid = nextOverlap.label

      const originalNetIds =
        this.mergedLabelNetIdMap[labelToAvoid.globalConnNetId]
      const isSelfOverlap = originalNetIds?.has(traceToFix.globalConnNetId)

      if (isSelfOverlap) {
        const childLabels = this.initialNetLabelPlacements.filter((l) =>
          originalNetIds.has(l.globalConnNetId),
        )
        this.decomposedChildLabels = childLabels
        let actualOverlapLabel: NetLabelPlacement | null = null

        for (const childLabel of childLabels) {
          const overlapsWithChild = detectTraceLabelOverlap({
            traces: [traceToFix],
            netLabels: [childLabel],
          })
          if (overlapsWithChild.length > 0) {
            actualOverlapLabel = childLabel
            break
          }
        }

        if (actualOverlapLabel) {
          const detourCount =
            this.detourCounts.get(actualOverlapLabel.globalConnNetId) ?? 0
          this.detourCounts.set(
            actualOverlapLabel.globalConnNetId,
            detourCount + 1,
          )

          this.activeSubSolver = new SingleOverlapSolver({
            trace: traceToFix,
            label: actualOverlapLabel,
            problem: this.inputProblem,
            paddingBuffer: this.PADDING_BUFFER,
            detourCount: detourCount,
          })
        } else {
          const overlapId = `${traceToFix.mspPairId}-${labelToAvoid.globalConnNetId}`
          this.recentlyFailed.add(overlapId)
        }
        return
      }

      if (
        originalNetIds &&
        doesTraceStartOrEndInLabel({ trace: traceToFix, label: labelToAvoid })
      ) {
        const childLabels = this.initialNetLabelPlacements.filter((l) =>
          originalNetIds.has(l.globalConnNetId),
        )
        this.decomposedChildLabels = childLabels
        let actualOverlapLabel: NetLabelPlacement | null = null

        for (const childLabel of childLabels) {
          const overlapsWithChild = detectTraceLabelOverlap({
            traces: [traceToFix],
            netLabels: [childLabel],
          })
          if (overlapsWithChild.length > 0) {
            actualOverlapLabel = childLabel
            break
          }
        }

        if (actualOverlapLabel) {
          const detourCount =
            this.detourCounts.get(actualOverlapLabel.globalConnNetId) ?? 0
          this.detourCounts.set(
            actualOverlapLabel.globalConnNetId,
            detourCount + 1,
          )
          this.activeSubSolver = new SingleOverlapSolver({
            trace: traceToFix,
            label: actualOverlapLabel,
            problem: this.inputProblem,
            paddingBuffer: this.PADDING_BUFFER,
            detourCount: detourCount,
          })
        } else {
          const overlapId = `${traceToFix.mspPairId}-${labelToAvoid.globalConnNetId}`
          this.recentlyFailed.add(overlapId)
        }
        return
      }

      // STRATEGY 3: Real collision between different nets.
      // We must reroute around the entire merged label.
      const detourCount =
        this.detourCounts.get(labelToAvoid.globalConnNetId) ?? 0
      this.detourCounts.set(labelToAvoid.globalConnNetId, detourCount + 1)
      this.activeSubSolver = new SingleOverlapSolver({
        trace: traceToFix,
        label: labelToAvoid,
        problem: this.inputProblem,
        paddingBuffer: this.PADDING_BUFFER,
        detourCount: detourCount,
      })
    }
  }

  getOutput() {
    return {
      allTraces: this.allTraces,
      modifiedTraces: this.modifiedTraces,
      detourCounts: this.detourCounts,
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    const graphics = visualizeInputProblem(this.inputProblem)
    if (!graphics.lines) graphics.lines = []
    for (const trace of this.allTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    if (this.currentlyProcessingOverlap) {
      const { trace, label } = this.currentlyProcessingOverlap

      // Highlight the colliding trace
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "red",
      })

      if (this.decomposedChildLabels) {
        visualizeDecomposition({
          decomposedChildLabels: this.decomposedChildLabels,
          collidingTrace: trace,
          mergedLabel: label,
          graphics,
        })
      } else {
        // Standard case: highlight the entire label
        if (!graphics.rects) graphics.rects = []
        graphics.rects.push({
          center: label.center,
          width: label.width,
          height: label.height,
          fill: "yellow",
        })
        if (!graphics.texts) graphics.texts = []
        graphics.texts.push({
          x: label.center.x,
          y: label.center.y + label.height / 2 + 0.5,
          text: `COLLISION: Trace ${trace.mspPairId} vs Label ${label.globalConnNetId}`,
          fontSize: 0.3,
          color: "red",
        })
      }
    }

    return graphics
  }
}
