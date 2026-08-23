import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/inline-net-label-two-pin-net.json"
import "tests/fixtures/matcher"

test("two-pin named nets use a routed inline label or two terminal stubs", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const routedPlacements = output.inlineNetLabelPlacements.filter(
    (placement) => placement.netId === "NET_ROUTED",
  )
  const sectionedPlacements = output.inlineNetLabelPlacements.filter(
    (placement) => placement.netId === "NET_SECTIONED",
  )

  expect(routedPlacements).toHaveLength(1)
  expect(routedPlacements[0]!.pinIds).toHaveLength(2)
  expect(routedPlacements[0]!.stubTracePath).toBeUndefined()

  expect(sectionedPlacements).toHaveLength(2)
  expect(
    sectionedPlacements.every(
      (placement) =>
        placement.pinIds.length === 1 && placement.stubTracePath?.length === 2,
    ),
  ).toBe(true)
  expect(output.netLabelPlacements).toHaveLength(0)
  expect(
    output.traces.filter((trace) =>
      trace.mspPairId.startsWith("available-net-orientation-"),
    ),
  ).toHaveLength(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
