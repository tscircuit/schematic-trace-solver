/**
 * Marker prefix on `mspPairId` for synthesized pin → net-label traces.
 * Reserved — nothing else in the codebase uses it. Lives in its own file
 * so both the inner SinglePinNetLabelPlacementSolver (collision filter)
 * and the SinglePinNetLabelPlacementPipelineSolver (trace synthesis) can
 * share it without forming a circular import.
 */
export const NET_LABEL_TRACE_ID_PREFIX = "__net_label_trace_"

export const isNetLabelTraceId = (id: string) =>
  id.startsWith(NET_LABEL_TRACE_ID_PREFIX)

export const NET_LABEL_ANCHOR_PIN_ID_PREFIX = "__net_label_anchor_"
export const NET_LABEL_CHIP_ID = "__net_label__"
