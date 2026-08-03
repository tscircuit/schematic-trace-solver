import { expect, test } from "bun:test"
import { calculateAlignedOrthogonalRoute } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/calculateDirectShortPath"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

const pin = (
  pinId: string,
  x: number,
  y: number,
  _facingDirection: "x+" | "x-" | "y+" | "y-",
): MspConnectionPair["pins"][number] => ({
  pinId,
  chipId: pinId,
  x,
  y,
  _facingDirection,
})

test("puts the short jog beside the vertical-facing pin", () => {
  const crystalPin = pin("Y1.1", -0.55, 0, "x-")
  const capacitorPin = pin("C19.1", -0.55, -1.14, "y+")

  expect(calculateAlignedOrthogonalRoute(crystalPin, capacitorPin)).toEqual([
    { x: -0.55, y: 0 },
    { x: -0.75, y: 0 },
    { x: -0.75, y: -0.94 },
    { x: -0.55, y: -0.94 },
    { x: -0.55, y: -1.14 },
  ])
})

test("is independent of endpoint order", () => {
  const crystalPin = pin("Y1.2", 0.55, 0, "x+")
  const capacitorPin = pin("C20.1", 0.55, -1.14, "y+")

  expect(calculateAlignedOrthogonalRoute(capacitorPin, crystalPin)).toEqual([
    { x: 0.55, y: -1.14 },
    { x: 0.55, y: -0.94 },
    { x: 0.75, y: -0.94 },
    { x: 0.75, y: 0 },
    { x: 0.55, y: 0 },
  ])
})

test("supports horizontal alignment", () => {
  const sidePin = pin("U1.1", 0, 0.5, "y+")
  const axisFacingPin = pin("R1.1", 1.2, 0.5, "x-")

  expect(calculateAlignedOrthogonalRoute(sidePin, axisFacingPin)).toEqual([
    { x: 0, y: 0.5 },
    { x: 0, y: 0.7 },
    { x: 1, y: 0.7 },
    { x: 1, y: 0.5 },
    { x: 1.2, y: 0.5 },
  ])
})

test("leaves parallel-facing aligned pins to the regular router", () => {
  expect(
    calculateAlignedOrthogonalRoute(
      pin("U1.1", 0, 0, "y-"),
      pin("C1.1", 0, -1, "y+"),
    ),
  ).toBeNull()
})
