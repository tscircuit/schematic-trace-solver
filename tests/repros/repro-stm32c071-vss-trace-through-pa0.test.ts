import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-stm32c071-vss-trace-through-pa0.input.json"
import "tests/fixtures/matcher"

/**
 * STM32C071 MCU with a 100n decoupling capacitor to its left.
 *
 * C_MCU.2 -> U_MCU.5 (VSS) is routed as an elbow whose vertical segment sits at
 * the horizontal midpoint between the capacitor and the chip. That vertical
 * segment runs straight through the SWD_NRST net label (attached to U_MCU.6 /
 * PF2, pointing "x-") and past the PA0 pin row, so the trace visually crosses
 * both the label and the pin lead.
 */

interface Point {
  x: number
  y: number
}
interface Rect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const EPS = 1e-9

const rectFromCenter = (
  center: Point,
  width: number,
  height: number,
): Rect => ({
  minX: center.x - width / 2,
  maxX: center.x + width / 2,
  minY: center.y - height / 2,
  maxY: center.y + height / 2,
})

const segmentIntersectsRect = (a: Point, b: Point, rect: Rect) => {
  if (Math.abs(a.x - b.x) < EPS) {
    const overlap =
      Math.min(Math.max(a.y, b.y), rect.maxY) -
      Math.max(Math.min(a.y, b.y), rect.minY)
    return a.x >= rect.minX - EPS && a.x <= rect.maxX + EPS && overlap > EPS
  }

  if (Math.abs(a.y - b.y) < EPS) {
    const overlap =
      Math.min(Math.max(a.x, b.x), rect.maxX) -
      Math.max(Math.min(a.x, b.x), rect.minX)
    return a.y >= rect.minY - EPS && a.y <= rect.maxY + EPS && overlap > EPS
  }

  return false
}

const pathIntersectsRect = (path: Point[], rect: Rect) =>
  path.some((point, index) => {
    if (index === 0) return false
    return segmentIntersectsRect(path[index - 1]!, point, rect)
  })

/** Rect covering the lead drawn between a pin and the body of its chip. */
const getPinLeadRect = (pinId: string, leadLength = 0.2): Rect => {
  const chip = (inputProblem as any).chips.find((c: any) =>
    c.pins.some((p: any) => p.pinId === pinId),
  )
  const pin = chip.pins.find((p: any) => p.pinId === pinId)
  const outward = pin.x < chip.center.x ? -1 : 1
  const leadEndX = pin.x + outward * leadLength
  return {
    minX: Math.min(pin.x, leadEndX),
    maxX: Math.max(pin.x, leadEndX),
    minY: pin.y - EPS,
    maxY: pin.y + EPS,
  }
}

test("repro stm32c071 VSS trace crosses PA0 and the SWD_NRST net label", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)

  const { traces, netLabelPlacements } =
    solver.sameNetJunctionAlignmentSolver!.getOutput()

  const vssTrace = traces.find(
    (trace: any) =>
      trace.mspPairId === "C_MCU.2-U_MCU.5" ||
      trace.mspPairId === "U_MCU.5-C_MCU.2",
  )
  expect(vssTrace).toBeDefined()

  const swdNrstLabel = netLabelPlacements.find(
    (placement: any) => placement.netId === "SWD_NRST",
  )
  expect(swdNrstLabel).toBeDefined()

  const swdNrstRect = rectFromCenter(
    swdNrstLabel!.center,
    swdNrstLabel!.width,
    swdNrstLabel!.height,
  )

  // The VSS trace must not run through the SWD_NRST net label
  expect(pathIntersectsRect(vssTrace!.tracePath, swdNrstRect)).toBe(false)

  // ...nor through the PA0 (U_MCU.7) pin lead
  expect(
    pathIntersectsRect(vssTrace!.tracePath, getPinLeadRect("U_MCU.7")),
  ).toBe(false)
})
