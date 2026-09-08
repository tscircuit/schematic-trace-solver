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
// Repro only: U_M0 pin4 (GND) and pin9 (EP) are wired together, but their
// generated ground connector moves during alignment without its label.
test("rp2040 robot controller reproduces disconnected GND after junction alignment", () => {
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
    (trace) => trace.mspPairId === "available-net-orientation-42-GND",
  )!
  const afterConnector = after.traces.find(
    (trace) => trace.mspPairId === beforeConnector.mspPairId,
  )!
  expect(
    tracePathContainsPoint(beforeConnector.tracePath, groundLabel.anchorPoint),
  ).toBe(true)
  // Known bug: this should become true when label attachment is fixed.
  expect(
    tracePathContainsPoint(afterConnector.tracePath, groundLabel.anchorPoint),
  ).toBe(false)

  expect(
    convertCircuitJsonToSchematicSvg(convertSolverOutputToCircuitJson(solver), {
      width: 1800,
      height: 1200,
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(import.meta.path)
})
