import { NetLabelToTraceSolver } from "lib/solvers/NetLabelToTraceSolver/NetLabelToTraceSolver"
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
test("ENC_SCL routes across SDA instead of becoming two endpoint labels", () => {
  const solver = solve(input as unknown as InputProblem)
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    output.traces.some((trace) =>
      ["R_ENC_SDA.2", "U_ENCODER.6"].every((pinId) =>
        trace.pinIds.includes(pinId),
      ),
    ),
  ).toBe(true)
  expect(hasSclTrace(solver)).toBe(true)
  expect(
    output.netLabelPlacements.filter(
      (label) => label.netId === "ENC_SCL" && label.pinIds.length === 1,
    ),
  ).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("ENC_SCL recovers exactly one interior crossing of SDA", () => {
  const solver = solve(input as unknown as InputProblem)
  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const scl = traces.find((trace) =>
    sclPins.every((pinId) => trace.pinIds.includes(pinId)),
  )!
  const sda = traces.find((trace) => trace.pinIds.includes("R_ENC_SDA.2"))!
  expect(
    findPerpendicularPathCrossings(scl.tracePath, sda.tracePath, {
      includeTerminalSegments: true,
    }),
  ).toHaveLength(1)
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

test("ENC_SCL keeps labels when its elbow is blocked by a component", () => {
  const problem = structuredClone(input) as unknown as InputProblem
  problem.chips.push({
    chipId: "BLOCKER",
    center: { x: 2, y: 0.7 },
    width: 0.5,
    height: 0.5,
    pins: [],
  })
  expect(hasSclTrace(solve(problem))).toBe(false)
})

test("ENC_SCL keeps labels across schematic sections", () => {
  const problem = structuredClone(input) as unknown as InputProblem
  problem.chips.find((chip) => chip.chipId === "R_ENC_SCL")!.sectionId =
    "pullups"
  problem.chips.find((chip) => chip.chipId === "U_ENCODER")!.sectionId =
    "encoder"
  expect(hasSclTrace(solve(problem))).toBe(false)
})

// Test the recovery stage directly so earlier routing cannot remove the obstacle.
test("ENC_SCL keeps labels when its elbow would require two hops", () => {
  const pipeline = solve(input as unknown as InputProblem)
  const stageInput = pipeline.netLabelToTraceSolver!.getConstructorParams()[0]
  const sda = pipeline
    .netLabelToTraceSolver!.getOutput()
    .traces.find((trace) => trace.pinIds.includes("R_ENC_SDA.2"))!
  const secondCrossing = {
    ...sda,
    mspPairId: "second-crossing",
    globalConnNetId: "other-net",
    tracePath: [
      { x: 0, y: 0.7 },
      { x: 4.72, y: 0.7 },
    ],
  }
  const solver = new NetLabelToTraceSolver({
    ...stageInput,
    traces: [...stageInput.traces, sda, secondCrossing],
    netLabelPlacements: stageInput.netLabelPlacements.filter(
      (label) => label.netId !== "ENC_SDA",
    ),
  })
  solver.solve()
  expect(
    solver
      .getOutput()
      .netLabelPlacements.filter((label) => label.netId === "ENC_SCL"),
  ).toHaveLength(2)
})

test("ground nets keep endpoint labels instead of elbow recovery", () => {
  const problem = structuredClone(input) as unknown as InputProblem
  problem.netConnections.find((net) => net.netId === "ENC_SCL")!.isGround = true
  expect(hasSclTrace(solve(problem))).toBe(false)
})
