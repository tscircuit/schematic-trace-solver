import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/example51.json"

test("example51 connects every NET_03 branch without fallback labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  const output = solver.netLabelToSameNetTraceSolver!.getOutput()
  const net03Labels = output.netLabelPlacements.filter(
    (label) => label.globalConnNetId === "connectivity_net11",
  )

  expect(net03Labels).toHaveLength(0)
})
