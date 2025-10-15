import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type {
  InputProblem,
  InputPin,
  PinId,
  InputChip,
} from "lib/types/InputProblem"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import { SchematicTraceSingleLineSolver2 } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"

const NEAREST_NEIGHBOR_COUNT = 3

const distance = (p1: InputPin, p2: InputPin) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
}

export class LongDistancePairSolver extends BaseSolver {
  public solvedLongDistanceTraces: SolvedTracePath[] = []
  private queuedCandidatePairs: Array<
    [InputPin & { chipId: string }, InputPin & { chipId: string }]
  > = []
  private currentCandidatePair:
    | [InputPin & { chipId: string }, InputPin & { chipId: string }]
    | null = null
  private subSolver: SchematicTraceSingleLineSolver2 | null = null
  private chipMap: Record<string, InputChip> = {}
  private inputProblem: InputProblem
  private netConnMap: ConnectivityMap
  private newlyConnectedPinIds = new Set<PinId>()
  private allSolvedTraces: SolvedTracePath[] = []

  constructor(
    private params: {
      inputProblem: InputProblem
      alreadySolvedTraces: SolvedTracePath[]
      primaryMspConnectionPairs: MspConnectionPair[]
    },
  ) {
    super()

    const { inputProblem, primaryMspConnectionPairs, alreadySolvedTraces } =
      this.params

    this.inputProblem = inputProblem
    this.allSolvedTraces = [...alreadySolvedTraces]

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

    // 2. Generate candidate pairs using N-Nearest-Neighbors approach
    const candidatePairs: Array<
      [InputPin & { chipId: string }, InputPin & { chipId: string }]
    > = []
    const addedPairKeys = new Set<string>()

    for (const internalNetId of Object.keys(netConnMap.netMap)) {
      const [originalNetId, ...allPinIdsInNet] =
        netConnMap.getIdsConnectedToNet(internalNetId)

      if (originalNetId === "GND" || originalNetId === "VCC") {
        continue
      }

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
    this.queuedCandidatePairs = candidatePairs
  }

  override getConstructorParams() {
    return this.params
  }

  override _step() {
    // 1. Check if a sub-solver has finished and process its result
    if (this.subSolver?.solved) {
      const newTracePath = this.subSolver.solvedTracePath
      if (newTracePath && this.currentCandidatePair) {
        const isTraceClear = !doesTraceOverlapWithExistingTraces(
          newTracePath,
          this.allSolvedTraces,
        )

        if (isTraceClear) {
          const [p1, p2] = this.currentCandidatePair
          const globalConnNetId = this.netConnMap.getNetConnectedToId(p1.pinId)!
          const mspPairId = `${p1.pinId}-${p2.pinId}`

          const newSolvedTrace: SolvedTracePath = {
            mspPairId,
            dcConnNetId: globalConnNetId,
            globalConnNetId,
            pins: [p1, p2],
            tracePath: newTracePath,
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
    }

    // 2. If a sub-solver is already running, let it continue
    if (this.subSolver) {
      this.subSolver.step()
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
      return { newTraces: [], allTracesMerged: this.params.alreadySolvedTraces }
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
