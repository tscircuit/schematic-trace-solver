import type { Bounds } from "@tscircuit/math-utils"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import type { InputChip } from "lib/types/InputProblem"

/** Body rectangle and separately drawn stem centerlines in world mm (+X right,
 * +Y up). Keeping stems separate leaves the empty space around custom symbols
 * routable and does not move their terminals or enlarge their body rectangle.
 */
export const getInputChipObstacleBounds = (chip: InputChip): Bounds[] => [
  getInputChipBounds(chip),
  ...chip.pins.flatMap((pin) =>
    pin.stemEnd
      ? [
          {
            minX: Math.min(pin.x, pin.stemEnd.x),
            maxX: Math.max(pin.x, pin.stemEnd.x),
            minY: Math.min(pin.y, pin.stemEnd.y),
            maxY: Math.max(pin.y, pin.stemEnd.y),
          },
        ]
      : [],
  ),
]
