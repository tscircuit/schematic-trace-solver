import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import { readFileSync } from "node:fs"

const inputProblem: InputProblem = JSON.parse(
  readFileSync(
    new URL("./assets/rp2040-robot-controller.input.json", import.meta.url),
    "utf8",
  ),
)

// Captured from core rendering https://tscircuit.com/mohan-bee/rp2040-robot-controller.
// U_M0 pin4 (GND) and pin9 (EP) share a generated ground-label connector.
test("rp2040 robot controller keeps GND connected after junction alignment", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const before = solver.netLabelNetLabelCollisionSolver!
  const after = solver.inlineNetLabelSolver!.getOutput()
  const groundLabel = after.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_162"),
  )!
  const beforeConnector = before.traces.find(
    (trace) =>
      solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
        trace.mspPairId,
      ) && trace.pinIds.includes("schematic_port_162"),
  )!
  const afterConnector = after.traces.find(
    (trace) => trace.mspPairId === beforeConnector.mspPairId,
  )!
  const beforeGroundLabel = before
    .getOutput()
    .netLabelPlacements.find((label) =>
      label.pinIds.includes("schematic_port_162"),
    )!
  expect(
    tracePathContainsPoint(
      beforeConnector.tracePath,
      beforeGroundLabel.anchorPoint,
    ),
  ).toBe(true)
  expect(
    tracePathContainsPoint(afterConnector.tracePath, groundLabel.anchorPoint),
  ).toBe(true)

  expect(
    convertCircuitJsonToSchematicSvg(convertSolverOutputToCircuitJson(solver), {
      width: 1000,
      height: 800,
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(import.meta.path)
})
