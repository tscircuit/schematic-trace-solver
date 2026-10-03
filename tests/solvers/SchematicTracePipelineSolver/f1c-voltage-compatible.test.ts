import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/f1c-voltage-compatible.json"
import "tests/fixtures/matcher"

// Captured from tscircuit/core PR #4334 at d84f47b7329e8fd1e3092124f604ffe109096559:
// tests/drc/source-pin-voltage-compatible-f1c.test.tsx, via solver:started.
test("F1C AVCC and regulator VOUT connect with a straight trace", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)

  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(output.traces).toHaveLength(1)
  expect(output.traces[0]!.tracePath).toEqual([
    { x: 1.85, y: 0 },
    { x: -1.85, y: 0 },
  ])
  expect(output.inlineNetLabelPlacements).toHaveLength(1)
  expect(output.inlineNetLabelPlacements[0]!.stubTracePath).toBeUndefined()
  expect(output.inlineNetLabelPlacements[0]!.pinIds).toHaveLength(2)
})

for (const scenario of [
  "blocked",
  "sections",
  "ground",
  "no_inline",
  "outward",
] as const) {
  test(`F1C straight recovery preserves fallback for ${scenario}`, () => {
    const input = structuredClone(inputProblem)
    if (scenario === "blocked") {
      input.chips.push({
        chipId: "barrier",
        center: { x: 0, y: 0 },
        width: 0.5,
        height: 1,
        pins: [],
      })
    }
    if (scenario === "sections") {
      Object.assign(input.chips[0]!, { sectionId: "first_sheet" })
      Object.assign(input.chips[1]!, { sectionId: "second_sheet" })
    }
    if (scenario === "ground") input.netConnections[0]!.isGround = true
    if (scenario === "no_inline")
      input.netConnections[0]!.allowInlineNetLabel = false
    if (scenario === "outward") {
      Object.assign(input.chips[0]!.pins[0]!, { _facingDirection: "x+" })
      Object.assign(input.chips[1]!.pins[0]!, { _facingDirection: "x-" })
    }
    const solver = new SchematicTracePipelineSolver(input as any)
    solver.solve()
    expect(solver.failed).toBe(false)
    expect(
      solver
        .inlineDirectTraceRecoverySolver!.getOutput()
        .traces.filter((trace) => trace.pinIds.length === 2),
    ).toHaveLength(0)
  })
}

test("F1C straight recovery also connects vertically facing pins", () => {
  const input = structuredClone(inputProblem)
  for (const chip of input.chips) {
    ;[chip.center.x, chip.center.y] = [chip.center.y, chip.center.x]
    ;[chip.width, chip.height] = [chip.height, chip.width]
    for (const pin of chip.pins) [pin.x, pin.y] = [pin.y, pin.x]
  }
  for (const textBox of input.textBoxes) {
    ;[textBox.center.x, textBox.center.y] = [textBox.center.y, textBox.center.x]
    ;[textBox.width, textBox.height] = [textBox.height, textBox.width]
  }
  input.availableNetLabelOrientations.AVCC = ["y-", "y+"]
  const solver = new SchematicTracePipelineSolver(input as any)
  solver.solve()
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(output.traces).toHaveLength(1)
  expect(output.traces[0]!.tracePath).toEqual([
    { x: 0, y: 1.85 },
    { x: 0, y: -1.85 },
  ])
  expect(output.inlineNetLabelPlacements).toHaveLength(1)
  expect(output.inlineNetLabelPlacements[0]!.stubTracePath).toBeUndefined()
})
