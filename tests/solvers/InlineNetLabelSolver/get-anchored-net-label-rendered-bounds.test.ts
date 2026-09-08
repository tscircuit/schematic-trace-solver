import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

const createPlacement = (
  overrides: Partial<NetLabelPlacement>,
): NetLabelPlacement => ({
  globalConnNetId: "connectivity_net0",
  mspConnectionPairIds: [],
  pinIds: ["U1.1"],
  orientation: "x-",
  anchorPoint: { x: 2, y: 3 },
  width: 0.42,
  height: 1.2,
  center: { x: 1.79, y: 3 },
  ...overrides,
})

test("orients named vertical tags while preserving width-only placeholders", () => {
  for (const orientation of ["y+", "y-"] as const) {
    const placement = createPlacement({
      orientation,
      width: 1.2,
      height: 0.42,
      center: { x: 2, y: 3 },
    })
    const placeholderBounds = getAnchoredNetLabelRenderedBounds(placement)
    expect(placeholderBounds.maxX - placeholderBounds.minX).toBeCloseTo(1.2)
    expect(placeholderBounds.maxY - placeholderBounds.minY).toBeCloseTo(0.42)

    const namedBounds = getAnchoredNetLabelRenderedBounds({
      ...placement,
      netLabelText: "SUPPLY",
    })
    expect(namedBounds.minX).toBeCloseTo(1.79)
    expect(namedBounds.maxX).toBeCloseTo(2.21)
    expect(namedBounds.maxY - namedBounds.minY).toBeCloseTo(1.2)
    if (orientation === "y+") expect(namedBounds.minY).toBeCloseTo(3)
    else expect(namedBounds.maxY).toBeCloseTo(3)
  }
})

test("uses the horizontal renderer envelope for x-facing labels", () => {
  const horizontalBounds = getAnchoredNetLabelRenderedBounds(
    createPlacement({}),
  )
  expect(horizontalBounds.minX).toBeCloseTo(0.8)
  expect(horizontalBounds.maxX).toBeCloseTo(2)
  expect(horizontalBounds.minY).toBeCloseTo(2.9)
  expect(horizontalBounds.maxY).toBeCloseTo(3.1)

  const verticalBounds = getAnchoredNetLabelRenderedBounds(
    createPlacement({
      orientation: "y+",
      anchorPoint: { x: 2, y: 3 },
      center: { x: 2, y: 3.6 },
    }),
  )
  expect(verticalBounds.minX).toBeCloseTo(1.79)
  expect(verticalBounds.maxX).toBeCloseTo(2.21)
  expect(verticalBounds.minY).toBeCloseTo(3)
  expect(verticalBounds.maxY).toBeCloseTo(4.2)
})
