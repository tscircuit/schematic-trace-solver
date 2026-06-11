import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { FacingDirection } from "lib/utils/dir"

export type ChipId = string
export type PinId = string
export type NetId = string
export type SectionId = string

export interface InputPin {
  pinId: PinId
  x: number
  y: number

  _facingDirection?: "x+" | "x-" | "y+" | "y-"
}
export interface InputChip {
  chipId: ChipId
  center: { x: number; y: number }
  width: number
  height: number
  pins: Array<InputPin>
  sectionId?: SectionId
}
/**
 * A rectangular keep-out region (e.g. component name/value text) that net
 * labels should not be placed over. Only labels restricted to y+/y-
 * orientations (power/ground rails) currently avoid these.
 */
export interface InputObstacle {
  obstacleId: string
  center: { x: number; y: number }
  width: number
  height: number
}

export interface InputDirectConnection {
  pinIds: [PinId, PinId]
  netId?: string
  netLabelWidth?: number
}

export interface InputNetConnection {
  netId: string
  pinIds: Array<PinId>
  netLabelWidth?: number
  netLabelHeight?: number
}

export interface InputProblem {
  chips: Array<InputChip>
  obstacles?: Array<InputObstacle>
  directConnections: Array<InputDirectConnection>
  netConnections: Array<InputNetConnection>

  availableNetLabelOrientations: Record<NetId, FacingDirection[]>
  maxMspPairDistance?: number

  _chipObstacleSpatialIndex?: ChipObstacleSpatialIndex
}
