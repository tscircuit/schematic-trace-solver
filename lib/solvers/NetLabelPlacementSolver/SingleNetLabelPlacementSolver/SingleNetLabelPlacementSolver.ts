import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "../NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { FacingDirection } from "lib/utils/dir"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"

export const NET_LABEL_HORIZONTAL_WIDTH = 0.4
export const NET_LABEL_HORIZONTAL_HEIGHT = 0.2
// NOTE: net labels, when in the y+/y- orientation, are rotated and therefore
// the width/height are swapped

/**
 * Find a location in the overlappingSameNetTraceGroup where a net label should
 * be placed. We do this by looking for the largest chip, and starting our
 * search from the segment directly connected to the largest chip. We then
 * travel along the segment, moving to any connected segment. Each step, we
 * check a specific segment
 *
 * When checking a segment, we check the following locations with each
 * orientation:
 * - The start of the segment
 * - The start of the segment, plus the width of the net label
 * - The end of the segment
 * - The end of the segment, minus the width of the net label
 *
 * When checking a location, we check for the following:
 * 1. Would placing a net label at this location cause a collision with a chip?
 * 2. Would placing a net label at this location cause a collision with ANY
 *    trace? (Note: you must offset the anchor point slightly from the trace to
 *    avoid counting the point where the net label contacts the trace)
 *
 * The first location that satisfies the above conditions, in our traversal
 * order from the largest chip, is the location we return in netLabelPlacement
 */
export class SingleNetLabelPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  overlappingSameNetTraceGroup: OverlappingSameNetTraceGroup
  availableOrientations: Array<FacingDirection>

  chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  netLabelPlacement: NetLabelPlacement | null = null

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
    overlappingSameNetTraceGroup: OverlappingSameNetTraceGroup
    availableOrientations: FacingDirection[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.overlappingSameNetTraceGroup = params.overlappingSameNetTraceGroup
    this.availableOrientations = params.availableOrientations

    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
  }

  override _step() {
    // TODO: Implement
  }

  override visualize(): GraphicsObject {}
}
