import type { Point } from "@tscircuit/math-utils"
import { distance, doSegmentsIntersect } from "@tscircuit/math-utils"
import { calculateElbow } from "calculate-elbow"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import {
  DEFAULT_MAX_MSP_PAIR_DISTANCE,
  type MspConnectionPair,
} from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  findFirstCollision,
  isHorizontal,
  isVertical,
  segmentOverlapsRectBoundary,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"
import {
  DEFAULT_TRACE_CLEARANCE,
  removeConsecutiveDuplicateTracePoints,
  TRACE_COORDINATE_EPSILON,
  tracePointsMatch,
} from "lib/utils/traceRouting"

const GROUND_NET_ID = "GND"

const getPathLength = (path: Point[]): number => {
  let pathLength = 0
  for (let pointIndex = 0; pointIndex < path.length - 1; pointIndex++) {
    const startPoint = path[pointIndex]!
    const endPoint = path[pointIndex + 1]!
    pathLength +=
      Math.abs(endPoint.x - startPoint.x) + Math.abs(endPoint.y - startPoint.y)
  }
  return pathLength
}

const getEscapePoint = ({
  pin,
  facingDirection,
}: {
  pin: Point
  facingDirection: FacingDirection
}): Point => {
  const escapePoint = { x: pin.x, y: pin.y }
  if (facingDirection === "x+") {
    escapePoint.x += DEFAULT_TRACE_CLEARANCE
  }
  if (facingDirection === "x-") {
    escapePoint.x -= DEFAULT_TRACE_CLEARANCE
  }
  if (facingDirection === "y+") {
    escapePoint.y += DEFAULT_TRACE_CLEARANCE
  }
  if (facingDirection === "y-") {
    escapePoint.y -= DEFAULT_TRACE_CLEARANCE
  }
  return escapePoint
}

const getOuterBounds = (obstacles: ObstacleRect[]) => {
  return {
    minX: Math.min(...obstacles.map((obstacle) => obstacle.minX)),
    minY: Math.min(...obstacles.map((obstacle) => obstacle.minY)),
    maxX: Math.max(...obstacles.map((obstacle) => obstacle.maxX)),
    maxY: Math.max(...obstacles.map((obstacle) => obstacle.maxY)),
  }
}

const getPinConnectionCandidates = ({
  connectionPair,
  obstacles,
  channelObstacles = obstacles,
}: {
  connectionPair: MspConnectionPair
  obstacles: ObstacleRect[]
  channelObstacles?: ObstacleRect[]
}): Point[][] => {
  const [firstPin, secondPin] = connectionPair.pins
  const firstEscapePoint = getEscapePoint({
    pin: firstPin,
    facingDirection: firstPin._facingDirection!,
  })
  const secondEscapePoint = getEscapePoint({
    pin: secondPin,
    facingDirection: secondPin._facingDirection!,
  })
  const outerBounds = getOuterBounds(obstacles)
  const horizontalChannels = [
    outerBounds.minY - DEFAULT_TRACE_CLEARANCE,
    outerBounds.maxY + DEFAULT_TRACE_CLEARANCE,
    ...channelObstacles.flatMap((obstacle) => [
      obstacle.minY - DEFAULT_TRACE_CLEARANCE,
      obstacle.maxY + DEFAULT_TRACE_CLEARANCE,
    ]),
  ]
  const verticalChannels = [
    outerBounds.minX - DEFAULT_TRACE_CLEARANCE,
    outerBounds.maxX + DEFAULT_TRACE_CLEARANCE,
    ...channelObstacles.flatMap((obstacle) => [
      obstacle.minX - DEFAULT_TRACE_CLEARANCE,
      obstacle.maxX + DEFAULT_TRACE_CLEARANCE,
    ]),
  ]
  // Recovery uses actual text bounds, so try local elbows before the perimeter.
  const candidates: Point[][] = [
    calculateElbow(
      { ...firstPin, facingDirection: firstPin._facingDirection! },
      { ...secondPin, facingDirection: secondPin._facingDirection! },
      { overshoot: DEFAULT_TRACE_CLEARANCE },
    ),
  ]

  for (const channelY of new Set(horizontalChannels)) {
    candidates.push(
      removeConsecutiveDuplicateTracePoints([
        firstPin,
        firstEscapePoint,
        { x: firstEscapePoint.x, y: channelY },
        { x: secondEscapePoint.x, y: channelY },
        secondEscapePoint,
        secondPin,
      ]),
    )
  }

  for (const channelX of new Set(verticalChannels)) {
    candidates.push(
      removeConsecutiveDuplicateTracePoints([
        firstPin,
        firstEscapePoint,
        { x: channelX, y: firstEscapePoint.y },
        { x: channelX, y: secondEscapePoint.y },
        secondEscapePoint,
        secondPin,
      ]),
    )
  }

  return candidates.sort(
    (firstPath, secondPath) =>
      getPathLength(firstPath) - getPathLength(secondPath),
  )
}

const getSegmentMidpoint = (startPoint: Point, endPoint: Point): Point => {
  return {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  }
}

const getJunctionPoints = (sameNetTraces: SolvedTracePath[]): Point[] => {
  const junctionPoints: Point[] = []
  for (const trace of sameNetTraces) {
    for (
      let pointIndex = 0;
      pointIndex < trace.tracePath.length - 1;
      pointIndex++
    ) {
      const startPoint = trace.tracePath[pointIndex]!
      const endPoint = trace.tracePath[pointIndex + 1]!
      junctionPoints.push(startPoint)
      junctionPoints.push(getSegmentMidpoint(startPoint, endPoint))
    }
    const lastPoint = trace.tracePath.at(-1)
    if (lastPoint) {
      junctionPoints.push(lastPoint)
    }
  }
  return junctionPoints
}

const getUnconnectedPins = ({
  connectionPair,
  sameNetTraces,
}: {
  connectionPair: MspConnectionPair
  sameNetTraces: SolvedTracePath[]
}) => {
  const connectedPinIds = new Set(
    sameNetTraces.flatMap((trace) => trace.pinIds),
  )
  return connectionPair.pins.filter((pin) => !connectedPinIds.has(pin.pinId))
}

const pathsIntersect = (firstPath: Point[], secondPath: Point[]): boolean => {
  for (let firstIndex = 0; firstIndex < firstPath.length - 1; firstIndex++) {
    for (
      let secondIndex = 0;
      secondIndex < secondPath.length - 1;
      secondIndex++
    ) {
      if (
        doSegmentsIntersect(
          firstPath[firstIndex]!,
          firstPath[firstIndex + 1]!,
          secondPath[secondIndex]!,
          secondPath[secondIndex + 1]!,
        )
      ) {
        return true
      }
    }
  }
  return false
}

const connectionPairPinsAreAlreadyConnected = ({
  connectionPair,
  sameNetTraces,
}: {
  connectionPair: MspConnectionPair
  sameNetTraces: SolvedTracePath[]
}): boolean => {
  const [firstPin, secondPin] = connectionPair.pins
  const connectedTraceIndexes = new Set(
    sameNetTraces.flatMap((trace, index) =>
      trace.pinIds.includes(firstPin.pinId) ? [index] : [],
    ),
  )

  let previousSize = -1
  while (connectedTraceIndexes.size !== previousSize) {
    previousSize = connectedTraceIndexes.size
    for (let traceIndex = 0; traceIndex < sameNetTraces.length; traceIndex++) {
      if (connectedTraceIndexes.has(traceIndex)) continue
      const trace = sameNetTraces[traceIndex]!
      const connectsToComponent = [...connectedTraceIndexes].some(
        (connectedTraceIndex) => {
          const connectedTrace = sameNetTraces[connectedTraceIndex]!
          return (
            trace.pinIds.some((pinId) =>
              connectedTrace.pinIds.includes(pinId),
            ) || pathsIntersect(trace.tracePath, connectedTrace.tracePath)
          )
        },
      )
      if (connectsToComponent) connectedTraceIndexes.add(traceIndex)
    }
  }

  return [...connectedTraceIndexes].some((traceIndex) =>
    sameNetTraces[traceIndex]!.pinIds.includes(secondPin.pinId),
  )
}

const getJunctionCandidates = ({
  connectionPair,
  sameNetTraces,
  obstacles,
  maxConnectionDistance,
}: {
  connectionPair: MspConnectionPair
  sameNetTraces: SolvedTracePath[]
  obstacles: ObstacleRect[]
  maxConnectionDistance: number
}): Point[][] => {
  const outerBounds = getOuterBounds(obstacles)
  const horizontalChannels = [
    outerBounds.minY - DEFAULT_TRACE_CLEARANCE,
    outerBounds.maxY + DEFAULT_TRACE_CLEARANCE,
  ]
  const verticalChannels = [
    outerBounds.minX - DEFAULT_TRACE_CLEARANCE,
    outerBounds.maxX + DEFAULT_TRACE_CLEARANCE,
  ]
  const candidates: Point[][] = []
  const junctionPoints = getJunctionPoints(sameNetTraces)
  const unconnectedPins = getUnconnectedPins({
    connectionPair,
    sameNetTraces,
  })

  for (const pin of unconnectedPins) {
    const escapePoint = getEscapePoint({
      pin,
      facingDirection: pin._facingDirection!,
    })
    for (const junctionPoint of junctionPoints) {
      if (distance(pin, junctionPoint) > maxConnectionDistance) {
        continue
      }
      candidates.push(
        removeConsecutiveDuplicateTracePoints([
          pin,
          escapePoint,
          { x: escapePoint.x, y: junctionPoint.y },
          junctionPoint,
        ]),
      )
      candidates.push(
        removeConsecutiveDuplicateTracePoints([
          pin,
          escapePoint,
          { x: junctionPoint.x, y: escapePoint.y },
          junctionPoint,
        ]),
      )
      for (const channelY of horizontalChannels) {
        candidates.push(
          removeConsecutiveDuplicateTracePoints([
            pin,
            escapePoint,
            { x: escapePoint.x, y: channelY },
            { x: junctionPoint.x, y: channelY },
            junctionPoint,
          ]),
        )
      }
      for (const channelX of verticalChannels) {
        candidates.push(
          removeConsecutiveDuplicateTracePoints([
            pin,
            escapePoint,
            { x: channelX, y: escapePoint.y },
            { x: channelX, y: junctionPoint.y },
            junctionPoint,
          ]),
        )
      }
    }
  }

  return candidates.sort(
    (firstPath, secondPath) =>
      getPathLength(firstPath) - getPathLength(secondPath),
  )
}

const pathCollidesWithObstacles = ({
  path,
  obstacles,
  connectionPair,
  rejectComponentBoundaryTravel,
}: {
  path: Point[]
  obstacles: ObstacleRect[]
  connectionPair: MspConnectionPair
  rejectComponentBoundaryTravel: boolean
}): boolean => {
  const firstPathPoint = path[0]!
  const lastPathPoint = path.at(-1)!
  const firstPathPin = connectionPair.pins.find((pin) =>
    tracePointsMatch(pin, firstPathPoint),
  )
  const lastPathPin = connectionPair.pins.find((pin) =>
    tracePointsMatch(pin, lastPathPoint),
  )
  // Endpoint exemptions must not allow a route through the back of a component.
  for (const [pin, neighbor] of [
    [firstPathPin, path[1]!],
    [lastPathPin, path[path.length - 2]!],
  ] as const) {
    if (!pin?._facingDirection) continue
    const outward = dir(pin._facingDirection)
    if (
      (neighbor.x - pin.x) * outward.x + (neighbor.y - pin.y) * outward.y <
      -TRACE_COORDINATE_EPSILON
    ) {
      return true
    }
  }
  const pathConnectsPairPins =
    firstPathPin !== undefined && lastPathPin !== undefined
  const firstChipObstacle = obstacles.find(
    (obstacle) =>
      obstacle.kind === "chip" && obstacle.chipId === firstPathPin?.chipId,
  )
  const secondChipObstacle = obstacles.find(
    (obstacle) =>
      obstacle.kind === "chip" && obstacle.chipId === lastPathPin?.chipId,
  )
  if (
    rejectComponentBoundaryTravel &&
    firstChipObstacle &&
    segmentOverlapsRectBoundary(path[0]!, path[1]!, firstChipObstacle)
  ) {
    return true
  }
  if (
    rejectComponentBoundaryTravel &&
    secondChipObstacle &&
    segmentOverlapsRectBoundary(
      path[path.length - 2]!,
      path[path.length - 1]!,
      secondChipObstacle,
    )
  ) {
    return true
  }
  const collision = findFirstCollision(path, obstacles, {
    excludeRectsForSegment: (segmentIndex) => {
      const excludedObstacles = new Set<ObstacleRect>()
      if (segmentIndex === 0 && firstChipObstacle) {
        excludedObstacles.add(firstChipObstacle)
      }
      if (
        pathConnectsPairPins &&
        segmentIndex === path.length - 2 &&
        secondChipObstacle
      ) {
        excludedObstacles.add(secondChipObstacle)
      }
      return excludedObstacles
    },
  })
  return collision !== null
}

const hasParallelFailedConnection = ({
  connectionPair,
  failedConnectionPairs,
}: {
  connectionPair: MspConnectionPair
  failedConnectionPairs: MspConnectionPair[]
}): boolean => {
  const connectionChipIds = new Set(
    connectionPair.pins.map((pin) => pin.chipId),
  )
  return failedConnectionPairs.some((otherConnectionPair) => {
    if (otherConnectionPair.mspPairId === connectionPair.mspPairId) {
      return false
    }
    return otherConnectionPair.pins.every((pin) =>
      connectionChipIds.has(pin.chipId),
    )
  })
}

const segmentsOverlapBeyondEndpoint = ({
  firstStart,
  firstEnd,
  secondStart,
  secondEnd,
}: {
  firstStart: Point
  firstEnd: Point
  secondStart: Point
  secondEnd: Point
}): boolean => {
  if (
    isHorizontal(firstStart, firstEnd) &&
    isHorizontal(secondStart, secondEnd)
  ) {
    const overlapLength =
      Math.min(
        Math.max(firstStart.x, firstEnd.x),
        Math.max(secondStart.x, secondEnd.x),
      ) -
      Math.max(
        Math.min(firstStart.x, firstEnd.x),
        Math.min(secondStart.x, secondEnd.x),
      )
    return overlapLength > TRACE_COORDINATE_EPSILON
  }
  if (isVertical(firstStart, firstEnd) && isVertical(secondStart, secondEnd)) {
    const overlapLength =
      Math.min(
        Math.max(firstStart.y, firstEnd.y),
        Math.max(secondStart.y, secondEnd.y),
      ) -
      Math.max(
        Math.min(firstStart.y, firstEnd.y),
        Math.min(secondStart.y, secondEnd.y),
      )
    return overlapLength > TRACE_COORDINATE_EPSILON
  }
  return false
}

const getAllowedJunctionPoints = ({
  connectionPair,
  existingTrace,
}: {
  connectionPair: MspConnectionPair
  existingTrace: SolvedTracePath
}): Point[] => {
  const existingPinIds = new Set<PinId>(existingTrace.pinIds)
  return connectionPair.pins.filter((pin) => existingPinIds.has(pin.pinId))
}

const pathCrossesExistingTraces = ({
  path,
  connectionPair,
  existingTraces,
}: {
  path: Point[]
  connectionPair: MspConnectionPair
  existingTraces: SolvedTracePath[]
}): boolean => {
  for (const existingTrace of existingTraces) {
    if (existingTrace.globalConnNetId === connectionPair.globalConnNetId) {
      continue
    }
    const allowedJunctionPoints = getAllowedJunctionPoints({
      connectionPair,
      existingTrace,
    })
    for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
      const pathStart = path[pathIndex]!
      const pathEnd = path[pathIndex + 1]!
      for (
        let traceIndex = 0;
        traceIndex < existingTrace.tracePath.length - 1;
        traceIndex++
      ) {
        const traceStart = existingTrace.tracePath[traceIndex]!
        const traceEnd = existingTrace.tracePath[traceIndex + 1]!
        if (!doSegmentsIntersect(pathStart, pathEnd, traceStart, traceEnd)) {
          continue
        }
        const intersectionIsAllowedJunction = allowedJunctionPoints.some(
          (junctionPoint) =>
            (tracePointsMatch(pathStart, junctionPoint) ||
              tracePointsMatch(pathEnd, junctionPoint)) &&
            (tracePointsMatch(traceStart, junctionPoint) ||
              tracePointsMatch(traceEnd, junctionPoint)),
        )
        if (
          intersectionIsAllowedJunction &&
          !segmentsOverlapBeyondEndpoint({
            firstStart: pathStart,
            firstEnd: pathEnd,
            secondStart: traceStart,
            secondEnd: traceEnd,
          })
        ) {
          continue
        }
        return true
      }
    }
  }
  return false
}

export class UnroutedTraceRecoverySolver extends BaseSolver {
  private inputProblem: InputProblem
  private alreadySolvedTraces: SolvedTracePath[]
  private failedConnectionPairs: MspConnectionPair[]
  private queuedConnectionPairs: MspConnectionPair[]
  private maxConnectionDistance: number
  private groundGlobalConnNetId?: string
  public solvedUnroutedTraces: SolvedTracePath[] = []

  constructor(
    private params: {
      inputProblem: InputProblem
      failedConnectionPairs: MspConnectionPair[]
      alreadySolvedTraces: SolvedTracePath[]
    },
  ) {
    super()
    this.inputProblem = params.inputProblem
    this.alreadySolvedTraces = params.alreadySolvedTraces
    this.failedConnectionPairs = params.failedConnectionPairs
    this.queuedConnectionPairs = [...params.failedConnectionPairs]
    this.maxConnectionDistance =
      this.inputProblem.maxMspPairDistance ?? DEFAULT_MAX_MSP_PAIR_DISTANCE
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    this.groundGlobalConnNetId =
      netConnMap.getNetConnectedToId(GROUND_NET_ID) ?? undefined
  }

  override getConstructorParams() {
    return this.params
  }

  override _step() {
    const connectionPair = this.queuedConnectionPairs.shift()
    if (!connectionPair) {
      this.solved = true
      return
    }
    if (connectionPair.globalConnNetId === this.groundGlobalConnNetId) {
      return
    }
    if (
      distance(connectionPair.pins[0], connectionPair.pins[1]) >
      this.maxConnectionDistance
    ) {
      return
    }

    const obstacles = getObstacleRects(this.inputProblem)
    const existingTraces = [
      ...this.alreadySolvedTraces,
      ...this.solvedUnroutedTraces,
    ]
    const sameNetTraces = existingTraces.filter(
      (trace) => trace.globalConnNetId === connectionPair.globalConnNetId,
    )
    if (
      connectionPairPinsAreAlreadyConnected({
        connectionPair,
        sameNetTraces,
      })
    ) {
      return
    }
    const junctionCandidates = getJunctionCandidates({
      connectionPair,
      sameNetTraces,
      obstacles,
      maxConnectionDistance: this.maxConnectionDistance,
    })
    const pinConnectionCandidates = getPinConnectionCandidates({
      connectionPair,
      obstacles,
      channelObstacles: [],
    })
    const candidates = [...junctionCandidates, ...pinConnectionCandidates].sort(
      (firstPath, secondPath) =>
        getPathLength(firstPath) - getPathLength(secondPath),
    )
    const rejectComponentBoundaryTravel = hasParallelFailedConnection({
      connectionPair,
      failedConnectionPairs: this.failedConnectionPairs,
    })

    let recoveredPath: Point[] | undefined
    for (const tracePath of candidates) {
      if (
        recoveredPath &&
        getPathLength(tracePath) >= getPathLength(recoveredPath)
      ) {
        continue
      }
      if (
        pathCollidesWithObstacles({
          path: tracePath,
          obstacles,
          connectionPair,
          rejectComponentBoundaryTravel,
        })
      ) {
        continue
      }
      if (
        pathCrossesExistingTraces({
          path: tracePath,
          connectionPair,
          existingTraces,
        })
      ) {
        continue
      }
      if (!recoveredPath) {
        // Local channels shorten valid routes without recovering new connections.
        candidates.push(
          ...getPinConnectionCandidates({ connectionPair, obstacles }),
        )
      }
      recoveredPath = tracePath
    }
    if (recoveredPath) {
      this.solvedUnroutedTraces.push({
        ...connectionPair,
        tracePath: recoveredPath,
        mspConnectionPairIds: [connectionPair.mspPairId],
        pinIds: connectionPair.pins.map((pin) => pin.pinId),
      })
    }
  }

  getOutput(): {
    newTraces: SolvedTracePath[]
    allTracesMerged: SolvedTracePath[]
  } {
    return {
      newTraces: this.solvedUnroutedTraces,
      allTracesMerged: [
        ...this.alreadySolvedTraces,
        ...this.solvedUnroutedTraces,
      ],
    }
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem)
    for (const trace of this.solvedUnroutedTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
      })
    }
    return graphics
  }
}
