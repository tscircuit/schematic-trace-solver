import { expect, test } from "bun:test"
import { NetLabelToTraceSolver } from "lib/solvers/NetLabelToTraceSolver/NetLabelToTraceSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import input from "../../repros/assets/repro-ltc3115-buck-boost-logic-supply.input.json"

const feedForwardPins = ["R_FF.2", "C_FF.1"]

const getStageInput = () => {
  const pipeline = new SchematicTracePipelineSolver(
    input as unknown as InputProblem,
  )
  pipeline.solveUntilPhase("inlineDirectTraceRecoverySolver")
  return {
    inputProblem: pipeline.inputProblem,
    ...pipeline.sameNetJunctionAlignmentSolver!.getOutput(),
    inlineNetLabelPlacements: [],
    netLabelConnectorTraceIds:
      pipeline.availableNetOrientationSolver!.netLabelConnectorTraceIds,
  }
}

const hasRecoveredWire = (solver: NetLabelToTraceSolver) =>
  solver
    .getOutput()
    .traces.some((trace) =>
      feedForwardPins.every((pinId) => trace.pinIds.includes(pinId)),
    )

test("pre-inline recovery honors net-level inline opt-in on explicit wires", () => {
  const stageInput = getStageInput()
  stageInput.inputProblem.directConnections.find(
    (c) => c.netId === "FF_C",
  )!.allowInlineNetLabel = false
  const solver = new NetLabelToTraceSolver(stageInput, {
    onlyInlineDirectConnections: true,
  })
  solver.solve()
  expect(hasRecoveredWire(solver)).toBe(true)
  expect(solver.stats.recoveredTraceCount).toBe(1)
})

test("pre-inline recovery leaves net-only connectivity to the final stage", () => {
  const stageInput = getStageInput()
  stageInput.inputProblem.directConnections =
    stageInput.inputProblem.directConnections.filter((c) => c.netId !== "FF_C")
  const solver = new NetLabelToTraceSolver(stageInput, {
    onlyInlineDirectConnections: true,
  })
  solver.solve()
  expect(hasRecoveredWire(solver)).toBe(false)
  expect(solver.stats.candidateCount).toBe(0)
})

test("pre-inline recovery leaves connections without inline opt-in alone", () => {
  const stageInput = getStageInput()
  for (const c of [
    ...stageInput.inputProblem.directConnections,
    ...stageInput.inputProblem.netConnections,
  ]) {
    if (c.netId === "FF_C") c.allowInlineNetLabel = false
  }
  const solver = new NetLabelToTraceSolver(stageInput, {
    onlyInlineDirectConnections: true,
  })
  solver.solve()
  expect(hasRecoveredWire(solver)).toBe(false)
  expect(solver.stats.candidateCount).toBe(0)
})

test("pre-inline recovery retains both fallback labels when another label blocks the wire", () => {
  const stageInput = getStageInput()
  stageInput.netLabelPlacements.push({
    globalConnNetId: "blocker-net",
    netId: "BLOCKER",
    netLabelText: "BLOCKER",
    mspConnectionPairIds: [],
    pinIds: [],
    orientation: "x+",
    anchorPoint: { x: 3.5, y: -1.236111 },
    center: { x: 3.75, y: -1.236111 },
    width: 0.5,
    height: 0.2,
  })
  const solver = new NetLabelToTraceSolver(stageInput, {
    onlyInlineDirectConnections: true,
  })
  solver.solve()
  expect(hasRecoveredWire(solver)).toBe(false)
  expect(solver.stats.candidateCount).toBe(1)
  expect(
    solver.getOutput().netLabelPlacements.filter((l) => l.netId === "FF_C"),
  ).toHaveLength(2)
})

test("pre-inline recovery respects schematic section boundaries", () => {
  const stageInput = getStageInput()
  stageInput.inputProblem.chips.find((c) => c.chipId === "R_FF")!.sectionId =
    "a"
  stageInput.inputProblem.chips.find((c) => c.chipId === "C_FF")!.sectionId =
    "b"
  const solver = new NetLabelToTraceSolver(stageInput, {
    onlyInlineDirectConnections: true,
  })
  solver.solve()
  expect(hasRecoveredWire(solver)).toBe(false)
  expect(solver.stats.candidateCount).toBe(0)
})
