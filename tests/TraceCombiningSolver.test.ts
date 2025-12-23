import { test, expect } from "bun:test"
import { TraceCombiningSolver } from "../lib/solvers/TraceCombiningSolver/TraceCombiningSolver"
import type { SolvedTracePath } from "../lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "../lib/types/InputProblem"

const mockInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const createMockTrace = (
  id: string,
  netId: string,
  path: { x: number; y: number }[],
): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: "gn" + netId,
  globalConnNetId: netId,
  userNetId: netId,
  pins: [] as any,
  tracePath: path,
  mspConnectionPairIds: [id],
  pinIds: [],
})

test("TraceCombiningSolver should merge parallel horizontal segments", () => {
  const trace1 = createMockTrace("t1", "net1", [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ])
  const trace2 = createMockTrace("t2", "net1", [
    { x: 0, y: 0.2 },
    { x: 10, y: 0.2 },
  ]) // Close, parallel

  const solver = new TraceCombiningSolver({
    inputProblem: mockInputProblem,
    traces: [trace1, trace2],
    threshold: 0.5,
  })

  solver.step()
  const output = solver.getOutput()

  const newTrace1 = output.traces.find((tr) => tr.mspPairId === "t1")!
  const newTrace2 = output.traces.find((tr) => tr.mspPairId === "t2")!

  // They should have been moved to the same Y coordinate
  // They should have been moved to the same Y coordinate
  expect(newTrace1.tracePath[0].y).toBe(newTrace1.tracePath[1].y)
  expect(newTrace2.tracePath[0].y).toBe(newTrace2.tracePath[1].y)
  expect(newTrace1.tracePath[0].y).toBe(newTrace2.tracePath[0].y)
})

test("TraceCombiningSolver should NOT merge distant parallel segments", () => {
  const trace1 = createMockTrace("t1", "net1", [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ])
  const trace2 = createMockTrace("t2", "net1", [
    { x: 0, y: 1.0 },
    { x: 10, y: 1.0 },
  ]) // Distance > 0.5

  const solver = new TraceCombiningSolver({
    inputProblem: mockInputProblem,
    traces: [trace1, trace2],
    threshold: 0.5,
  })

  solver.step()
  const output = solver.getOutput()

  const newTrace1 = output.traces.find((tr) => tr.mspPairId === "t1")!
  const newTrace2 = output.traces.find((tr) => tr.mspPairId === "t2")!

  expect(newTrace1.tracePath[0].y).not.toBe(newTrace2.tracePath[0].y)
})
