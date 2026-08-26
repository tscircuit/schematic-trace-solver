import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { FacingDirection } from "lib/utils/dir"

export type ChipId = string
export type PinId = string
export type NetId = string
export type SectionId = string

export interface InputPin {
  pinId: PinId

  /**
   * User-facing label for this schematic port. `pinId` remains the stable,
   * opaque routing identity and must not be shown in schematic output.
   */
  displayName?: string

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

  /**
   * Exact directional/oriented schematic-symbol name when the caller has it.
   * `center`, `width`, and `height` describe the solver obstacle and may be
   * expanded to include reference/value or manufacturer-part-number text, so
   * renderers should use this symbol's geometry for the component body.
   */
  symbolName?: string

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
   * Width of the conventional label anchored to a trace endpoint. Unlike
   * `netLabelWidth`, this does not affect whether or how the point-to-point
   * connection is routed.
   */
  anchoredNetLabelWidth?: number

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
  anchoredNetLabelWidth?: number
  netLabelHeight?: number

  /**
   * When true, a named net may use inline labels. Each routed connected
   * component gets a label along its representative trace, while each
   * disconnected endpoint gets an outward inline-label stub. Conversion is
   * atomic for the whole net so inline and anchored representations are not
   * mixed when any label cannot be placed.
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
