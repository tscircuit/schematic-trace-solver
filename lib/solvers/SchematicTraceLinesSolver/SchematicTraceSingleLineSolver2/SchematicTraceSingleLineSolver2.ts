import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"
import { calculateElbow } from "calculate-elbow"
import { getPinDirection } from "../SchematicTraceSingleLineSolver/getPinDirection"
import { getObstacleRects, type ObstacleRect } from "./rect"
import { findFirstCollision, isHorizontal, isVertical } from "./collisions"
import {
  aabbFromPoints,
  candidateMidsFromSet,
  midBetweenPointAndRect,
  type Axis,
} from "./mid"
import { pathKey, shiftSegmentOrth } from "./pathOps"
import type { FacingDirection } from "lib/utils/dir"
import { getDimsForOrientation } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { RectPadding } from "lib/utils/textBoxBounds"

type PathKey = string
const SHORT_TRACE_MAX_MANHATTAN_DISTANCE = 0.15
const SHORT_TRACE_DOGLEG_OVERSHOOT =
  SHORT_TRACE_MAX_MANHATTAN_DISTANCE / 7.5

export class SchematicTraceSingleLineSolver2 extends BaseSolver {
  pins: MspConnectionPair["pins"]
  connectionPair?: MspConnectionPair
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>

  obstacles: ObstacleRect[]
  textObstacles: Set<ObstacleRect>
  endpointTextObstacles: Set<ObstacleRect>
  aabb: { minX: number; maxX: number; minY: number; maxY: number }

  baseElbow: Point[]

  solvedTracePath: Point[] | null = null

  private queue: Array<{ path: Point[]; collisionRects: Set<ObstacleRect> }> =
    []
  private visited: Set<PathKey> = new Set()

  constructor(params: {
    pins: MspConnectionPair["pins"]
    connectionPair?: MspConnectionPair
    inputProblem: InputProblem
    chipMap: Record<string, InputChip>
  }) {
    super()
    this.pins = params.pins
    this.connectionPair = params.connectionPair
    this.inputProblem = params.inputProblem
    this.chipMap = params.chipMap

    // Ensure facing directions are present
    for (const pin of this.pins) {
      if (!pin._facingDirection) {
        const chip = this.chipMap[pin.chipId]
        pin._facingDirection = getPinDirection(pin, chip)
      }
    }

    // Build obstacle rects from chips and schematic text boxes. Text boxes are
    // padded by the label footprint for this net so labels have clearance too.
    this.obstacles = getObstacleRects(this.inputProblem, {
      textBoxPadding: this.getTextBoxPaddingForConnectionPair(),
    })
    this.textObstacles = new Set(
      this.obstacles.filter((r) => r.kind === "text_box"),
    )
    const endpointChipIds = new Set(this.pins.map((pin) => pin.chipId))
    this.endpointTextObstacles = new Set(
      endpointChipIds.size > 1
        ? this.obstacles.filter(
            (r) =>
              r.kind === "text_box" &&
              r.textBox.chipId !== undefined &&
              endpointChipIds.has(r.textBox.chipId),
          )
        : [],
    )

    const [pin1, pin2] = this.pins
    const directShortPath = this.getDirectShortPath(pin1, pin2)

    // Build initial elbow path
    this.baseElbow =
      directShortPath ??
      calculateElbow(
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
    this.solvedTracePath = directShortPath

    // Bounds defined by PA and PB
    this.aabb = aabbFromPoints(
      { x: pin1.x, y: pin1.y },
      { x: pin2.x, y: pin2.y },
    )

    // Seed search
    this.queue.push({ path: this.baseElbow, collisionRects: new Set() })
    this.visited.add(pathKey(this.baseElbow))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTraceSingleLineSolver2
  >[0] {
    return {
      chipMap: this.chipMap,
      pins: this.pins,
      connectionPair: this.connectionPair,
      inputProblem: this.inputProblem,
    }
  }

  private getTextBoxPaddingForConnectionPair(): RectPadding {
    if (!this.inputProblem.textBoxes?.length) return {}

    const netId = this.connectionPair?.userNetId
    if (!netId) return {}

    const orientations =
      this.inputProblem.availableNetLabelOrientations[netId] ??
      (["x+", "x-", "y+", "y-"] as FacingDirection[])
    const netLabelWidth = this.getNetLabelWidthForConnectionPair(netId)
    const netLabelHeight = this.getNetLabelHeightForConnectionPair(netId)
    const padding: Required<RectPadding> = {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    }

    for (const orientation of orientations) {
      const { width, height } = getDimsForOrientation({
        orientation,
        netLabelWidth,
        netLabelHeight,
      })

      if (orientation === "y+" || orientation === "y-") {
        padding.minX = Math.max(padding.minX, width / 2)
        padding.maxX = Math.max(padding.maxX, width / 2)
        if (orientation === "y+") {
          padding.minY = Math.max(padding.minY, height)
        } else {
          padding.maxY = Math.max(padding.maxY, height)
        }
      } else {
        padding.minY = Math.max(padding.minY, height / 2)
        padding.maxY = Math.max(padding.maxY, height / 2)
        if (orientation === "x+") {
          padding.minX = Math.max(padding.minX, width)
        } else {
          padding.maxX = Math.max(padding.maxX, width)
        }
      }
    }

    return padding
  }

  private getNetLabelWidthForConnectionPair(netId: string) {
    const ncWidth = this.inputProblem.netConnections.find(
      (nc) => nc.netId === netId,
    )?.netLabelWidth
    if (ncWidth !== undefined) return ncWidth

    const dcWidthByNetId = this.inputProblem.directConnections.find(
      (dc) => dc.netId === netId,
    )?.netLabelWidth
    if (dcWidthByNetId !== undefined) return dcWidthByNetId

    const pinIds = this.pins.map((p) => p.pinId)
    const dcWidthByPinId = this.inputProblem.directConnections.find((dc) =>
      dc.pinIds.some((pid) => pinIds.includes(pid)),
    )?.netLabelWidth
    if (dcWidthByPinId !== undefined) return dcWidthByPinId

    return this.inputProblem.netConnections.find((nc) =>
      nc.pinIds.some((pid) => pinIds.includes(pid)),
    )?.netLabelWidth
  }

  private getNetLabelHeightForConnectionPair(netId: string) {
    const ncHeight = this.inputProblem.netConnections.find(
      (nc) => nc.netId === netId,
    )?.netLabelHeight
    if (ncHeight !== undefined) return ncHeight

    const pinIds = this.pins.map((p) => p.pinId)
    return this.inputProblem.netConnections.find((nc) =>
      nc.pinIds.some((pid) => pinIds.includes(pid)),
    )?.netLabelHeight
  }

  private getDirectShortPath(
    pin1: MspConnectionPair["pins"][number],
    pin2: MspConnectionPair["pins"][number],
  ): Point[] | null {
    const manhattanDist = Math.abs(pin1.x - pin2.x) + Math.abs(pin1.y - pin2.y)
    if (manhattanDist > SHORT_TRACE_MAX_MANHATTAN_DISTANCE) return null

    const start = { x: pin1.x, y: pin1.y }
    const end = { x: pin2.x, y: pin2.y }
    const doglegPath = this.getShortDoglegPath(start, end, pin1, pin2)
    if (doglegPath) return doglegPath

    const candidatePaths =
      pin1.x !== pin2.x && pin1.y !== pin2.y
        ? [
            [start, { x: pin2.x, y: pin1.y }, end],
            [start, { x: pin1.x, y: pin2.y }, end],
          ]
        : [[start, end]]

    for (const path of candidatePaths) {
      if (this.pathMatchesPinDirections(path, pin1, pin2)) return path
    }

    return calculateElbow(
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
      {
        overshoot: Math.min(
          0.2,
          Math.max(SHORT_TRACE_DOGLEG_OVERSHOOT, manhattanDist / 4),
        ),
      },
    )
  }

  private getShortDoglegPath(
    start: Point,
    end: Point,
    pin1: MspConnectionPair["pins"][number],
    pin2: MspConnectionPair["pins"][number],
  ): Point[] | null {
    if (pin1.x === pin2.x || pin1.y === pin2.y) return null

    const firstDir = pin1._facingDirection
    const lastDir = pin2._facingDirection
    if (!firstDir?.startsWith("y") || !lastDir?.startsWith("x")) return null

    const yOffset =
      firstDir === "y+"
        ? SHORT_TRACE_DOGLEG_OVERSHOOT
        : -SHORT_TRACE_DOGLEG_OVERSHOOT
    const doglegY = start.y + yOffset
    const doglegX = (start.x + end.x) / 2
    const path = [
      start,
      { x: start.x, y: doglegY },
      { x: doglegX, y: doglegY },
      { x: doglegX, y: end.y },
      end,
    ]

    return this.pathMatchesPinDirections(path, pin1, pin2) ? path : null
  }

  private segmentDirection(from: Point, to: Point): FacingDirection | null {
    if (to.x > from.x) return "x+"
    if (to.x < from.x) return "x-"
    if (to.y > from.y) return "y+"
    if (to.y < from.y) return "y-"
    return null
  }

  private pathMatchesPinDirections(
    path: Point[],
    pin1: MspConnectionPair["pins"][number],
    pin2: MspConnectionPair["pins"][number],
  ): boolean {
    const firstDirection = this.segmentDirection(path[0]!, path[1]!)
    const lastDirection = this.segmentDirection(
      path[path.length - 1]!,
      path[path.length - 2]!,
    )

    return (
      firstDirection === pin1._facingDirection &&
      lastDirection === pin2._facingDirection
    )
  }

  private axisOfSegment(a: Point, b: Point): Axis | null {
    if (isVertical(a, b)) return "x"
    if (isHorizontal(a, b)) return "y"
    return null
  }

  private pathLength(pts: Point[]): number {
    let sum = 0
    for (let i = 0; i < pts.length - 1; i++) {
      sum +=
        Math.abs(pts[i + 1]!.x - pts[i]!.x) +
        Math.abs(pts[i + 1]!.y - pts[i]!.y)
    }
    return sum
  }

  private getPinBandPenalty(path: Point[]): number {
    let penalty = 0
    for (let i = 1; i < path.length - 2; i++) {
      const a = path[i]!
      const b = path[i + 1]!
      if (isHorizontal(a, b) && a.y > this.aabb.minY && a.y < this.aabb.maxY) {
        penalty += 10
      } else if (
        isVertical(a, b) &&
        a.x > this.aabb.minX &&
        a.x < this.aabb.maxX
      ) {
        penalty += 10
      }
    }
    return penalty
  }

  private pathCost(path: Point[]): number {
    return this.pathLength(path) + this.getPinBandPenalty(path)
  }

  private isSegmentOutsidePinBand(a: Point, b: Point): boolean {
    if (isHorizontal(a, b)) {
      return a.y <= this.aabb.minY || a.y >= this.aabb.maxY
    }
    if (isVertical(a, b)) {
      return a.x <= this.aabb.minX || a.x >= this.aabb.maxX
    }
    return false
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

    const { path, collisionRects } = state

    const [PA, PB] = this.pins
    const collision = findFirstCollision(path, this.obstacles, {
      excludeRectsForSegment: (segIndex) => {
        const lastSegIndex = path.length - 2
        if (segIndex === 0 || segIndex === lastSegIndex) {
          return this.textObstacles
        }
        const adjacentEndpointSegIndex =
          segIndex === 1
            ? 2
            : segIndex === lastSegIndex - 1
              ? lastSegIndex - 2
              : null
        if (
          adjacentEndpointSegIndex !== null &&
          adjacentEndpointSegIndex >= 0 &&
          adjacentEndpointSegIndex < lastSegIndex &&
          this.isSegmentOutsidePinBand(
            path[adjacentEndpointSegIndex]!,
            path[adjacentEndpointSegIndex + 1]!,
          )
        ) {
          return this.endpointTextObstacles
        }
        return new Set<ObstacleRect>()
      },
    })

    if (!collision) {
      // Sanity check: ensure path still connects PA -> PB
      const first = path[0]!
      const last = path[path.length - 1]!
      const EPS = 1e-9
      const samePoint = (p: Point, q: Point) =>
        Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS
      if (
        samePoint(first, { x: PA.x, y: PA.y }) &&
        samePoint(last, { x: PB.x, y: PB.y })
      ) {
        this.solvedTracePath = path
        this.solved = true
      }
      return
    }

    const originalSegIndex = collision.segIndex
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

    // Note: PA and PB are already defined above
    const candidates: number[] = []

    if (collisionRects.size === 0) {
      // First collision on this search branch: use mid(PA, C) and mid(PB, C)
      const m1 = midBetweenPointAndRect(axis, { x: PA.x, y: PA.y }, rect)
      const m2 = midBetweenPointAndRect(axis, { x: PB.x, y: PB.y }, rect)

      // Combine and deduplicate candidates
      const allCandidates = [...m1, ...m2]
      const uniqueCandidates = [...new Set(allCandidates)]
      candidates.push(...uniqueCandidates)
    } else {
      // Subsequent collisions: mid between C and nearest rect/bounds from the set
      const mids = candidateMidsFromSet(axis, rect, collisionRects, this.aabb)
      candidates.push(...mids)
    }

    // Generate new shifted paths, order by total path length (shorter first)
    const newStates: Array<{
      path: Point[]
      collisionRects: Set<ObstacleRect>
      len: number
    }> = []

    const addShiftedCandidate = (
      candidateSegIndex: number,
      candidateAxis: Axis,
      coord: number,
    ) => {
      const newPath = shiftSegmentOrth(
        path,
        candidateSegIndex,
        candidateAxis,
        coord,
      )
      if (!newPath) return
      const key = pathKey(newPath)
      if (this.visited.has(key)) return
      this.visited.add(key)
      const nextSet = new Set(collisionRects)
      nextSet.add(rect)
      const len = this.pathCost(newPath)
      newStates.push({ path: newPath, collisionRects: nextSet, len })
    }

    for (const coord of candidates) {
      addShiftedCandidate(segIndex, axis, coord)
    }

    const lastSegIndex = path.length - 2
    const adjacentSegmentIndexes =
      originalSegIndex === 1
        ? [2]
        : originalSegIndex === lastSegIndex - 1
          ? [lastSegIndex - 2]
          : []

    for (const adjacentSegIndex of adjacentSegmentIndexes) {
      if (adjacentSegIndex < 0 || adjacentSegIndex >= lastSegIndex) continue
      const adjacentAxis = this.axisOfSegment(
        path[adjacentSegIndex]!,
        path[adjacentSegIndex + 1]!,
      )
      if (!adjacentAxis || adjacentAxis === axis) continue

      const adjacentCandidates = [
        ...midBetweenPointAndRect(adjacentAxis, { x: PA.x, y: PA.y }, rect),
        ...midBetweenPointAndRect(adjacentAxis, { x: PB.x, y: PB.y }, rect),
      ]
      if (collisionRects.size > 0) {
        adjacentCandidates.push(
          ...candidateMidsFromSet(
            adjacentAxis,
            rect,
            collisionRects,
            this.aabb,
          ),
        )
      }

      for (const coord of [...new Set(adjacentCandidates)]) {
        addShiftedCandidate(adjacentSegIndex, adjacentAxis, coord)
      }
    }

    newStates.sort((a, b) => a.len - b.len)
    for (const st of newStates) {
      this.queue.push({ path: st.path, collisionRects: st.collisionRects })
    }
  }

  override visualize(): GraphicsObject {
    const g = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    // Draw the base elbow

    g.lines!.push({
      points: this.baseElbow,
      strokeColor: "red",
      strokeDash: "4 4",
    })

    // Draw the MSP pair connection with a dashed line
    const [pin1, pin2] = this.pins
    g.lines!.push({
      points: [
        { x: pin1.x, y: pin1.y },
        { x: pin2.x, y: pin2.y },
      ],
      strokeColor: "blue",
      strokeDash: "5 5",
    })

    // Draw all the new candidates
    for (const { path } of this.queue) {
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
