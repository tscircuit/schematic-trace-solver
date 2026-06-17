import type { InputChip } from "lib/types/InputProblem"
import type { Bounds, Point } from "@tscircuit/math-utils"
import Flatbush from "flatbush"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"

export interface SpatiallyIndexedChip extends InputChip {
  bounds: Bounds
  spatialIndexId: number
}

export class ChipObstacleSpatialIndex {
  chips: Array<SpatiallyIndexedChip>
  spatialIndex: Flatbush
  spatialIndexIdToChip: Map<number, SpatiallyIndexedChip>

  constructor(chips: InputChip[]) {
    this.chips = chips.map((chip) => ({
      ...chip,
      bounds: getInputChipBounds(chip),
      spatialIndexId: null as any,
    }))

    this.spatialIndexIdToChip = new Map()
    this.spatialIndex = new Flatbush(chips.length)

    for (const chip of this.chips) {
      chip.spatialIndexId = this.spatialIndex.add(
        chip.bounds.minX,
        chip.bounds.minY,
        chip.bounds.maxX,
        chip.bounds.maxY,
      )
      this.spatialIndexIdToChip.set(chip.spatialIndexId, chip)
    }

    this.spatialIndex.finish()
  }

  getChipsInBounds(bounds: Bounds): Array<InputChip & { bounds: Bounds }> {
    const chipSpatialIndexIds = this.spatialIndex.search(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    )

    return chipSpatialIndexIds.map((id) => this.spatialIndexIdToChip.get(id)!)
  }

  doesOrthogonalLineIntersectChip(
    line: [Point, Point],
    opts: {
      excludeChipIds?: string[]
    } = {},
  ): boolean {
    const excludeChipIds = opts.excludeChipIds ?? []
    const [p1, p2] = line
    const { x: x1, y: y1 } = p1
    const { x: x2, y: y2 } = p2

    const chips = this.getChipsInBounds({
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
    }).filter((chip) => !excludeChipIds.includes(chip.chipId))

    return chips.length > 0
  }
}
