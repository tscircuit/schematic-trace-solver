export type ChipId = string
export type PinId = string

export interface InputPin {
  pinId: PinId
  x: number
  y: number
}
export interface InputChip {
  chipId: ChipId
  center: { x: number; y: number }
  pins: Array<InputPin>
}
export interface InputConnection {
  pinIds: [PinId, PinId]
  netName?: string
}

export interface InputProblem {
  chips: Array<InputChip>
  connections: Array<InputConnection>
}
