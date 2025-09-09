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
    margin = 0,
    opts: {
      excludeChipIds?: string[]
      eps?: number
    } = {},
  ): boolean {
    // Fast path when no margin is applied
    if (margin === 0) {
      const excludeChipIds = opts.excludeChipIds ?? []
      const eps = opts.eps ?? 0
      const [p1, p2] = line
      const { x: x1, y: y1 } = p1
      const { x: x2, y: y2 } = p2

      const minX = Math.min(x1, x2)
      const minY = Math.min(y1, y2)
      const maxX = Math.max(x1, x2)
      const maxY = Math.max(y1, y2)

      const chips = this.getChipsInBounds({
        minX: minX - eps,
        minY: minY - eps,
        maxX: maxX + eps,
        maxY: maxY + eps,
      }).filter((chip) => !excludeChipIds.includes(chip.chipId))

      const isVertical = Math.abs(x1 - x2) < eps
      const isHorizontal = Math.abs(y1 - y2) < eps

      for (const chip of chips) {
        const {
          minX: cMinX,
          minY: cMinY,
          maxX: cMaxX,
          maxY: cMaxY,
        } = chip.bounds

        if (isVertical) {
          const x = x1
          if (x <= cMinX + eps || x >= cMaxX - eps) continue
          const overlap = Math.min(maxY, cMaxY) - Math.max(minY, cMinY)
          if (overlap > eps) return true
        } else if (isHorizontal) {
          const y = y1
          if (y <= cMinY + eps || y >= cMaxY - eps) continue
          const overlap = Math.min(maxX, cMaxX) - Math.max(minX, cMinX)
          if (overlap > eps) return true
        }
      }

      return false
    }

    const excludeChipIds = opts.excludeChipIds ?? []
    const eps = opts.eps ?? 0
    const [p1, p2] = line
    const { x: x1, y: y1 } = p1
    const { x: x2, y: y2 } = p2

    const minX = Math.min(x1, x2)
    const minY = Math.min(y1, y2)
    const maxX = Math.max(x1, x2)
    const maxY = Math.max(y1, y2)

    const searchMargin = eps + Math.max(0, margin)

    const chips = this.getChipsInBounds({
      minX: minX - searchMargin,
      minY: minY - searchMargin,
      maxX: maxX + searchMargin,
      maxY: maxY + searchMargin,
    }).filter((chip) => !excludeChipIds.includes(chip.chipId))

    const isVertical = Math.abs(x1 - x2) < eps
    const isHorizontal = Math.abs(y1 - y2) < eps

    for (const chip of chips) {
      const cMinX = chip.bounds.minX - margin
      const cMinY = chip.bounds.minY - margin
      const cMaxX = chip.bounds.maxX + margin
      const cMaxY = chip.bounds.maxY + margin

      if (isVertical) {
        const x = x1
        if (x <= cMinX + eps || x >= cMaxX - eps) continue
        const overlap = Math.min(maxY, cMaxY) - Math.max(minY, cMinY)
        if (overlap > eps) return true
      } else if (isHorizontal) {
        const y = y1
        if (y <= cMinY + eps || y >= cMaxY - eps) continue
        const overlap = Math.min(maxX, cMaxX) - Math.max(minX, cMinX)
        if (overlap > eps) return true
      }
    }

    return false
  }
}
