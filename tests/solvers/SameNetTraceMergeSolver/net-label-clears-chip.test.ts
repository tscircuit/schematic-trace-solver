import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import cc2340r5 from "../../repros/assets/repro-cc2340r5.input.json"

const EPS = 1e-6

interface Rect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function rectFromCenter(
  c: { x: number; y: number },
  w: number,
  h: number,
): Rect {
  return {
    minX: c.x - w / 2,
    maxX: c.x + w / 2,
    minY: c.y - h / 2,
    maxY: c.y + h / 2,
  }
}

/** Positive-area overlap (a hair of EPS slack so coincident edges don't count). */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.minX < b.maxX - EPS &&
    a.maxX > b.minX + EPS &&
    a.minY < b.maxY - EPS &&
    a.maxY > b.minY + EPS
  )
}

/**
 * Regression for the #546 review ("label overlap with box"): when the
 * SameNetTraceMergeSolver collapses a same-net U-detour that carries a net-label
 * anchor, it relocates the label box onto the straightened segment. The detour's
 * outward bulge is what gives the label its clearance from the chip, so the
 * relocation must NOT drag the label box onto a component (chip) box.
 */
test("merge phase keeps relocated net-label boxes clear of chip boxes (cc2340r5)", () => {
  const solver = new SchematicTracePipelineSolver(cc2340r5 as any)
  solver.solve()

  const merge = solver.sameNetTraceMergeSolver
  expect(merge).toBeDefined()

  const { netLabelPlacements } = merge!.getOutput()
  // Use the pipeline's corrected chips (expandChipsToFitPins grows the box to
  // fit pins), NOT the raw input — that expanded box is what renders and what
  // the relocation must clear.
  const chips = solver.inputProblem.chips

  const collisions: string[] = []
  for (const label of netLabelPlacements) {
    const labelBox = rectFromCenter(label.center, label.width, label.height)
    for (const chip of chips) {
      const chipBox = rectFromCenter(chip.center, chip.width, chip.height)
      if (rectsOverlap(labelBox, chipBox)) {
        collisions.push(
          `${label.netId ?? label.globalConnNetId} overlaps ${chip.chipId}`,
        )
      }
    }
  }

  expect(collisions).toEqual([])
})
