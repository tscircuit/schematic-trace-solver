import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacementSolver } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { TraceOverlapShiftSolver } from "../TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import type {
  SchematicTraceLinesSolver,
  SolvedTracePath,
} from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { generateElbowVariants } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/generateElbowVariants"
import { NetLabelPlacementSolver as InternalNetLabelPlacementSolver } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { rectIntersectsAnyTrace } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { Guideline } from "../GuidelinesSolver/GuidelinesSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

export class NetLabelTraceOverlapSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  activeNetLabelPlacementSolver: InternalNetLabelPlacementSolver
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap

    this.correctedTraceMap = structuredClone(this.inputTraceMap)

    this.chipObstacleSpatialIndex = new ChipObstacleSpatialIndex(
      this.inputProblem.chips,
    )

    this.activeNetLabelPlacementSolver = new InternalNetLabelPlacementSolver({
      inputProblem: this.inputProblem,
      inputTraceMap: this.correctedTraceMap,
    })
  }

  override _step() {
    if (this.activeNetLabelPlacementSolver.solved) {
      this.solved = true
      return
    }

    if (!this.activeNetLabelPlacementSolver.failed) {
      this.activeNetLabelPlacementSolver.step()
      return
    }

    const failedSubSolver = this.activeNetLabelPlacementSolver.activeSubSolver
    if (!failedSubSolver) {
      this.failed = true
      this.error = "NetLabelPlacementSolver failed without a sub-solver."
      return
    }

    const collisionCandidate = failedSubSolver.testedCandidates.find(
      (c) =>
        c.status === "trace-collision" &&
        c.collidingMspPairId &&
        c.collidingSegmentIndex !== undefined,
    )

    if (!collisionCandidate) {
      this.failed = true
      this.error =
        this.activeNetLabelPlacementSolver.error ??
        "NetLabelPlacementSolver failed for a reason other than trace collision."
      return
    }

    const {
      collidingMspPairId,
      collidingSegmentIndex,
      bounds: labelBounds,
    } = collisionCandidate
    if (!collidingMspPairId || collidingSegmentIndex === undefined) {
      this.failed = true
      this.error = "Collision candidate missing information."
      return
    }

    const collidingTrace = this.correctedTraceMap[collidingMspPairId]
    if (!collidingTrace) {
      this.failed = true
      this.error = `Could not find colliding trace with mspPairId: ${collidingMspPairId}`
      return
    }

    const margin = 0.1
    const guidelines: Guideline[] = [
      { orientation: "vertical", x: labelBounds.minX - margin, y: undefined },
      { orientation: "vertical", x: labelBounds.maxX + margin, y: undefined },
      { orientation: "horizontal", y: labelBounds.minY - margin, x: undefined },
      { orientation: "horizontal", y: labelBounds.maxY + margin, x: undefined },
    ]

    const { elbowVariants } = generateElbowVariants({
      baseElbow: collidingTrace.tracePath,
      guidelines,
    })

    for (const variant of elbowVariants) {
      const newTracePath = variant
      let collision = false

      // Check for collision with the label
      for (let i = 0; i < newTracePath.length - 1; i++) {
        if (
          rectIntersectsAnyTrace(labelBounds, {
            [collidingMspPairId]: {
              ...collidingTrace,
              tracePath: newTracePath,
            },
          }).hasIntersection
        ) {
          collision = true
          break
        }
      }
      if (collision) continue

      // Check for new collisions with other traces
      const variantBounds = getRectBounds(newTracePath[0], 0, 0)
      for (const point of newTracePath) {
        variantBounds.minX = Math.min(variantBounds.minX, point.x)
        variantBounds.maxX = Math.max(variantBounds.maxX, point.x)
        variantBounds.minY = Math.min(variantBounds.minY, point.y)
        variantBounds.maxY = Math.max(variantBounds.maxY, point.y)
      }

      if (
        rectIntersectsAnyTrace(variantBounds, this.correctedTraceMap, collidingMspPairId)
          .hasIntersection
      ) {
        continue
      }

      // Check for new collisions with chips
      if (this.chipObstacleSpatialIndex.getChipsInBounds(variantBounds).length > 0) {
        continue
      }

      // If we get here, we found a good variant
      this.correctedTraceMap[collidingMspPairId] = {
        ...collidingTrace,
        tracePath: newTracePath,
      }

      // Restart the net label placement solver with the corrected traces
      this.activeNetLabelPlacementSolver = new InternalNetLabelPlacementSolver({
        inputProblem: this.inputProblem,
        inputTraceMap: this.correctedTraceMap,
      })
      return
    }

    // If no variant worked, we fail
    this.failed = true
    this.error = `Could not find a variant to resolve netlabel trace overlap for ${collidingMspPairId}`
  }

  // Forward visualization to the active sub-solver
  override visualize() {
    return this.activeNetLabelPlacementSolver.visualize()
  }

  // Also forward the net label placements
  get netLabelPlacements() {
    return this.activeNetLabelPlacementSolver.netLabelPlacements
  }
}