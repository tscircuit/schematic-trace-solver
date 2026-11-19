import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import inputProblem from "tests/repros/assets/repro-focusbeam-direct-connection-788.input.json"
import "tests/fixtures/matcher"
import { getTraceLabelCollisions } from "tests/fixtures/traceLabelCollisions"

test("FocusBeam #788 routes R21.pin2 to P1.A6 without orphan fallback label or text collision", () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(inputProblem) as unknown as InputProblem,
  )

  solver.solve()

  expect(solver.schematicTraceLinesSolver!.failedConnectionPairs).toHaveLength(
    0,
  )

  const output = solver.netLabelToTraceSolver!.getOutput()
  const directTrace = output.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_18") &&
      trace.pinIds.includes("schematic_port_30"),
  )
  expect(directTrace).toBeDefined()

  const textBounds = (inputProblem.textBoxes ?? []).map((textBox) =>
    getTextBoxBounds(textBox),
  )
  expect(isPathCollidingWithObstacles(directTrace!.tracePath, textBounds)).toBe(
    false,
  )

  expect(
    output.netLabelPlacements.some((placement) =>
      placement.pinIds.includes("schematic_port_18"),
    ),
  ).toBe(false)
  expect(
    getTraceLabelCollisions(output.traces, output.netLabelPlacements),
  ).toHaveLength(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
