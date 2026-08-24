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

export interface TextBoxes {
  chipId?: ChipId
  center: { x: number; y: number }
  width: number
  height: number
  text?: string
}

export interface InputChip {
  chipId: ChipId
  center: { x: number; y: number }
  width: number
  height: number
  pins: Array<InputPin>
  sectionId?: SectionId
}
export interface InputDirectConnection {
  pinIds: [PinId, PinId]
  netId?: string

  /**
   * User-facing text to render for this net label. `netId` remains the stable
   * connectivity identifier and may be an internal id. When this is omitted
   * but a label width is provided, renderers should use a width-preserving
   * placeholder instead of exposing `netId` as label text.
   */
  netLabelText?: string
  netLabelWidth?: number

  /**
   * Width of the conventional anchored label to use only when an inline label
   * cannot be placed. Unlike `netLabelWidth`, this does not affect whether or
   * how the point-to-point connection is routed.
   */
  fallbackNetLabelWidth?: number

  /**
   * When true, this point-to-point connection may be labeled with an "inline
   * net label": the net name is drawn parallel to (and offset from) the routed
   * trace instead of being placed as a separate anchored net label at the end
   * of the trace.
   *
   * Only set this for connections whose net name is worth showing on the wire -
   * the solver trusts the caller (e.g. @tscircuit/core) to make that decision.
   * When the connection is routed, the label is placed along the trace. If
   * routing is intentionally skipped, both endpoint labels may instead become
   * outward inline stubs.
   */
  allowInlineNetLabel?: boolean

  /**
   * Extent of the inline net label along the trace. Falls back to
   * `netLabelWidth`, then to an estimate from `netLabelText` (or `netId` for
   * backwards compatibility).
   */
  inlineNetLabelWidth?: number

  /**
   * Height of the inline net label text. Defaults to
   * DEFAULT_INLINE_NET_LABEL_HEIGHT.
   */
  inlineNetLabelHeight?: number
}

export interface InputNetConnection {
  netId: string
  pinIds: Array<PinId>

  /**
   * User-facing text to render for this net label. `netId` remains the stable
   * connectivity identifier and may be an internal id. When this is omitted
   * but a label width is provided, renderers should use a width-preserving
   * placeholder instead of exposing `netId` as label text.
   */
  netLabelText?: string
  netLabelWidth?: number
  fallbackNetLabelWidth?: number
  netLabelHeight?: number

  /**
   * When true, a named one- or two-pin net may use inline labels. A single-pin
   * net gets an outward stub. A routed two-pin net gets one label along its
   * trace; when that route is intentionally skipped, both endpoints get
   * outward stubs. Nets with more than two pins retain anchored labels.
   */
  allowInlineNetLabel?: boolean

  /** Extent of the inline text along the generated trace stub. */
  inlineNetLabelWidth?: number

  /** Height of the inline text perpendicular to the generated trace stub. */
  inlineNetLabelHeight?: number
}

export interface InputProblem {
  chips: Array<InputChip>
  directConnections: Array<InputDirectConnection>
  netConnections: Array<InputNetConnection>
  textBoxes?: Array<TextBoxes>

  availableNetLabelOrientations: Record<NetId, FacingDirection[]>
  maxMspPairDistance?: number

  _chipObstacleSpatialIndex?: ChipObstacleSpatialIndex
  _hideRatsNet?: boolean
}
