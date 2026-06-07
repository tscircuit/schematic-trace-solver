---
// FILE: lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2.ts
import { getBounds, type GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { calculateElbow } from "calculate-elbow"
import { getPinDirection } from "../SchematicTraceSingleLineSolver/getPinDirection"
import { getObstacleRects, type ChipWithBounds } from "./rect"
import { findFirstCollision, isHorizontal, isVertical } from "./collisions"
import {
  aabbFromPoints,
  candidateMidsFromSet,
  midBetweenPointAndRect,
  type Axis,
} from "./mid"
import { pathKey, shiftSegmentOrth } from "./pathOps"

type PathKey = string

export class SchematicTraceSingleLineSolver2 extends BaseSolver {
  pins: MspConnectionPair["pins"]
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>

  obstacles: ChipWithBounds[]
  rectById: Map<string, ChipWithBounds>
  aabb: { minX: number; maxX: number; minY: number; maxY: number }

  // Handle the merge logic
  merge_same_net_trace_lines = (lines: MspConnectionPair[]): MspConnectionPair