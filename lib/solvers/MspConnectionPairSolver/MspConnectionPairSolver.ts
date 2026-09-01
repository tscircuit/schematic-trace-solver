import { distance } from "@tscircuit/math-utils"
import type { ConnectivityMap } from "connectivity-map"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { arePinsInDifferentSchematicSections } from "../../utils/arePinsInDifferentSchematicSections"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { doesPairCrossRestrictedCenterLines } from "./doesPairCrossRestrictedCenterLines"
import { getConnectivityMapsFromInputProblem } from "./getConnectivityMapFromInputProblem"
import { getGroundConnectionPolicy } from "./getGroundConnectionPolicy"
import { getOrthogonalMinimumSpanningTree } from "./getMspConnectionPairsFromPins"
import { getLabeledConnectionRouteReason } from "./isLabeledPeripheralConnection"
import { shouldSeparateGroundNetRows } from "./shouldSeparateGroundNetRows"

export type MspConnectionPairId = string
export const DEFAULT_MAX_MSP_PAIR_DISTANCE = 1

const getPinPairKey = (pinIds: [PinId, PinId]) => [...pinIds].sort().join("::")

export type MspConnectionPair = {
  mspPairId: MspConnectionPairId
  dcConnNetId: string
  globalConnNetId: string
  userNetId?: string
  /** The trace replaces fallback labels that could not fit between its pins. */
  suppressNetLabel?: boolean
  pins: [InputPin & { chipId: string }, InputPin & { chipId: string }]
}

export class MspConnectionPairSolver extends BaseSolver {
  inputProblem: InputProblem

  mspConnectionPairs: MspConnectionPair[] = []
  mspConnectionPairIds = new Set<MspConnectionPairId>()
  dcConnMap: ConnectivityMap
  globalConnMap: ConnectivityMap
  queuedDcNetIds: string[]
  chipMap: Record<string, InputChip>
  maxMspPairDistance: number

  pinMap: Record<string, InputPin & { chipId: string }>
  userNetIdByPinId: Record<string, string | undefined>
  directConnectionPinPairKeys: Set<string>
  private canRouteGroundPair: (firstPinId: PinId, secondPinId: PinId) => boolean

  constructor({ inputProblem }: { inputProblem: InputProblem }) {
    super()

    this.inputProblem = inputProblem
    this.canRouteGroundPair = getGroundConnectionPolicy(inputProblem)
    this.maxMspPairDistance =
      inputProblem.maxMspPairDistance ?? DEFAULT_MAX_MSP_PAIR_DISTANCE

    const { directConnMap, netConnMap } =
      getConnectivityMapsFromInputProblem(inputProblem)
    this.dcConnMap = directConnMap
    this.globalConnMap = netConnMap

    this.pinMap = {}
    for (const chip of inputProblem.chips ?? []) {
      for (const pin of chip.pins ?? []) {
        this.pinMap[pin.pinId] = { ...pin, chipId: chip.chipId }
      }
    }

    this.chipMap = {}
    for (const chip of inputProblem.chips ?? []) {
      this.chipMap[chip.chipId] = chip
    }

    // Build a mapping from PinId to user-provided netId (if any)
    this.userNetIdByPinId = {}
    this.directConnectionPinPairKeys = new Set()
    for (const dc of inputProblem.directConnections ?? []) {
      this.directConnectionPinPairKeys.add(getPinPairKey(dc.pinIds))
      if (dc.netId) {
        const [a, b] = dc.pinIds
        this.userNetIdByPinId[a] = dc.netId
        this.userNetIdByPinId[b] = dc.netId
      }
    }
    for (const nc of inputProblem.netConnections ?? []) {
      for (const pid of nc.pinIds ?? []) {
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

  private addMspConnectionPair(pair: MspConnectionPair) {
    if (this.mspConnectionPairIds.has(pair.mspPairId)) return

    this.mspConnectionPairIds.add(pair.mspPairId)
    this.mspConnectionPairs.push(pair)
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
      if (!this.canRouteGroundPair(pin1!, pin2!)) return
      const pinPairKey = getPinPairKey([pin1!, pin2!])
      // Explicit source traces are classified by straight-line distance when
      // their input is created; named nets retain the orthogonal route metric.
      let pairDistance = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)
      if (this.directConnectionPinPairKeys.has(pinPairKey)) {
        pairDistance = distance(p1, p2)
      }
      // Labeled one-pin peripherals and opposed pins whose fallback labels
      // cannot fit need a real trace even when they are far apart.
      const labeledConnectionRouteReason = getLabeledConnectionRouteReason({
        inputProblem: this.inputProblem,
        chipMap: this.chipMap,
        pins: [p1, p2],
      })
      if (
        pairDistance > this.maxMspPairDistance &&
        !labeledConnectionRouteReason
      ) {
        // Too far apart; skip creating an MSP pair for this net
        return
      }
      if (arePinsInDifferentSchematicSections(this.inputProblem, p1, p2)) {
        return
      }
      // Avoid pairs that would cross restricted center lines
      const pinIdMap = new Map(Object.entries(this.pinMap)) as Map<
        PinId,
        InputPin & { chipId: string }
      >
      if (
        doesPairCrossRestrictedCenterLines({
          inputProblem: this.inputProblem,
          chipMap: this.chipMap,
          pinIdMap,
          p1,
          p2,
        })
      ) {
        return
      }

      const globalConnNetId = this.globalConnMap.getNetConnectedToId(pin1!)!
      const userNetId =
        this.userNetIdByPinId[pin1!] ?? this.userNetIdByPinId[pin2!]
      const suppressNetLabel =
        pairDistance > this.maxMspPairDistance &&
        labeledConnectionRouteReason === "overlapping-fallback-labels"

      this.addMspConnectionPair({
        mspPairId: `${pin1}-${pin2}`,
        dcConnNetId: dcNetId,
        globalConnNetId,
        userNetId,
        suppressNetLabel,
        pins: [p1, p2],
      })

      return
    }

    // There are more than 3 pins, so we need to run MSP to find the best pairs

    const pinIdMap = new Map(Object.entries(this.pinMap)) as Map<
      PinId,
      InputPin & { chipId: string }
    >
    const userNetId = this.userNetIdByPinId[directlyConnectedPins[0]!]
    const netConnection = this.inputProblem.netConnections.find(
      (connection) => connection.netId === userNetId,
    )
    const directlyConnectedPinObjects = directlyConnectedPins.map(
      (pinId) => this.pinMap[pinId]!,
    )
    const msp = getOrthogonalMinimumSpanningTree(directlyConnectedPinObjects, {
      maxDistance: this.maxMspPairDistance,
      forbidEdge: (a, b) =>
        !this.canRouteGroundPair(a.pinId, b.pinId) ||
        shouldSeparateGroundNetRows({
          netConnection,
          netPins: directlyConnectedPinObjects,
          pin1: a,
          pin2: b,
        }) ||
        arePinsInDifferentSchematicSections(this.inputProblem, a, b) ||
        doesPairCrossRestrictedCenterLines({
          inputProblem: this.inputProblem,
          chipMap: this.chipMap,
          pinIdMap,
          p1: a,
          p2: b,
        }),
    })

    for (const [pin1, pin2] of msp) {
      const p1Obj = this.pinMap[pin1!]!
      const p2Obj = this.pinMap[pin2!]!
      if (
        arePinsInDifferentSchematicSections(this.inputProblem, p1Obj, p2Obj)
      ) {
        continue
      }
      // Skip any edge that would cross a restricted center line (safety filter)
      if (
        doesPairCrossRestrictedCenterLines({
          inputProblem: this.inputProblem,
          chipMap: this.chipMap,
          pinIdMap,
          p1: p1Obj,
          p2: p2Obj,
        })
      ) {
        continue
      }

      const globalConnNetId = this.globalConnMap.getNetConnectedToId(pin1!)!
      const pairUserNetId =
        this.userNetIdByPinId[pin1!] ?? this.userNetIdByPinId[pin2!]
      this.addMspConnectionPair({
        mspPairId: `${pin1}-${pin2}`,
        dcConnNetId: dcNetId,
        globalConnNetId,
        userNetId: pairUserNetId,
        pins: [p1Obj, p2Obj],
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
