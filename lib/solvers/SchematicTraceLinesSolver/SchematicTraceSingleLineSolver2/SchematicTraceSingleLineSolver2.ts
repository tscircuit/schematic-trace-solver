import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"
import { calculateElbow } from "calculate-elbow"
import { getPinDirection } from "../SchematicTraceSingleLineSolver/getPinDirection"
import { getObstacleRects, type Rect } from "./rect"
import { findFirstCollision, isHorizontal, isVertical } from "./collisions"
import {
  aabbFromPoints,
  candidateMidsFromSet,
  midBetweenPointAndRect,
  type Axis,
} from "./mid"
import { pathKey, shiftSegmentOrth } from "./pathOps"

type ChipPin = {
  pinId: PinId
  x: number
  y: number
  chipId: string
  _facingDirection?: "x+" | "x-" | "y+" | "y-"
}

export class SchematicTraceSingleLineSolver2 extends BaseSolver {
  pins: MspConnectionPair["pins"]
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>

  obstacles: Rect[]
  rectById: Map<string, Rect>
  aabb: { minX: number; maxX: number; minY: number; maxY: number }

  baseElbow: Point[]

  solvedTracePath: Point[] | null = null

  private queue: Array<{ path: Point[]; collisionRectIds: Set<string> }> = []
  private visited: Set<string> = new Set()

  constructor(params: {
    pins: MspConnectionPair["pins"]
    inputProblem: InputProblem
    chipMap: Record<string, InputChip>
  }) {
    super()
    this.pins = params.pins
    this.inputProblem = params.inputProblem
    this.chipMap = params.chipMap

    // Ensure facing directions are present
    for (const pin of this.pins) {
      if (!pin._facingDirection) {
        const chip = this.chipMap[pin.chipId]
        pin._facingDirection = getPinDirection(pin, chip)
      }
    }

    // Build obstacle rects from chips
    this.obstacles = getObstacleRects(this.inputProblem)
    this.rectById = new Map(this.obstacles.map((r) => [r.id, r]))

    // Build initial elbow path
    const [pin1, pin2] = this.pins
    this.baseElbow = calculateElbow(
      {
        x: pin1.x,
        y: pin1.y,
        facingDirection: pin1._facingDirection!,
      },
      {
        x: pin2.x,
        y: pin2.y,
        facingDirection: pin2._facingDirection!,
      },
      { overshoot: 0.2 },
    )

    // Bounds defined by PA and PB
    this.aabb = aabbFromPoints(
      { x: pin1.x, y: pin1.y },
      { x: pin2.x, y: pin2.y },
    )

    // Seed search
    this.queue.push({ path: this.baseElbow, collisionRectIds: new Set() })
    this.visited.add(pathKey(this.baseElbow))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTraceSingleLineSolver2
  >[0] {
    return {
      chipMap: this.chipMap,
      pins: this.pins,
      inputProblem: this.inputProblem,
    }
  }

  private excludeRectIdsForSegment =
    (pts: Point[]) =>
    (segIndex: number): Set<string> => {
      const set = new Set<string>()
      const firstSeg = segIndex === 0
      const lastSeg = segIndex === pts.length - 2
      if (firstSeg) set.add(this.pins[0].chipId)
      if (lastSeg) set.add(this.pins[1].chipId)
      return set
    }

  private axisOfSegment(a: Point, b: Point): Axis | null {
    if (isVertical(a, b)) return "x"
    if (isHorizontal(a, b)) return "y"
    return null
  }

  override _step() {
    if (this.solvedTracePath) {
      this.solved = true
      return
    }

    const state = this.queue.shift()
    if (!state) {
      this.failed = true
      this.error = "No collision-free path found"
      return
    }

    const { path, collisionRectIds } = state

    const collision = findFirstCollision(path, this.obstacles, {
      excludeRectIdsForSegment: this.excludeRectIdsForSegment(path),
    })

    if (!collision) {
      this.solvedTracePath = path
      this.solved = true
      return
    }

    let { segIndex, rect } = collision
    
    // Never move the first or last segments - move adjacent segment instead
    const isFirstSegment = segIndex === 0
    const isLastSegment = segIndex === path.length - 2
    
    if (isFirstSegment) {
      // If first segment collides, move the second segment instead
      if (path.length < 3) {
        // Path too short to have an adjacent segment to move
        return
      }
      segIndex = 1
    } else if (isLastSegment) {
      // If last segment collides, move the second-to-last segment instead
      if (path.length < 3) {
        // Path too short to have an adjacent segment to move
        return
      }
      segIndex = path.length - 3
    }
    
    const a = path[segIndex]!
    const b = path[segIndex + 1]!
    const axis = this.axisOfSegment(a, b)
    if (!axis) {
      // Should not happen for elbow paths
      return
    }

    const [PA, PB] = this.pins
    const candidates: number[] = []

    if (collisionRectIds.size === 0) {
      // First collision on this search branch: use mid(PA, C) and mid(PB, C)
      const m1 = midBetweenPointAndRect(axis, { x: PA.x, y: PA.y }, rect)
      const m2 = midBetweenPointAndRect(axis, { x: PB.x, y: PB.y }, rect)
      
      // Combine and deduplicate candidates
      const allCandidates = [...m1, ...m2]
      const uniqueCandidates = [...new Set(allCandidates)]
      candidates.push(...uniqueCandidates)
    } else {
      // Subsequent collisions: mid between C and nearest rect/bounds from the set
      const mids = candidateMidsFromSet(
        axis,
        rect,
        this.rectById,
        collisionRectIds,
        this.aabb,
      )
      candidates.push(...mids)
    }

    // Generate new shifted paths
    for (const coord of candidates) {
      const newPath = shiftSegmentOrth(path, segIndex, axis, coord)
      if (!newPath) continue
      const key = pathKey(newPath)
      if (this.visited.has(key)) continue
      this.visited.add(key)
      const nextSet = new Set(collisionRectIds)
      nextSet.add(rect.id)
      this.queue.push({ path: newPath, collisionRectIds: nextSet })
    }
  }

  override visualize(): GraphicsObject {
    const g = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    // Draw all the new candidates
    for (const { path, collisionRectIds } of this.queue) {
      g.lines!.push({ points: path, strokeColor: "teal", strokeDash: "2 2" })
    }

    if (this.solvedTracePath) {
      g.lines!.push({ points: this.solvedTracePath, strokeColor: "green" })
    } else if (this.queue.length > 0) {
      // Show next candidate to be explored
      g.lines!.push({ points: this.queue[0]!.path, strokeColor: "orange" })
    }

    return g
  }
}
