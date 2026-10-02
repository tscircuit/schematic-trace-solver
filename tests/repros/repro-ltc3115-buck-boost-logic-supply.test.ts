import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
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

  // Recover the explicit feed-forward wire before converting its labels.
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    output.traces.some((trace) =>
      ["R_FF.2", "C_FF.1"].every((pinId) => trace.pinIds.includes(pinId)),
    ),
  ).toBe(true)
  expect(
    output.inlineNetLabelPlacements.filter(
      (label) => label.netId === "FF_C" && label.stubTracePath,
    ),
  ).toHaveLength(0)
  expect(
    output.inlineNetLabelPlacements.filter((label) => label.netId === "FF_C"),
  ).toHaveLength(1)
  // The divider, feed-forward capacitor, and compensation capacitor form
  // one wired feedback network, rather than two labeled islands.
  const feedbackPins = ["R_FB_TOP.2", "C_FF.2", "R_FB_BOT.1", "C_COMP.2"]
  expect(
    getTraceConnectedPinComponents({
      pinIds: feedbackPins,
      traces: output.traces,
    }),
  ).toHaveLength(1)
  expect(
    output.inlineNetLabelPlacements.filter(
      (label) => label.netId === "LOGIC_FB" && !label.stubTracePath,
    ),
  ).toHaveLength(1)
  expect(
    output.inlineNetLabelPlacements.filter(
      (label) =>
        label.netId === "LOGIC_FB" &&
        label.pinIds.includes("U_LOGIC.8") &&
        !!label.stubTracePath,
    ),
  ).toHaveLength(1)
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
  expect(input.chips).toHaveLength(18)
  expect(new Set(pinIds).size).toBe(55)
  expect([...netByPin.keys()].sort()).toEqual([...pinIds].sort())
  for (const connection of input.directConnections) {
    for (const pinId of connection.pinIds) {
      expect(netByPin.get(pinId)).toBe(connection.netId)
    }
  }
})
