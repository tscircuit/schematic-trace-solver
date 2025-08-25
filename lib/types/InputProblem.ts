import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { FacingDirection } from "lib/utils/dir"

export type ChipId = string
export type PinId = string
export type NetId = string

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
}
export interface InputDirectConnection {
  pinIds: [PinId, PinId]
  netId?: string
}

export interface InputNetConnection {
  netId: string
  pinIds: Array<PinId>
}

export interface InputProblem {
  chips: Array<InputChip>
  directConnections: Array<InputDirectConnection>
  netConnections: Array<InputNetConnection>

  availableNetLabelOrientations: Record<NetId, FacingDirection[]>

  _chipObstacleSpatialIndex?: ChipObstacleSpatialIndex
}
