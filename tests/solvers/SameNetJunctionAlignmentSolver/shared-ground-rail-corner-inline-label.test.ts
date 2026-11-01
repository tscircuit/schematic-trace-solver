import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import bugReport from "tests/bug-reports/bug-report-20261001T083348Z/bug-report-20261001T083348Z.json"

test("moves a ground label from an interior pin stub to the outer corner of a shared vertical ground rail so adjacent pins can convert to inline net labels", () => {
  const solver = new SchematicTracePipelineSolver(
    bugReport as unknown as InputProblem,
  )
  solver.solve()

  const output = solver.netLabelToTraceSolver?.getOutput()
  expect(output).toBeDefined()

  const gndLabels = (output?.netLabelPlacements ?? []).filter(
    (label) => label.netId === "GND",
  )
  expect(gndLabels.length).toBeGreaterThan(0)
  for (const label of gndLabels) {
    expect(label.orientation).toBe("y-")
  }

  const sharedBusGnd = gndLabels.find((label) =>
    label.pinIds.includes("schematic_port_7"),
  )
  expect(sharedBusGnd).toBeDefined()
  expect(sharedBusGnd!.orientation).toBe("y-")
  expect(sharedBusGnd!.anchorPoint.y).toBeCloseTo(-0.6, 5)
  expect(sharedBusGnd!.anchorPoint.x).toBeLessThan(-2.0)

  const inlineOutput = solver.inlineNetLabelSolver?.getOutput()
  const port8Inline = (inlineOutput?.inlineNetLabelPlacements ?? []).find(
    (label) => label.pinIds.includes("schematic_port_8"),
  )
  expect(port8Inline).toBeDefined()
  expect(port8Inline!.netLabelText).toBe("U1_IN0A")
})
