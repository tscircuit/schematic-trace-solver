import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import input from "./assets/repro-usbc-led-switch.input.json"

// Full pixalynx/usbc-led-switch v0.0.1 schematic, captured before routing
// with @tscircuit/core 0.0.2132: https://tscircuit.com/pixalynx/usbc-led-switch#files
// Text placement and display names/symbols are copied from its Circuit JSON.
// Keep the original oversized obstacle to isolate placement from Core's width fix.
test("repro USB-C LED switch schematic", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const mpn = "USB-C 16P SMD receptacle (DX07B024 style)"
  expect(
    convertSolverOutputToCircuitJson(solver).find(
      (element) => element.type === "schematic_text" && element.text === mpn,
    ),
  ).toMatchObject({
    position: { x: -5, y: -0.83 },
    anchor: "left",
    font_size: 0.18,
    rotation: 0,
  })
  expect(
    solver.visualize().texts?.find((text) => text.text === mpn),
  ).toMatchObject({
    x: -5,
    y: -0.83,
    anchorSide: "center_left",
    fontSize: 0.18,
  })

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
