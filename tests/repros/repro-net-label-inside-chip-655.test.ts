import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "../bug-reports/bug-report-20260707T230831Z/bug-report-20260707T230831Z.json"

// Reproduction for https://github.com/tscircuit/schematic-trace-solver/issues/655
//
// A net label must never render on top of a chip body — it ends up drawn
// behind the component and is illegible. On this board the final placement
// leaves four net labels 100% inside chip bodies:
//
//   VIN                  inside schematic_component_0 (U1)
//   U1.FB to R2.pin1     inside schematic_component_4 (R1)
//   PG                   inside schematic_component_0 (U1)
//   VOUT                 inside schematic_component_6 (R3)
//
// NetLabelNetLabelCollisionSolver only relocates a label when it overlaps
// *another label* (findNextCollidingPair looks for label-label overlaps).
// A label sitting inside a chip without a label-label collision is never
// checked against chips or moved out. Additionally, several chips on this
// board overlap each other, so a pin can be covered by another chip's body —
// port-only labels anchored on such pins collide in every orientation.
//
// This test pins the CURRENT (buggy) behavior so the bug is tracked by CI.
// A fix should flip the assertion to .toEqual([]).
test("repro #655: net labels are placed inside chip bodies", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const chips = solver.inputProblem.chips

  const rectBounds = (
    center: { x: number; y: number },
    width: number,
    height: number,
  ) => ({
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minY: center.y - height / 2,
    maxY: center.y + height / 2,
  })

  const overlapArea = (
    a: { minX: number; maxX: number; minY: number; maxY: number },
    b: { minX: number; maxX: number; minY: number; maxY: number },
  ) => {
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
    const oy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
    return ox > 0 && oy > 0 ? ox * oy : 0
  }

  const labelsInsideChips = labels.filter((label) => {
    const labelBounds = rectBounds(label.center, label.width, label.height)
    const labelArea = label.width * label.height
    return chips.some(
      (chip) =>
        overlapArea(
          labelBounds,
          rectBounds(chip.center, chip.width, chip.height),
        ) >
        labelArea * 0.5,
    )
  })

  // BUG: four labels render fully inside chip bodies
  expect(labelsInsideChips.map((label) => label.netId).sort()).toEqual([
    "PG",
    "U1.FB to R2.pin1",
    "VIN",
    "VOUT",
  ])
})
