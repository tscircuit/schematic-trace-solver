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
  spatialIndex: Flatbush | null = null
  spatialIndexIdToChip: Map<number, SpatiallyIndexedChip>

  constructor(chips: InputChip[]) {
    this.chips = chips.map((chip) => ({
      ...chip,
      bounds: getInputChipBounds(chip),
      spatialIndexId: null as any,
    }))

    this.spatialIndexIdToChip = new Map()

    if (chips.length === 0) return

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
    if (!this.spatialIndex) return []
    const chipSpatialIndexIds = this.spatialIndex.search(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    )

    return chipSpatialIndexIds.map((id) => this.spatialIndexIdToChip.get(id)!)
  }

  private _lineIntersectsRect(p1: Point, p2: Point, rect: Bounds): boolean {
    let t0 = 0
    let t1 = 1
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y

    const check = (p: number, q: number) => {
      if (Math.abs(p) < 1e-9) {
        if (q < 0) return false
        return true
      }
      const t = q / p
      if (p < 0) {
        if (t > t1) return false
        if (t > t0) t0 = t
      } else {
        if (t < t0) return false
        if (t < t1) t1 = t
      }
      return true
    }

    if (!check(-dx, p1.x - rect.minX)) return false
    if (!check(dx, rect.maxX - p1.x)) return false
    if (!check(-dy, p1.y - rect.minY)) return false
    if (!check(dy, rect.maxY - p1.y)) return false

    return t0 < t1
  }

  hasObstacleAlongLine(
    p1: Point,
    p2: Point,
    opts: {
      excludeChipIds?: string[]
    } = {},
  ): boolean {
    const excludeChipIds = opts.excludeChipIds ?? []
    const chipsInBounds = this.getChipsInBounds({
      minX: Math.min(p1.x, p2.x),
      minY: Math.min(p1.y, p2.y),
      maxX: Math.max(p1.x, p2.x),
      maxY: Math.max(p1.y, p2.y),
    }).filter((chip) => !excludeChipIds.includes(chip.chipId))

    for (const chip of chipsInBounds) {
      if (this._lineIntersectsRect(p1, p2, chip.bounds)) {
        return true
      }
    }
    return false
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
