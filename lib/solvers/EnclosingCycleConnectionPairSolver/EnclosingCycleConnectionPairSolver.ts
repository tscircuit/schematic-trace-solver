import type { ConnectivityMap } from "connectivity-map"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type {
  MspConnectionPair,
  MspConnectionPairId,
} from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type {
  ChipId,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import {
  detectEnclosingCycles,
  type DetectedEnclosingCycle,
} from "./detectEnclosingCycles"

type PinWithChip = InputPin & { chipId: ChipId }

interface EnclosingCycleConnectionPairSolverParams {
  inputProblem: InputProblem
  inputPairs: MspConnectionPair[]
  globalConnMap: ConnectivityMap
}

class DisjointSet {
  private parent = new Map<string, string>()

  add(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id)
  }

  find(id: string): string {
    this.add(id)
    const parent = this.parent.get(id)!
    if (parent === id) return id
    const root = this.find(parent)
    this.parent.set(id, root)
    return root
  }

  union(firstId: string, secondId: string): boolean {
    const firstRoot = this.find(firstId)
    const secondRoot = this.find(secondId)
    if (firstRoot === secondRoot) return false
    this.parent.set(secondRoot, firstRoot)
    return true
  }
}

/**
 * Preserves explicit connection trees for nets on a four-component cycle that
 * spatially encloses connected branches, independent of the loop's exact
 * geometry. The general MSP algorithm remains untouched for every other net.
 */
export class EnclosingCycleConnectionPairSolver extends BaseSolver {
  inputProblem: InputProblem
  inputPairs: MspConnectionPair[]
  globalConnMap: ConnectivityMap
  mspConnectionPairs: MspConnectionPair[]
  detectedCycles: DetectedEnclosingCycle[] = []
  preservedPairIds = new Set<MspConnectionPairId>()

  private pinMap = new Map<PinId, PinWithChip>()

  constructor(params: EnclosingCycleConnectionPairSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputPairs = params.inputPairs
    this.globalConnMap = params.globalConnMap
    this.mspConnectionPairs = params.inputPairs
    for (const chip of params.inputProblem.chips) {
      for (const pin of chip.pins) {
        this.pinMap.set(pin.pinId, { ...pin, chipId: chip.chipId })
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof EnclosingCycleConnectionPairSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputPairs: this.inputPairs,
      globalConnMap: this.globalConnMap,
    }
  }

  private getGlobalNetId(pinId: PinId) {
    return this.globalConnMap.getNetConnectedToId(pinId) as string | undefined
  }

  private buildPreservedPairsForNet(globalConnNetId: string) {
    const directConnections = this.inputProblem.directConnections.filter(
      (connection) =>
        this.getGlobalNetId(connection.pinIds[0]) === globalConnNetId &&
        this.getGlobalNetId(connection.pinIds[1]) === globalConnNetId,
    )
    const disjointSet = new DisjointSet()
    const preservedPairs: MspConnectionPair[] = []

    for (const connection of directConnections) {
      const [firstPinId, secondPinId] = connection.pinIds
      const firstPin = this.pinMap.get(firstPinId)
      const secondPin = this.pinMap.get(secondPinId)
      if (!firstPin || !secondPin) return null
      // Explicit cycles are intentionally left to the existing MSP behavior.
      // An acyclic tree can safely retain its authored pairing and geometry.
      if (!disjointSet.union(firstPinId, secondPinId)) return null

      const mspPairId = `${firstPinId}-${secondPinId}`
      preservedPairs.push({
        mspPairId,
        dcConnNetId: globalConnNetId,
        globalConnNetId,
        userNetId: connection.netId,
        pins: [firstPin, secondPin],
      })
    }

    for (const pair of this.inputPairs) {
      if (pair.globalConnNetId !== globalConnNetId) continue
      const [firstPin, secondPin] = pair.pins
      if (!disjointSet.union(firstPin.pinId, secondPin.pinId)) continue
      preservedPairs.push(pair)
    }

    return preservedPairs
  }

  override _step() {
    this.detectedCycles = detectEnclosingCycles(
      this.inputProblem,
      this.globalConnMap,
    )
    const targetGlobalNetIds = new Set<string>()
    for (const cycle of this.detectedCycles) {
      for (const connection of cycle.edgeConnections) {
        const globalNetId = this.getGlobalNetId(connection.pinIds[0])
        if (globalNetId) targetGlobalNetIds.add(globalNetId)
      }
    }

    const replacements = new Map<string, MspConnectionPair[]>()
    for (const globalNetId of targetGlobalNetIds) {
      const preservedPairs = this.buildPreservedPairsForNet(globalNetId)
      if (!preservedPairs) continue
      replacements.set(globalNetId, preservedPairs)
      for (const pair of preservedPairs) {
        this.preservedPairIds.add(pair.mspPairId)
      }
    }

    const outputPairs: MspConnectionPair[] = []
    const emittedReplacementNetIds = new Set<string>()
    for (const pair of this.inputPairs) {
      const replacement = replacements.get(pair.globalConnNetId)
      if (!replacement) {
        outputPairs.push(pair)
        continue
      }
      if (emittedReplacementNetIds.has(pair.globalConnNetId)) continue
      outputPairs.push(...replacement)
      emittedReplacementNetIds.add(pair.globalConnNetId)
    }
    for (const [globalNetId, replacement] of replacements) {
      if (emittedReplacementNetIds.has(globalNetId)) continue
      outputPairs.push(...replacement)
    }

    this.mspConnectionPairs = outputPairs
    this.stats.detectedCycleCount = this.detectedCycles.length
    this.stats.preservedNetCount = replacements.size
    this.stats.preservedPairCount = this.preservedPairIds.size
    this.solved = true
  }

  getOutput() {
    return {
      mspConnectionPairs: this.mspConnectionPairs,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    graphics.lines ??= []

    for (const pair of this.mspConnectionPairs) {
      const isPreservedPair = this.preservedPairIds.has(pair.mspPairId)
      const line = {
        points: pair.pins.map((pin) => ({ x: pin.x, y: pin.y })),
        strokeColor: isPreservedPair
          ? "#d97706"
          : getColorFromString(pair.mspPairId, 0.75),
      }
      if (isPreservedPair) {
        graphics.lines.push({ ...line, strokeWidth: 0.05 })
      } else {
        graphics.lines.push(line)
      }
    }

    return graphics
  }
}
