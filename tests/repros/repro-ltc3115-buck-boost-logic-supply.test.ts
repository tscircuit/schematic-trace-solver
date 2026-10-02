import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-ltc3115-buck-boost-logic-supply.input.json"

test("reproduces LTC3115 buck-boost logic supply routing", async () => {
  const solver = new SchematicTracePipelineSolver(
    input as unknown as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  // Baseline: the explicitly wired R_FF -> C_FF connection becomes two
  // inline terminal stubs before the final trace recovery stage can see it.
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    output.traces.some((trace) =>
      ["R_FF.2", "C_FF.1"].every((pinId) => trace.pinIds.includes(pinId)),
    ),
  ).toBe(false)
  expect(
    output.inlineNetLabelPlacements.filter(
      (label) => label.netId === "FF_C" && label.stubTracePath,
    ),
  ).toHaveLength(2)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("buck-boost fixture assigns every terminal to exactly one named net", () => {
  const pinIds = input.chips.flatMap((chip) =>
    chip.pins.map((pin) => pin.pinId),
  )
  const netByPin = new Map<string, string>()
  for (const net of input.netConnections) {
    for (const pinId of net.pinIds) {
      expect(netByPin.has(pinId)).toBe(false)
      netByPin.set(pinId, net.netId)
    }
  }
  expect(new Set(pinIds).size).toBe(53)
  expect([...netByPin.keys()].sort()).toEqual([...pinIds].sort())
  for (const connection of input.directConnections) {
    for (const pinId of connection.pinIds) {
      expect(netByPin.get(pinId)).toBe(connection.netId)
    }
  }
})
