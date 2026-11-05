import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

const EPS = 1e-9

type Bounds = { minX: number; maxX: number; minY: number; maxY: number }

const boundsOf = (
  center: { x: number; y: number },
  width: number,
  height: number,
): Bounds => ({
  minX: center.x - width / 2,
  maxX: center.x + width / 2,
  minY: center.y - height / 2,
  maxY: center.y + height / 2,
})

/** Interior overlap: touching edges are not an overlap. */
const overlaps = (a: Bounds, b: Bounds) =>
  a.minX < b.maxX - EPS &&
  a.maxX > b.minX + EPS &&
  a.minY < b.maxY - EPS &&
  a.maxY > b.minY + EPS

/**
 * Fraction of `inner`'s area covered by `outer`.
 */
const coverageFraction = (inner: Bounds, outer: Bounds) => {
  const overlapWidth = Math.max(
    0,
    Math.min(inner.maxX, outer.maxX) - Math.max(inner.minX, outer.minX),
  )
  const overlapHeight = Math.max(
    0,
    Math.min(inner.maxY, outer.maxY) - Math.max(inner.minY, outer.minY),
  )
  const area = (inner.maxX - inner.minX) * (inner.maxY - inner.minY)

  return area > 0 ? (overlapWidth * overlapHeight) / area : 0
}

/**
 * Mirrors `CHIP_COLLISION_MIN_OVERLAP_FRACTION` in
 * `NetLabelNetLabelCollisionSolver`: a label counts as "inside" a chip only
 * once the chip covers at least half of it. Smaller incidental overlaps are
 * tolerated there deliberately, so counting them would report defects the
 * solver is intentionally leaving alone.
 */
const INSIDE_CHIP_MIN_COVERAGE = 0.5

/**
 * Net labels substantially covered by a chip body. These render behind the
 * component and are illegible — see #655.
 */
export const getLabelsInsideChips = (
  labels: NetLabelPlacement[],
  inputProblem: InputProblem,
) => {
  const offenders: Array<{ netId: string; chipId: string }> = []

  for (const label of labels) {
    const labelBounds = boundsOf(label.center, label.width, label.height)

    for (const chip of inputProblem.chips) {
      const chipBounds = boundsOf(chip.center, chip.width, chip.height)
      if (
        !overlaps(labelBounds, chipBounds) ||
        coverageFraction(labelBounds, chipBounds) < INSIDE_CHIP_MIN_COVERAGE
      ) {
        continue
      }
      offenders.push({
        netId: label.netId ?? label.globalConnNetId,
        chipId: chip.chipId,
      })
      break
    }
  }

  return offenders
}

/** Pairs of net labels whose boxes overlap each other. */
export const getOverlappingLabelPairs = (labels: NetLabelPlacement[]) => {
  const pairs: Array<{ a: string; b: string }> = []

  for (let i = 0; i < labels.length; i++) {
    for (let k = i + 1; k < labels.length; k++) {
      const a = labels[i]!
      const b = labels[k]!
      if (
        !overlaps(
          boundsOf(a.center, a.width, a.height),
          boundsOf(b.center, b.width, b.height),
        )
      ) {
        continue
      }
      pairs.push({
        a: a.netId ?? a.globalConnNetId,
        b: b.netId ?? b.globalConnNetId,
      })
    }
  }

  return pairs
}
