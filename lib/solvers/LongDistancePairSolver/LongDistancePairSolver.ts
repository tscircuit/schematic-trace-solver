import type { Point } from "@tscircuit/math-utils"
import type { ConnectivityMap } from "connectivity-map"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import {
  DEFAULT_MAX_MSP_PAIR_DISTANCE,
  type MspConnectionPair,
} from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
import { arePinsInDifferentSchematicSections } from "../../utils/arePinsInDifferentSchematicSections"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import { getGroundConnectionPolicy } from "../MspConnectionPairSolver/getGroundConnectionPolicy"
import { isLabeledPeripheralConnection } from "../MspConnectionPairSolver/isLabeledPeripheralConnection"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTraceSingleLineSolver2 } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

const NEAREST_NEIGHBOR_COUNT = 3

const distance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
}

const manhattanDistance = (p1: InputPin, p2: InputPin) =>
  Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)

const EPS = 1e-9

const between = (value: number, first: number, second: number) =>
  value >= Math.min(first, second) - EPS &&
  value <= Math.max(first, second) + EPS

const getAxisAlignedIntersection = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  const firstIsHorizontal = Math.abs(firstStart.y - firstEnd.y) <= EPS
  const firstIsVertical = Math.abs(firstStart.x - firstEnd.x) <= EPS
  const secondIsHorizontal = Math.abs(secondStart.y - secondEnd.y) <= EPS
  const secondIsVertical = Math.abs(secondStart.x - secondEnd.x) <= EPS

  if (firstIsHorizontal && secondIsVertical) {
    const point = { x: secondStart.x, y: firstStart.y }
    return between(point.x, firstStart.x, firstEnd.x) &&
      between(point.y, secondStart.y, secondEnd.y)
      ? point
      : null
  }
  if (firstIsVertical && secondIsHorizontal) {
    const point = { x: firstStart.x, y: secondStart.y }
    return between(point.y, firstStart.y, firstEnd.y) &&
      between(point.x, secondStart.x, secondEnd.x)
      ? point
      : null
  }
  if (
    firstIsHorizontal &&
    secondIsHorizontal &&
    Math.abs(firstStart.y - secondStart.y) <= EPS
  ) {
    const overlapMin = Math.max(
      Math.min(firstStart.x, firstEnd.x),
      Math.min(secondStart.x, secondEnd.x),
    )
    const overlapMax = Math.min(
      Math.max(firstStart.x, firstEnd.x),
      Math.max(secondStart.x, secondEnd.x),
    )
    if (overlapMin > overlapMax + EPS) return null
    return {
      x: Math.max(overlapMin, Math.min(firstStart.x, overlapMax)),
      y: firstStart.y,
    }
  }
  if (
    firstIsVertical &&
    secondIsVertical &&
    Math.abs(firstStart.x - secondStart.x) <= EPS
  ) {
    const overlapMin = Math.max(
      Math.min(firstStart.y, firstEnd.y),
      Math.min(secondStart.y, secondEnd.y),
    )
    const overlapMax = Math.min(
      Math.max(firstStart.y, firstEnd.y),
      Math.max(secondStart.y, secondEnd.y),
    )
    if (overlapMin > overlapMax + EPS) return null
    return {
      x: firstStart.x,
      y: Math.max(overlapMin, Math.min(firstStart.y, overlapMax)),
    }
  }
  return null
}

const clipPathAtFirstIntersection = (
  tracePath: SolvedTracePath["tracePath"],
  existingTraces: SolvedTracePath[],
) => {
  for (let pathIndex = 0; pathIndex < tracePath.length - 1; pathIndex++) {
    const pathStart = tracePath[pathIndex]!
    const pathEnd = tracePath[pathIndex + 1]!
    const intersections = existingTraces.flatMap((trace) =>
      trace.tracePath.slice(0, -1).flatMap((traceStart, traceIndex) => {
        const intersection = getAxisAlignedIntersection(
          pathStart,
          pathEnd,
          traceStart,
          trace.tracePath[traceIndex + 1]!,
        )
        return intersection ? [intersection] : []
      }),
    )
    intersections.sort(
      (first, second) =>
        distance(pathStart, first) - distance(pathStart, second),
    )
    const intersection = intersections[0]
    if (!intersection) continue
    const clippedPath = tracePath.slice(0, pathIndex + 1)
    if (distance(clippedPath.at(-1)!, intersection) > EPS) {
      clippedPath.push(intersection)
    }
    return clippedPath
  }
  return null
}

export class LongDistancePairSolver extends BaseSolver {
  public solvedLongDistanceTraces: SolvedTracePath[] = []
  private queuedCandidatePairs: Array<
    [InputPin & { chipId: string }, InputPin & { chipId: string }]
  > = []
  private currentCandidatePair:
    | [InputPin & { chipId: string }, InputPin & { chipId: string }]
    | null = null
  private queuedFailedConnectionPairs: MspConnectionPair[] = []
  private currentFailedConnectionPair: MspConnectionPair | null = null
  private subSolver: SchematicTraceSingleLineSolver2 | null = null
  private chipMap: Record<string, InputChip> = {}
  private inputProblem: InputProblem
  private netConnMap: ConnectivityMap
  private newlyConnectedPinIds = new Set<PinId>()
  private allSolvedTraces: SolvedTracePath[] = []
  private maxMspPairDistance: number

  constructor(
    private params: {
      inputProblem: InputProblem
      alreadySolvedTraces: SolvedTracePath[]
      primaryMspConnectionPairs: MspConnectionPair[]
      failedConnectionPairs: MspConnectionPair[]
    },
  ) {
    super()

    const { inputProblem, primaryMspConnectionPairs, alreadySolvedTraces } =
      this.params
    const canRouteGroundPair = getGroundConnectionPolicy(inputProblem)

    this.inputProblem = inputProblem
    this.allSolvedTraces = [...alreadySolvedTraces]
    this.maxMspPairDistance =
      inputProblem.maxMspPairDistance ?? DEFAULT_MAX_MSP_PAIR_DISTANCE

    // 1. Create initial maps and sets for efficient lookup
    const primaryConnectedPinIds = new Set<PinId>()
    for (const pair of primaryMspConnectionPairs) {
      primaryConnectedPinIds.add(pair.pins[0].pinId)
      primaryConnectedPinIds.add(pair.pins[1].pinId)
    }

    const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
    this.netConnMap = netConnMap
    const pinMap = new Map<PinId, InputPin & { chipId: string }>()
    for (const chip of inputProblem.chips) {
      this.chipMap[chip.chipId] = chip
      for (const pin of chip.pins) {
        pinMap.set(pin.pinId, { ...pin, chipId: chip.chipId })
      }
    }
    // Retry failed MSP pairs with their existing identity before creating
    // new nearest-neighbor candidates.
    this.queuedFailedConnectionPairs = this.params.failedConnectionPairs.filter(
      (connectionPair) =>
        canRouteGroundPair(
          connectionPair.pins[0].pinId,
          connectionPair.pins[1].pinId,
        ) &&
        isLabeledPeripheralConnection({
          inputProblem: this.inputProblem,
          chipMap: this.chipMap,
          pins: connectionPair.pins,
        }),
    )

    // 2. Generate candidate pairs using N-Nearest-Neighbors approach
    const candidatePairs: Array<
      [InputPin & { chipId: string }, InputPin & { chipId: string }]
    > = []
    const addedPairKeys = new Set<string>()

    for (const netId of Object.keys(netConnMap.netMap)) {
      const allPinIdsInNet = netConnMap.getIdsConnectedToNet(netId)
      if (allPinIdsInNet.length < 2) continue

      const unconnectedPinIds = allPinIdsInNet.filter(
        (pinId) => !primaryConnectedPinIds.has(pinId),
      )

      for (const unconnectedPinId of unconnectedPinIds) {
        const sourcePin = pinMap.get(unconnectedPinId)
        if (!sourcePin) continue

        const neighbors = allPinIdsInNet
          .filter((otherPinId) => otherPinId !== unconnectedPinId)
          .flatMap((otherPinId) => {
            const targetPin = pinMap.get(otherPinId)
            if (!targetPin) return [] // Gracefully handle missing pins
            if (!canRouteGroundPair(sourcePin.pinId, targetPin.pinId)) return []
            const isNamedTwoPinConnection = inputProblem.netConnections.some(
              (connection) =>
                connection.pinIds.length === 2 &&
                connection.pinIds.includes(sourcePin.pinId) &&
                connection.pinIds.includes(targetPin.pinId),
            )
            if (
              isNamedTwoPinConnection &&
              manhattanDistance(sourcePin, targetPin) > this.maxMspPairDistance
            ) {
              return []
            }
            return [
              {
                pin: targetPin,
                distance: distance(sourcePin, targetPin),
              },
            ]
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, NEAREST_NEIGHBOR_COUNT)

        for (const neighbor of neighbors) {
          const pair: [
            InputPin & { chipId: string },
            InputPin & { chipId: string },
          ] = [sourcePin, neighbor.pin]
          if (
            arePinsInDifferentSchematicSections(inputProblem, pair[0], pair[1])
          ) {
            continue
          }
          const pairKey = pair
            .map((p) => p.pinId)
            .sort()
            .join("--")

          if (!addedPairKeys.has(pairKey)) {
            candidatePairs.push(pair)
            addedPairKeys.add(pairKey)
          }
        }
      }
    }
    // Filter out nets handled exclusively via net label orientations
    // to avoid spurious extra trace lines (issue #79)
    const directlyWiredPinIds = new Set<PinId>()
    for (const dc of inputProblem.directConnections) {
      for (const pid of dc.pinIds) {
        directlyWiredPinIds.add(pid)
      }
    }
    const netLabelOrientedNets = new Set<string>(
      Object.keys(inputProblem.availableNetLabelOrientations ?? {}),
    )
    this.queuedCandidatePairs = candidatePairs.filter(([p1, p2]) => {
      const netId1 = this.netConnMap.getNetConnectedToId(p1.pinId)
      if (!netId1) return false
      const connectedIds = this.netConnMap.getIdsConnectedToNet(netId1) as string[]
      if (!connectedIds.some((id) => directlyWiredPinIds.has(id)) &&
          connectedIds.some((id) => netLabelOrientedNets.has(id))) {
        return false
      }
      return true
    })
  }

  override getConstructorParams() {
    return this.params
  }

  private acceptFailedConnectionPair(tracePath: SolvedTracePath["tracePath"]) {
    const connectionPair = this.currentFailedConnectionPair
    if (!connectionPair) return

    // Reuse the original pair so downstream solvers retain its connectivity
    // IDs, user net ID, pins, and MSP pair ID.
    const solvedTrace: SolvedTracePath = {
      ...connectionPair,
      tracePath,
      mspConnectionPairIds: [connectionPair.mspPairId],
      pinIds: connectionPair.pins.map((pin) => pin.pinId),
    }
    this.solvedLongDistanceTraces.push(solvedTrace)
    this.allSolvedTraces.push(solvedTrace)
    for (const pin of connectionPair.pins) {
      this.newlyConnectedPinIds.add(pin.pinId)
    }
  }

  override _step() {
    // 1. Check if a sub-solver has finished and process its result
    if (this.subSolver?.solved && this.currentFailedConnectionPair) {
      const tracePath = this.subSolver.solvedTracePath
      if (tracePath) {
        this.acceptFailedConnectionPair(tracePath)
      }
      this.subSolver = null
      this.currentCandidatePair = null
      this.currentFailedConnectionPair = null
    } else if (this.subSolver?.solved) {
      const newTracePath = this.subSolver.solvedTracePath
      if (newTracePath && this.currentCandidatePair) {
        const [p1, p2] = this.currentCandidatePair
        const globalConnNetId = this.netConnMap.getNetConnectedToId(p1.pinId)!
        const sameNetTraces = this.allSolvedTraces.filter(
          (trace) => trace.globalConnNetId === globalConnNetId,
        )
        const inputNetConnection = this.inputProblem.netConnections.find(
          (connection) =>
            connection.pinIds.length === 3 &&
            connection.pinIds.includes(p1.pinId) &&
            connection.pinIds.includes(p2.pinId),
        )
        const sourceChip = this.chipMap[p1.chipId]
        const targetRailTrace = sameNetTraces.find(
          (trace) =>
            trace.pinIds.includes(p2.pinId) &&
            trace.pins.every((pin) => pin.chipId === p2.chipId),
        )
        const canJoinThreePinNet =
          inputNetConnection !== undefined &&
          sourceChip?.pins.length === 2 &&
          targetRailTrace !== undefined
        const junctionTracePath = canJoinThreePinNet
          ? clipPathAtFirstIntersection(newTracePath, sameNetTraces)
          : null
        const acceptedTracePath = junctionTracePath ?? newTracePath
        const tracesToCheck = junctionTracePath
          ? this.allSolvedTraces.filter(
              (trace) => trace.globalConnNetId !== globalConnNetId,
            )
          : this.allSolvedTraces
        const isTraceClear = !doesTraceOverlapWithExistingTraces(
          acceptedTracePath,
          tracesToCheck,
        )

        if (isTraceClear) {
          const mspPairId = `${p1.pinId}-${p2.pinId}`

          const newSolvedTrace: SolvedTracePath = {
            mspPairId,
            dcConnNetId: globalConnNetId,
            globalConnNetId,
            pins: [p1, p2],
            tracePath: acceptedTracePath,
            mspConnectionPairIds: [mspPairId],
            pinIds: [p1.pinId, p2.pinId],
          }

          this.solvedLongDistanceTraces.push(newSolvedTrace)
          this.allSolvedTraces.push(newSolvedTrace)

          this.newlyConnectedPinIds.add(p1.pinId)
          this.newlyConnectedPinIds.add(p2.pinId)
        }
      }
      this.subSolver = null
      this.currentCandidatePair = null
    } else if (this.subSolver?.failed) {
      this.subSolver = null
      this.currentCandidatePair = null
      this.currentFailedConnectionPair = null
    }

    // 2. If a sub-solver is already running, let it continue
    if (this.subSolver) {
      this.subSolver.step()
      return
    }

    const failedConnectionPair = this.queuedFailedConnectionPairs.shift()
    if (failedConnectionPair) {
      this.currentFailedConnectionPair = failedConnectionPair
      this.currentCandidatePair = failedConnectionPair.pins
      this.subSolver = new SchematicTraceSingleLineSolver2({
        inputProblem: this.params.inputProblem,
        pins: failedConnectionPair.pins,
        chipMap: this.chipMap,
      })
      return
    }

    // 3. Find the next valid candidate pair and start a new sub-solver
    while (this.queuedCandidatePairs.length > 0) {
      const nextPair = this.queuedCandidatePairs.shift()!
      const [p1, p2] = nextPair

      if (
        this.newlyConnectedPinIds.has(p1.pinId) ||
        this.newlyConnectedPinIds.has(p2.pinId)
      ) {
        continue
      }

      this.currentCandidatePair = nextPair
      this.subSolver = new SchematicTraceSingleLineSolver2({
        inputProblem: this.params.inputProblem,
        pins: this.currentCandidatePair,
        chipMap: this.chipMap,
      })
      return
    }

    // 4. If we've exited the loop, there are no more valid pairs to process
    this.solved = true
  }

  override visualize() {
    if (this.subSolver) {
      return this.subSolver.visualize()
    }

    const graphics = visualizeInputProblem(this.inputProblem)

    // Draw solved long-distance traces
    for (const trace of this.solvedLongDistanceTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    // Draw queued candidate pairs
    for (const [p1, p2] of this.queuedCandidatePairs) {
      graphics.lines!.push({
        points: [p1, p2],
        strokeColor: "gray",
        strokeDash: "4 4",
      })
    }

    return graphics
  }

  public getOutput(): {
    newTraces: SolvedTracePath[]
    allTracesMerged: SolvedTracePath[]
  } {
    if (!this.solved) {
      return {
        newTraces: [],
        allTracesMerged: this.params.alreadySolvedTraces,
      }
    }
    return {
      newTraces: this.solvedLongDistanceTraces,
      allTracesMerged: [
        ...this.params.alreadySolvedTraces,
        ...this.solvedLongDistanceTraces,
      ],
    }
  }
}
