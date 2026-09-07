import { expect, test } from "bun:test"
import { estimateInlineNetLabelWidth } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./bug-report-20260826T072956Z.json"
import "tests/fixtures/matcher"

const multiPinSignalNetIds = [
  "ISNS_A",
  "ISNS_B",
  "ISNS_C",
  "MOT_A",
  "MOT_B",
  "MOT_C",
  "S1_N",
  "S1_P",
  "S2_N",
  "S2_P",
  "S3_N",
  "S3_P",
  "SL_A",
  "SL_B",
  "SL_C",
]

test("bug-report-20260826T072956Z", () => {
  const problem = structuredClone(inputProblem) as unknown as InputProblem
  for (const connection of problem.netConnections) {
    if (!multiPinSignalNetIds.includes(connection.netId)) continue
    connection.allowInlineNetLabel = true
    connection.inlineNetLabelHeight = 0.12
    connection.inlineNetLabelWidth = estimateInlineNetLabelWidth(
      connection.netId,
      connection.inlineNetLabelHeight,
    )
  }

  const solver = new SchematicTracePipelineSolver(problem, {
    hideRatsNet: true,
  })

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const expectedInlineNetIds = ["GH_B", ...multiPinSignalNetIds]
  expect(
    new Set(
      output.inlineNetLabelPlacements
        .filter((placement) =>
          expectedInlineNetIds.includes(placement.netId ?? ""),
        )
        .map((placement) => placement.netId),
    ),
  ).toEqual(new Set(expectedInlineNetIds))
  expect(
    output.netLabelPlacements.filter((placement) =>
      expectedInlineNetIds.includes(placement.netId ?? ""),
    ),
  ).toHaveLength(0)
  expect(
    output.inlineNetLabelPlacements.some(
      (placement) => placement.netId === "GH_B" && placement.side === "y-",
    ),
  ).toBe(true)
  for (const supersededConnectorTraceId of [
    "schematic_port_152-schematic_port_150",
    "schematic_port_151-schematic_port_148",
    "schematic_port_149-schematic_port_147",
  ]) {
    expect(
      output.traces.some(
        (trace) => trace.mspPairId === supersededConnectorTraceId,
      ),
    ).toBe(false)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
