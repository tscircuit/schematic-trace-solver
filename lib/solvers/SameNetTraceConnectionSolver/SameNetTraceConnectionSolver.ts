import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

const EPS = 1e-9
const DEFAULT_MAX_GAP = 0.15

type Orientation = "horizontal" | "vertical"

type Rect = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type SegmentRef = {
  mspPairId: MspConnectionPairId
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  minAlong: number
  maxAlong: number
}

type TraceMap = Record<MspConnectionPairId, SolvedTracePath>

export interface SameNetTraceConnectionSolverParams {
  inputProblem: InputProblem
  inputTraceMap: TraceMap
  maxGap?: number
  labelObstacles?: Rect[]
}

const cloneTraceMap = (traceMap: TraceMap): TraceMap =>
  Object.fromEntries(
    Object.entries(traceMap).map(([id, trace]) => [
      id,
      {
        ...trace,
        tracePath: trace.tracePath.map((point) => ({ ...point })),
      },
    ]),
  )

const getChipObstacles = (inputProblem: InputProblem): Rect[] =>
  inputProblem.chips.map((chip) => ({
    minX: chip.center.x - chip.width / 2,
    maxX: chip.center.x + chip.width / 2,
    minY: chip.center.y - chip.height / 2,
    maxY: chip.center.y + chip.height / 2,
  }))

const sameNumber = (a: number, b: number) => Math.abs(a - b) < EPS

const samePoint = (a: Point, b: Point) =>
  sameNumber(a.x, b.x) && sameNumber(a.y, b.y)

const getOrientation = (start: Point, end: Point): Orientation | null => {
  if (sameNumber(start.y, end.y) && !sameNumber(start.x, end.x)) {
    return "horizontal"
  }
  if (sameNumber(start.x, end.x) && !sameNumber(start.y, end.y)) {
    return "vertical"
  }
  return null
}

const getSegmentRef = (
  trace: SolvedTracePath,
  segmentIndex: number,
): SegmentRef | null => {
  const start = trace.tracePath[segmentIndex]
  const end = trace.tracePath[segmentIndex + 1]
  if (!start || !end) return null

  const orientation = getOrientation(start, end)
  if (!orientation) return null

  return {
    mspPairId: trace.mspPairId,
    segmentIndex,
    orientation,
    fixedCoord: orientation === "horizontal" ? start.y : start.x,
    minAlong:
      orientation === "horizontal"
        ? Math.min(start.x, end.x)
        : Math.min(start.y, end.y),
    maxAlong:
      orientation === "horizontal"
        ? Math.max(start.x, end.x)
        : Math.max(start.y, end.y),
  }
}

const collectSegmentsByNet = (traceMap: TraceMap) => {
  const segmentsByNet = new Map<string, SegmentRef[]>()

  for (const trace of Object.values(traceMap)) {
    const netId = trace.globalConnNetId
    if (!netId) continue

    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const segment = getSegmentRef(trace, i)
      if (!segment) continue
      const segments = segmentsByNet.get(netId) ?? []
      segments.push(segment)
      segmentsByNet.set(netId, segments)
    }
  }

  return segmentsByNet
}

const countSegmentPairs = (segmentsByNet: Map<string, SegmentRef[]>) => {
  let pairCount = 0

  for (const segments of segmentsByNet.values()) {
    pairCount += (segments.length * (segments.length - 1)) / 2
  }

  return pairCount
}

const getSegmentPoints = (traceMap: TraceMap, segment: SegmentRef) => {
  const trace = traceMap[segment.mspPairId]
  if (!trace) return null
  const start = trace.tracePath[segment.segmentIndex]
  const end = trace.tracePath[segment.segmentIndex + 1]
  if (!start || !end) return null
  return { trace, start, end }
}

const getCurrentSegmentRef = (traceMap: TraceMap, segment: SegmentRef) => {
  const trace = traceMap[segment.mspPairId]
  if (!trace) return null

  return getSegmentRef(trace, segment.segmentIndex)
}

const isTruePinEndpoint = (trace: SolvedTracePath, pointIndex: number) => {
  if (pointIndex !== 0 && pointIndex !== trace.tracePath.length - 1) {
    return false
  }

  const point = trace.tracePath[pointIndex]
  if (!point) return false

  return trace.pins.some((pin) => samePoint(point, pin))
}

const canShiftSegmentToSharedAxis = (
  traceMap: TraceMap,
  segment: SegmentRef,
) => {
  const trace = traceMap[segment.mspPairId]
  if (!trace) return false
  return (
    !isTruePinEndpoint(trace, segment.segmentIndex) &&
    !isTruePinEndpoint(trace, segment.segmentIndex + 1)
  )
}

const shiftSegmentToSharedAxis = (
  traceMap: TraceMap,
  segment: SegmentRef,
  fixedCoord: number,
) => {
  const trace = traceMap[segment.mspPairId]!
  const start = trace.tracePath[segment.segmentIndex]!
  const end = trace.tracePath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = fixedCoord
    end.y = fixedCoord
  } else {
    start.x = fixedCoord
    end.x = fixedCoord
  }
}

const getEndpointIndexForAlongCoord = (
  traceMap: TraceMap,
  segment: SegmentRef,
  alongCoord: number,
) => {
  const points = getSegmentPoints(traceMap, segment)
  if (!points) return null

  const getAlong = (point: Point) =>
    segment.orientation === "horizontal" ? point.x : point.y

  const startDistance = Math.abs(getAlong(points.start) - alongCoord)
  const endDistance = Math.abs(getAlong(points.end) - alongCoord)

  return startDistance <= endDistance
    ? segment.segmentIndex
    : segment.segmentIndex + 1
}

const canMovePointAlongSegment = (
  traceMap: TraceMap,
  segment: SegmentRef,
  pointIndex: number,
) => {
  const trace = traceMap[segment.mspPairId]
  if (!trace || isTruePinEndpoint(trace, pointIndex)) return false

  for (const neighborIndex of [pointIndex - 1, pointIndex + 1]) {
    const neighbor = trace.tracePath[neighborIndex]
    const point = trace.tracePath[pointIndex]
    if (!neighbor || !point) continue

    const neighborOrientation = getOrientation(point, neighbor)
    if (neighborOrientation && neighborOrientation !== segment.orientation) {
      return false
    }
  }

  return true
}

const movePointAlongSegment = (
  traceMap: TraceMap,
  segment: SegmentRef,
  pointIndex: number,
  alongCoord: number,
) => {
  const point = traceMap[segment.mspPairId]!.tracePath[pointIndex]!
  if (segment.orientation === "horizontal") {
    point.x = alongCoord
  } else {
    point.y = alongCoord
  }
}

const isManhattanPath = (path: Point[]) =>
  path.every((point, index) => {
    if (index === path.length - 1) return true
    return getOrientation(point, path[index + 1]!) !== null
  })

const getChangedSegments = (before: TraceMap, after: TraceMap) => {
  const changedSegments: Array<{
    trace: SolvedTracePath
    segmentStart: Point
    segmentEnd: Point
  }> = []

  for (const afterTrace of Object.values(after)) {
    const beforeTrace = before[afterTrace.mspPairId]
    if (!beforeTrace) continue

    for (let i = 0; i < afterTrace.tracePath.length - 1; i++) {
      const afterStart = afterTrace.tracePath[i]!
      const afterEnd = afterTrace.tracePath[i + 1]!
      const beforeStart = beforeTrace.tracePath[i]
      const beforeEnd = beforeTrace.tracePath[i + 1]
      if (
        !beforeStart ||
        !beforeEnd ||
        !samePoint(beforeStart, afterStart) ||
        !samePoint(beforeEnd, afterEnd)
      ) {
        changedSegments.push({
          trace: afterTrace,
          segmentStart: afterStart,
          segmentEnd: afterEnd,
        })
      }
    }
  }

  return changedSegments
}

const segmentTouchesForeignTrace = (
  segmentStart: Point,
  segmentEnd: Point,
  trace: SolvedTracePath,
  allTraces: SolvedTracePath[],
) =>
  allTraces.some((otherTrace) => {
    if (otherTrace.globalConnNetId === trace.globalConnNetId) return false

    for (let i = 0; i < otherTrace.tracePath.length - 1; i++) {
      const otherStart = otherTrace.tracePath[i]!
      const otherEnd = otherTrace.tracePath[i + 1]!
      if (doSegmentsIntersect(segmentStart, segmentEnd, otherStart, otherEnd)) {
        return true
      }
    }

    return false
  })

const segmentIntersectsObstacle = (
  segmentStart: Point,
  segmentEnd: Point,
  obstacle: Rect,
) =>
  segmentIntersectsRect(segmentStart, segmentEnd, {
    ...obstacle,
    chipId: "obstacle",
  })

const hasInvalidCandidateGeometry = ({
  before,
  after,
  chipObstacles,
  labelObstacles,
}: {
  before: TraceMap
  after: TraceMap
  chipObstacles: Rect[]
  labelObstacles: Rect[]
}) => {
  if (Object.values(after).some((trace) => !isManhattanPath(trace.tracePath))) {
    return true
  }

  const changedSegments = getChangedSegments(before, after)
  const afterTraces = Object.values(after)

  return changedSegments.some(({ trace, segmentStart, segmentEnd }) => {
    if (
      chipObstacles.some((obstacle) =>
        segmentIntersectsObstacle(segmentStart, segmentEnd, obstacle),
      )
    ) {
      return true
    }

    if (
      labelObstacles.some((obstacle) =>
        segmentIntersectsObstacle(segmentStart, segmentEnd, obstacle),
      )
    ) {
      return true
    }

    return segmentTouchesForeignTrace(
      segmentStart,
      segmentEnd,
      trace,
      afterTraces,
    )
  })
}

const getAxisTarget = ({
  traceMap,
  firstSegment,
  secondSegment,
}: {
  traceMap: TraceMap
  firstSegment: SegmentRef
  secondSegment: SegmentRef
}) => {
  if (sameNumber(firstSegment.fixedCoord, secondSegment.fixedCoord)) {
    return firstSegment.fixedCoord
  }

  const canShiftFirst = canShiftSegmentToSharedAxis(traceMap, firstSegment)
  const canShiftSecond = canShiftSegmentToSharedAxis(traceMap, secondSegment)

  if (canShiftFirst && canShiftSecond) {
    return (firstSegment.fixedCoord + secondSegment.fixedCoord) / 2
  }

  if (canShiftFirst) return secondSegment.fixedCoord
  if (canShiftSecond) return firstSegment.fixedCoord

  return null
}

const getOrderedSegments = (
  firstSegment: SegmentRef,
  secondSegment: SegmentRef,
) =>
  firstSegment.minAlong <= secondSegment.minAlong
    ? [firstSegment, secondSegment]
    : [secondSegment, firstSegment]

const tryConnectSegmentPair = ({
  traceMap,
  firstSegment,
  secondSegment,
  maxGap,
  labelObstacles,
  chipObstacles,
}: {
  traceMap: TraceMap
  firstSegment: SegmentRef
  secondSegment: SegmentRef
  maxGap: number
  labelObstacles: Rect[]
  chipObstacles: Rect[]
}): TraceMap | null => {
  if (firstSegment.orientation !== secondSegment.orientation) return null

  const axisDistance = Math.abs(
    firstSegment.fixedCoord - secondSegment.fixedCoord,
  )
  if (axisDistance > maxGap) return null

  const axisTarget = getAxisTarget({ traceMap, firstSegment, secondSegment })
  if (axisTarget === null) return null

  const candidateTraceMap = cloneTraceMap(traceMap)
  let changed = false
  if (!sameNumber(firstSegment.fixedCoord, axisTarget)) {
    shiftSegmentToSharedAxis(candidateTraceMap, firstSegment, axisTarget)
    changed = true
  }
  if (!sameNumber(secondSegment.fixedCoord, axisTarget)) {
    shiftSegmentToSharedAxis(candidateTraceMap, secondSegment, axisTarget)
    changed = true
  }

  const nextFirstSegment = getSegmentRef(
    candidateTraceMap[firstSegment.mspPairId]!,
    firstSegment.segmentIndex,
  )
  const nextSecondSegment = getSegmentRef(
    candidateTraceMap[secondSegment.mspPairId]!,
    secondSegment.segmentIndex,
  )
  if (!nextFirstSegment || !nextSecondSegment) return null

  const [leftSegment, rightSegment] = getOrderedSegments(
    nextFirstSegment,
    nextSecondSegment,
  )
  const gap = rightSegment.minAlong - leftSegment.maxAlong
  if (gap > maxGap) return null

  if (gap > EPS) {
    const leftEndpointIndex = getEndpointIndexForAlongCoord(
      candidateTraceMap,
      leftSegment,
      leftSegment.maxAlong,
    )
    const rightEndpointIndex = getEndpointIndexForAlongCoord(
      candidateTraceMap,
      rightSegment,
      rightSegment.minAlong,
    )

    if (leftEndpointIndex === null || rightEndpointIndex === null) return null

    const canMoveLeft = canMovePointAlongSegment(
      candidateTraceMap,
      leftSegment,
      leftEndpointIndex,
    )
    const canMoveRight = canMovePointAlongSegment(
      candidateTraceMap,
      rightSegment,
      rightEndpointIndex,
    )

    if (!canMoveLeft && !canMoveRight) return null

    const connectionCoord =
      canMoveLeft && canMoveRight
        ? (leftSegment.maxAlong + rightSegment.minAlong) / 2
        : canMoveLeft
          ? rightSegment.minAlong
          : leftSegment.maxAlong

    if (canMoveLeft) {
      movePointAlongSegment(
        candidateTraceMap,
        leftSegment,
        leftEndpointIndex,
        connectionCoord,
      )
      changed = true
    }
    if (canMoveRight) {
      movePointAlongSegment(
        candidateTraceMap,
        rightSegment,
        rightEndpointIndex,
        connectionCoord,
      )
      changed = true
    }
  }

  if (!changed) return null

  if (
    hasInvalidCandidateGeometry({
      before: traceMap,
      after: candidateTraceMap,
      chipObstacles,
      labelObstacles,
    })
  ) {
    return null
  }

  return candidateTraceMap
}

export const connectCloseSameNetTraces = ({
  inputProblem,
  inputTraceMap,
  maxGap = DEFAULT_MAX_GAP,
  labelObstacles = [],
}: SameNetTraceConnectionSolverParams): TraceMap => {
  let outputTraceMap = cloneTraceMap(inputTraceMap)
  const chipObstacles = getChipObstacles(inputProblem)
  const maxPasses = Math.max(
    1,
    countSegmentPairs(collectSegmentsByNet(outputTraceMap)),
  )

  for (let passCount = 0; passCount < maxPasses; passCount++) {
    let changedInPass = false

    const segmentsByNet = collectSegmentsByNet(outputTraceMap)

    for (const segments of segmentsByNet.values()) {
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          const firstSegment = getCurrentSegmentRef(
            outputTraceMap,
            segments[i]!,
          )
          const secondSegment = getCurrentSegmentRef(
            outputTraceMap,
            segments[j]!,
          )
          if (!firstSegment || !secondSegment) continue

          const nextTraceMap = tryConnectSegmentPair({
            traceMap: outputTraceMap,
            firstSegment,
            secondSegment,
            maxGap,
            labelObstacles,
            chipObstacles,
          })

          if (nextTraceMap) {
            outputTraceMap = nextTraceMap
            changedInPass = true
          }
        }
      }
    }

    if (!changedInPass) break
  }

  return outputTraceMap
}

export class SameNetTraceConnectionSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: TraceMap
  outputTraceMap: TraceMap
  maxGap: number
  labelObstacles: Rect[]

  constructor(params: SameNetTraceConnectionSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.outputTraceMap = cloneTraceMap(params.inputTraceMap)
    this.maxGap = params.maxGap ?? DEFAULT_MAX_GAP
    this.labelObstacles = params.labelObstacles ?? []
  }

  override _step() {
    this.outputTraceMap = connectCloseSameNetTraces({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      maxGap: this.maxGap,
      labelObstacles: this.labelObstacles,
    })
    this.solved = true
  }

  getOutput() {
    return {
      traceMap: this.outputTraceMap,
      traces: Object.values(this.outputTraceMap),
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of Object.values(this.outputTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
      })
    }

    return graphics
  }
}
