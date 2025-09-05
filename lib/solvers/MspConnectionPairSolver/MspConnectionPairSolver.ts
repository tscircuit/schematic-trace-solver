import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import { ConnectivityMap } from "connectivity-map"
import { getConnectivityMapsFromInputProblem } from "./getConnectivityMapFromInputProblem"
import { getOrthogonalMinimumSpanningTree } from "./getMspConnectionPairsFromPins"
import type { GraphicsObject } from "graphics-debug"
import { checkIfMspPairCanConnectDirectly } from "./checkIfMspPairCanConnectDirectly"
import { getColorFromString } from "lib/utils/getColorFromString"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"

export type MspConnectionPairId = string

export type MspConnectionPair = {
  mspPairId: MspConnectionPairId
  dcConnNetId: string
  globalConnNetId: string
  userNetId?: string
  pins: [InputPin & { chipId: string }, InputPin & { chipId: string }]
}

export class MspConnectionPairSolver extends BaseSolver {
  inputProblem: InputProblem

  mspConnectionPairs: MspConnectionPair[] = []
  dcConnMap: ConnectivityMap
  globalConnMap: ConnectivityMap
  queuedDcNetIds: string[]
  chipMap: Record<string, InputChip>
  maxMspPairDistance: number

  pinMap: Record<string, InputPin & { chipId: string }>
  userNetIdByPinId: Record<string, string | undefined>

  constructor({ inputProblem }: { inputProblem: InputProblem }) {
    super()

    this.inputProblem = inputProblem
    this.maxMspPairDistance = inputProblem.maxMspPairDistance ?? 1

    const { directConnMap, netConnMap } =
      getConnectivityMapsFromInputProblem(inputProblem)
    this.dcConnMap = directConnMap
    this.globalConnMap = netConnMap

    this.pinMap = {}
    for (const chip of inputProblem.chips) {
      for (const pin of chip.pins) {
        this.pinMap[pin.pinId] = {
          ...pin,
          chipId: chip.chipId,
          _facingDirection: pin._facingDirection ?? getPinDirection(pin, chip),
        }
      }
    }

    this.chipMap = {}
    for (const chip of inputProblem.chips) {
      this.chipMap[chip.chipId] = chip
    }

    // Build a mapping from PinId to user-provided netId (if any)
    this.userNetIdByPinId = {}
    for (const dc of inputProblem.directConnections) {
      if (dc.netId) {
        const [a, b] = dc.pinIds
        this.userNetIdByPinId[a] = dc.netId
        this.userNetIdByPinId[b] = dc.netId
      }
    }
    for (const nc of inputProblem.netConnections) {
      for (const pid of nc.pinIds) {
        this.userNetIdByPinId[pid] = nc.netId
      }
    }

    this.queuedDcNetIds = Object.keys(netConnMap.netMap)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof MspConnectionPairSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
    }
  }

  override _step() {
    if (this.queuedDcNetIds.length === 0) {
      this.solved = true
      return
    }

    const dcNetId = this.queuedDcNetIds.shift()!

    const allIds = this.globalConnMap.getIdsConnectedToNet(dcNetId) as string[]
    const directlyConnectedPins = allIds.filter((id) => !!this.pinMap[id])

    if (directlyConnectedPins.length <= 1) {
      return
    }

    if (directlyConnectedPins.length === 2) {
      const [pin1, pin2] = directlyConnectedPins
      const p1 = this.pinMap[pin1!]!
      const p2 = this.pinMap[pin2!]!
      if (!checkIfMspPairCanConnectDirectly(this.chipMap, p1, p2)) {
        return
      }

      // Enforce max pair distance (use Manhattan to match orthogonal routing metric)
      const manhattanDist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)
      if (manhattanDist > this.maxMspPairDistance) {
        // Too far apart; skip creating an MSP pair for this net
        return
      }

      const globalConnNetId = this.globalConnMap.getNetConnectedToId(pin1!)!
      const userNetId =
        this.userNetIdByPinId[pin1!] ?? this.userNetIdByPinId[pin2!]

      this.mspConnectionPairs.push({
        mspPairId: `${pin1}-${pin2}`,
        dcConnNetId: dcNetId,
        globalConnNetId,
        userNetId,
        pins: [p1, p2],
      })

      return
    }

    // There are more than 3 pins, so we need to run MSP to find the best pairs

    const msp = getOrthogonalMinimumSpanningTree(
      directlyConnectedPins.map((p) => this.pinMap[p]!).filter(Boolean),
      {
        maxDistance: this.maxMspPairDistance,
        canConnect: (a, b) =>
          checkIfMspPairCanConnectDirectly(this.chipMap, a as any, b as any),
      },
    )

    for (const [pin1, pin2] of msp) {
      const globalConnNetId = this.globalConnMap.getNetConnectedToId(pin1!)!
      const userNetId =
        this.userNetIdByPinId[pin1!] ?? this.userNetIdByPinId[pin2!]
      this.mspConnectionPairs.push({
        mspPairId: `${pin1}-${pin2}`,
        dcConnNetId: dcNetId,
        globalConnNetId,
        userNetId,
        pins: [this.pinMap[pin1!]!, this.pinMap[pin2!]!],
      })
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    // Draw all the solved MSP with lines, and the next-to-be-solved points with points
    for (const pair of this.mspConnectionPairs) {
      graphics.lines!.push({
        points: [
          {
            x: pair.pins[0].x,
            y: pair.pins[0].y,
          },
          {
            x: pair.pins[1].x,
            y: pair.pins[1].y,
          },
        ],
        strokeColor: getColorFromString(pair.mspPairId, 0.75),
      })
    }

    return graphics
  }
}
