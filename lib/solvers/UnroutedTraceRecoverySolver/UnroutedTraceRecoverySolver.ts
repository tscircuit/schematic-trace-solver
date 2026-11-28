import type { Point } from "@tscircuit/math-utils"
import { distance } from "@tscircuit/math-utils"
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
  segmentOverlapsRectBoundary,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"
import { buildRecoveredTraceEntry } from "./build-recovered-trace-entry"
import { doesTerminalSegmentExitEnclosingChipObstacle } from "./does-terminal-segment-exit-enclosing-chip-obstacle"
import { getConnectedSameNetTracesForPin } from "./get-connected-same-net-traces-for-pin"
import { getTraceChannelJunctions } from "./getTraceChannelJunctions"
import { pathCrossesExistingTraces } from "./path-crosses-existing-traces"

const ROUTE_CLEARANCE = 0.2
const COORDINATE_TOLERANCE = 1e-9
const GROUND_NET_ID = "GND"

const pointsAreEqual = (firstPoint: Point, secondPoint: Point): boolean => {
  return (
    Math.abs(firstPoint.x - secondPoint.x) <= COORDINATE_TOLERANCE &&
    Math.abs(firstPoint.y - secondPoint.y) <= COORDINATE_TOLERANCE
  )
}

const removeConsecutiveDuplicatePoints = (path: Point[]): Point[] => {
  const filteredPath: Point[] = []
  for (const point of path) {
    const previousPoint = filteredPath.at(-1)
    if (!previousPoint || !pointsAreEqual(previousPoint, point)) {
      filteredPath.push(point)
    }
  }
  return filteredPath
}

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
    escapePoint.x += ROUTE_CLEARANCE
  }
  if (facingDirection === "x-") {
    escapePoint.x -= ROUTE_CLEARANCE
  }
  if (facingDirection === "y+") {
    escapePoint.y += ROUTE_CLEARANCE
  }
  if (facingDirection === "y-") {
    escapePoint.y -= ROUTE_CLEARANCE
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
    outerBounds.minY - ROUTE_CLEARANCE,
    outerBounds.maxY + ROUTE_CLEARANCE,
    ...channelObstacles.flatMap((obstacle) => [
      obstacle.minY - ROUTE_CLEARANCE,
      obstacle.maxY + ROUTE_CLEARANCE,
    ]),
  ]
  const verticalChannels = [
    outerBounds.minX - ROUTE_CLEARANCE,
    outerBounds.maxX + ROUTE_CLEARANCE,
    ...channelObstacles.flatMap((obstacle) => [
      obstacle.minX - ROUTE_CLEARANCE,
      obstacle.maxX + ROUTE_CLEARANCE,
    ]),
  ]
  // Recovery uses actual text bounds, so try local elbows before the perimeter.
  const candidates: Point[][] = [
    calculateElbow(
      { ...firstPin, facingDirection: firstPin._facingDirection! },
      { ...secondPin, facingDirection: secondPin._facingDirection! },
      { overshoot: ROUTE_CLEARANCE },
    ),
  ]

  for (const channelY of new Set(horizontalChannels)) {
    candidates.push(
      removeConsecutiveDuplicatePoints([
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
      removeConsecutiveDuplicatePoints([
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

const connectionPairPinsAreAlreadyConnected = ({
  connectionPair,
  sameNetTraces,
}: {
  connectionPair: MspConnectionPair
  sameNetTraces: SolvedTracePath[]
}): boolean => {
  const [firstPin, secondPin] = connectionPair.pins
  return getConnectedSameNetTracesForPin({
    pinId: firstPin.pinId,
    sameNetTraces,
  }).some((trace) => trace.pinIds.includes(secondPin.pinId))
}

const getJunctionCandidates = ({
  connectionPair,
  sameNetTraces,
  obstacles,
  maxConnectionDistance,
  junctionPoints = getJunctionPoints(sameNetTraces),
}: {
  connectionPair: MspConnectionPair
  sameNetTraces: SolvedTracePath[]
  obstacles: ObstacleRect[]
  maxConnectionDistance: number
  junctionPoints?: Point[]
}): Point[][] => {
  const outerBounds = getOuterBounds(obstacles)
  const horizontalChannels = [
    outerBounds.minY - ROUTE_CLEARANCE,
    outerBounds.maxY + ROUTE_CLEARANCE,
  ]
  const verticalChannels = [
    outerBounds.minX - ROUTE_CLEARANCE,
    outerBounds.maxX + ROUTE_CLEARANCE,
  ]
  const candidates: Point[][] = []
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
        removeConsecutiveDuplicatePoints([
          pin,
          escapePoint,
          { x: escapePoint.x, y: junctionPoint.y },
          junctionPoint,
        ]),
      )
      candidates.push(
        removeConsecutiveDuplicatePoints([
          pin,
          escapePoint,
          { x: junctionPoint.x, y: escapePoint.y },
          junctionPoint,
        ]),
      )
      for (const channelY of horizontalChannels) {
        candidates.push(
          removeConsecutiveDuplicatePoints([
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
          removeConsecutiveDuplicatePoints([
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
    pointsAreEqual(pin, firstPathPoint),
  )
  const lastPathPin = connectionPair.pins.find((pin) =>
    pointsAreEqual(pin, lastPathPoint),
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
      -COORDINATE_TOLERANCE
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
  const secondPoint = path[1]
  const penultimatePoint = path[path.length - 2]
  const firstTerminalExclusions =
    firstPathPin && secondPoint
      ? obstacles.filter((obstacle) =>
          doesTerminalSegmentExitEnclosingChipObstacle({
            pin: firstPathPin,
            neighbor: secondPoint,
            obstacle,
          }),
        )
      : []
  const lastTerminalExclusions =
    pathConnectsPairPins && lastPathPin && penultimatePoint
      ? obstacles.filter((obstacle) =>
          doesTerminalSegmentExitEnclosingChipObstacle({
            pin: lastPathPin,
            neighbor: penultimatePoint,
            obstacle,
          }),
        )
      : []
  const collision = findFirstCollision(path, obstacles, {
    excludeRectsForSegment: (segmentIndex) => {
      const excludedObstacles = new Set<ObstacleRect>()
      if (segmentIndex === 0) {
        if (firstChipObstacle) excludedObstacles.add(firstChipObstacle)
        for (const obstacle of firstTerminalExclusions) {
          excludedObstacles.add(obstacle)
        }
      }
      if (pathConnectsPairPins && segmentIndex === path.length - 2) {
        if (secondChipObstacle) excludedObstacles.add(secondChipObstacle)
        for (const obstacle of lastTerminalExclusions) {
          excludedObstacles.add(obstacle)
        }
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
          ...getJunctionCandidates({
            connectionPair,
            sameNetTraces,
            obstacles,
            maxConnectionDistance: this.maxConnectionDistance,
            junctionPoints: getTraceChannelJunctions({
              sameNetTraces,
              obstacles,
              clearance: ROUTE_CLEARANCE,
            }),
          }),
        )
      }
      recoveredPath = tracePath
    }
    if (recoveredPath) {
      this.solvedUnroutedTraces.push(
        buildRecoveredTraceEntry({
          connectionPair,
          recoveredPath,
          sameNetTraces,
        }),
      )
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
