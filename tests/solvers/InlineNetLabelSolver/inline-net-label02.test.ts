import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/inline-net-label02.json"
import "tests/fixtures/matcher"

// Real geometry from @tscircuit/core: a soic8 and an 0603 LED 3 units apart.
// The label (width 1.8) is longer than every straight run of the routed trace
// (~0.95), but the route is straight except for a 0.3-unit elbow jog, so the
// name is centered over the route's overall span - bridging the jog - instead
// of falling back to an anchored label.
test("inline-net-label02 spans a route with a small jog", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const placements = solver.inlineNetLabelSolver!.inlineNetLabelPlacements
  expect(placements.map((p) => p.netId)).toEqual(["USER_LED_ANODE"])

  const [placement] = placements
  expect(placement!.axis).toBe("x")

  const labelBounds = {
    minX: placement!.center.x - placement!.width / 2,
    maxX: placement!.center.x + placement!.width / 2,
    minY: placement!.center.y - placement!.height / 2,
    maxY: placement!.center.y + placement!.height / 2,
  }

  // The label stays within the route's endpoints - no floating overhang.
  const trace = solver.inlineNetLabelSolver!.traces.find(
    (t) => t.mspPairId === placement!.mspPairId,
  )!
  const routeMinX = Math.min(...trace.tracePath.map((p) => p.x))
  const routeMaxX = Math.max(...trace.tracePath.map((p) => p.x))
  const routeMaxY = Math.max(...trace.tracePath.map((p) => p.y))
  expect(labelBounds.minX).toBeGreaterThanOrEqual(routeMinX - 1e-9)
  expect(labelBounds.maxX).toBeLessThanOrEqual(routeMaxX + 1e-9)

  // It sits clear of the route's full perpendicular extent (above every jog).
  expect(labelBounds.minY).toBeGreaterThan(routeMaxY)

  // And never on top of a chip.
  for (const chip of (inputProblem as any).chips) {
    const chipBounds = {
      minX: chip.center.x - chip.width / 2,
      maxX: chip.center.x + chip.width / 2,
      minY: chip.center.y - chip.height / 2,
      maxY: chip.center.y + chip.height / 2,
    }
    const overlaps =
      labelBounds.minX < chipBounds.maxX &&
      labelBounds.maxX > chipBounds.minX &&
      labelBounds.minY < chipBounds.maxY &&
      labelBounds.maxY > chipBounds.minY
    expect(overlaps).toBe(false)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
