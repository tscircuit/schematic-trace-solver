import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

/** Every pin represented by the old label must still have the same net name. */
export const isLabelRepresentedInline = (
  label: { globalConnNetId: string; pinIds: string[] },
  inlinePlacements: InlineNetLabelPlacement[],
) =>
  label.pinIds.length > 0 &&
  label.pinIds.every((pinId) =>
    inlinePlacements.some(
      (inline) =>
        inline.globalConnNetId === label.globalConnNetId &&
        inline.pinIds.includes(pinId),
    ),
  )
