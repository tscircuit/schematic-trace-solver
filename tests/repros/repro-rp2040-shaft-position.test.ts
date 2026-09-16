import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-shaft-position.input.json"

// Reconstructed from the published shaft-position section; see the companion README.
test("repro RP2040 shaft-position encoder and pull-up routing", async () => {
  // SDA and SCL are separate source nets even where the reference looks joined.
  expect(
    inputProblem.netConnections.find((net) => net.netId === "ENC_SDA")?.pinIds,
  ).toEqual(["U_ENCODER.6", "R_ENC_SDA.1"])
  expect(
    inputProblem.netConnections.find((net) => net.netId === "ENC_SCL")?.pinIds,
  ).toEqual(["U_ENCODER.7", "R_ENC_SCL.1"])
  const connectedPins = new Set(
    inputProblem.netConnections.flatMap((net) => net.pinIds),
  )
  expect(connectedPins.has("U_ENCODER.3")).toBe(false)
  expect(connectedPins.has("U_ENCODER.5")).toBe(false)

  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
