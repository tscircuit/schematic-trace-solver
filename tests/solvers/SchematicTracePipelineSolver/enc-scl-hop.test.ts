import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"
import input from "../../assets/enc-scl-hop.json"
import "tests/fixtures/matcher"

const sclPins = ["R_ENC_SCL.2", "U_ENCODER.7"]
const solve = (problem: InputProblem) => {
  const solver = new SchematicTracePipelineSolver(problem, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  return solver
}
const hasSclTrace = (solver: SchematicTracePipelineSolver) =>
  solver
    .netLabelToTraceSolver!.getOutput()
    .traces.some((trace) =>
      sclPins.every((pinId) => trace.pinIds.includes(pinId)),
    )

// Geometry reconstructed from the ENC_SCL screenshot, not an exported input.
// SDA is explicitly wired; SCL is connected through its named net.
test("ENC_SCL reproduction: SDA routes but SCL becomes two labels", () => {
  const solver = solve(input as unknown as InputProblem)
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    output.traces.some((trace) =>
      ["R_ENC_SDA.2", "U_ENCODER.6"].every((pinId) =>
        trace.pinIds.includes(pinId),
      ),
    ),
  ).toBe(true)
  expect(hasSclTrace(solver)).toBe(false)
  expect(
    output.netLabelPlacements.filter(
      (label) => label.netId === "ENC_SCL" && label.pinIds.length === 1,
    ),
  ).toHaveLength(2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test.failing("ENC_SCL should keep a continuous hop instead of endpoint labels", () => {
  expect(hasSclTrace(solve(input as unknown as InputProblem))).toBe(true)
})

test("ENC_SCL control: explicit wiring produces the available hop", () => {
  const problem = structuredClone(input) as unknown as InputProblem
  problem.directConnections.push({
    pinIds: [sclPins[0]!, sclPins[1]!],
    netId: "ENC_SCL",
  })
  const solver = solve(problem)
  expect(hasSclTrace(solver)).toBe(true)
  const output = solver.netLabelToTraceSolver!.getOutput()
  const scl = output.traces.find((trace) =>
    sclPins.every((pinId) => trace.pinIds.includes(pinId)),
  )!
  const sda = output.traces.find((trace) =>
    trace.pinIds.includes("R_ENC_SDA.2"),
  )!
  expect(
    findPerpendicularPathCrossings(scl.tracePath, sda.tracePath, {
      includeTerminalSegments: true,
    }),
  ).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path, "explicit-hop")
})
