import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/inline-net-label02.json"
import "tests/fixtures/matcher"

// Real geometry from @tscircuit/core: a soic8 and an 0603 LED 3 units apart.
// The label (width 1.8) is longer than every straight run of the routed trace
// (~0.95), so it must overhang - sliding along the run to clear both chip
// boxes rather than giving up and falling back to an anchored label.
test("inline-net-label02 overhangs a short run instead of falling back", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const placements = solver.inlineNetLabelSolver!.inlineNetLabelPlacements
  expect(placements.map((p) => p.netId)).toEqual(["USER_LED_ANODE"])

  const [placement] = placements
  expect(placement!.axis).toBe("x")

  // The label never sits on top of a chip.
  const labelBounds = {
    minX: placement!.center.x - placement!.width / 2,
    maxX: placement!.center.x + placement!.width / 2,
    minY: placement!.center.y - placement!.height / 2,
    maxY: placement!.center.y + placement!.height / 2,
  }
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
