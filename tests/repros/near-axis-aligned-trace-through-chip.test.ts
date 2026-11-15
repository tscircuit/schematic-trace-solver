import { expect, test } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

// SJ2.1 sits at x=5.3999378 while R3.2 sits at x=5.4, so the recovered trace
// between them is skewed by ~6e-5. That is far below the routing grid but far
// above the 1e-9 epsilon used to classify axis-aligned segments, so the segment
// used to match neither fast path in segmentIntersectsRect and was reported as
// colliding with nothing. The trace then ran straight through
// schematic_component_8.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_4",
      center: { x: 5.4, y: 2.4 },
      width: 0.3041465,
      height: 0.9,
      pins: [
        {
          pinId: "SJ2.1",
          x: 5.3999378,
          y: 1.9499999999999997,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: { x: 5.555, y: 1.2 },
      width: 1.21,
      height: 0.6,
      pins: [{ pinId: "R3.2", x: 5.4, y: 1.5, _facingDirection: "y+" }],
    },
    {
      chipId: "schematic_component_8",
      center: { x: 5.555, y: 1.2 },
      width: 0.555,
      height: 0.9,
      pins: [],
    },
  ],
  directConnections: [
    { pinIds: ["SJ2.1", "R3.2"], netId: ".SJ2 > .pin1 to .R3 > .pin2" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
} as unknown as InputProblem

test("a nearly-vertical segment still collides with a rect it passes through", () => {
  const chipRect = { minX: 5.2775, maxX: 5.8325, minY: 0.75, maxY: 1.65 }
  const skewedStart = { x: 5.3999378, y: 1.9499999999999997 }
  const skewedEnd = { x: 5.4, y: 1.5000000000000004 }

  expect(segmentIntersectsRect(skewedStart, skewedEnd, chipRect)).toBe(true)
  // A truly diagonal segment is still out of scope for this test.
  expect(
    segmentIntersectsRect({ x: 0, y: 0 }, { x: 100, y: 100 }, chipRect),
  ).toBe(false)
})

test("recovered traces do not run through a chip they do not terminate on", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const blockingChip = inputProblem.chips.find(
    (chip) => chip.chipId === "schematic_component_8",
  )!
  const minX = blockingChip.center.x - blockingChip.width / 2
  const maxX = blockingChip.center.x + blockingChip.width / 2
  const minY = blockingChip.center.y - blockingChip.height / 2
  const maxY = blockingChip.center.y + blockingChip.height / 2
  const margin = 1e-3

  for (const trace of traces) {
    for (let index = 0; index + 1 < trace.tracePath.length; index++) {
      const start = trace.tracePath[index]!
      const end = trace.tracePath[index + 1]!
      const crossesChipInterior =
        Math.max(start.x, end.x) > minX + margin &&
        Math.min(start.x, end.x) < maxX - margin &&
        Math.max(start.y, end.y) > minY + margin &&
        Math.min(start.y, end.y) < maxY - margin
      expect(crossesChipInterior).toBe(false)
    }
  }
})
