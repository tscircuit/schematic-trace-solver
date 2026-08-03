import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import twoPinCrystalInput from "./assets/repro-crystal-load-capacitors.input.json"

const createFourPinCrystalInput = (): InputProblem => {
  const input = structuredClone(twoPinCrystalInput) as InputProblem
  const crystal = input.chips.find(
    (chip) => chip.chipId === "schematic_component_0",
  )!
  crystal.height = 0.8
  crystal.pins = [
    {
      ...crystal.pins[0]!,
      pinId: "X1.1",
    },
    {
      pinId: "X1.2",
      x: 0,
      y: 0.4,
      _facingDirection: "y+",
    },
    {
      ...crystal.pins[1]!,
      pinId: "X1.3",
    },
    {
      pinId: "X1.4",
      x: 0,
      y: -0.4,
      _facingDirection: "y-",
    },
  ]
  input.netConnections = input.netConnections.map((connection) => ({
    ...connection,
    pinIds: connection.pinIds.map((pinId) => {
      if (pinId === "Y1.1") return "X1.1"
      if (pinId === "Y1.2") return "X1.3"
      return pinId
    }),
  }))
  return input
}

test("repro four-pin crystal with load capacitors", () => {
  const solver = new SchematicTracePipelineSolver(createFourPinCrystalInput())

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
