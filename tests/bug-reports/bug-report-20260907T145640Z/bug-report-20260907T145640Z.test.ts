import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260907T145640Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260907T145640Z", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const output = solver.netLabelToTraceSolver!.getOutput()
  // These nets previously fell back in a cascade after a retained anchored
  // label blocked the initially chosen side of one terminal's inline text.
  for (const netId of [
    "BOOST_EN",
    "I2C_SCL",
    "OLED_RST",
    "OLED_SCL",
    "OLED_SDA",
    "SWCLK",
    "SWDIO",
    "TS",
  ]) {
    const connection = inputProblem.netConnections.find(
      (connection) => connection.netId === netId,
    )!
    const representedPins = output.inlineNetLabelPlacements
      .filter((label) => label.netId === netId)
      .flatMap((label) => label.pinIds)
    expect([...new Set(representedPins)].sort()).toEqual(
      [...connection.pinIds].sort(),
    )
    expect(
      output.netLabelPlacements.some((label) => label.netId === netId),
    ).toBe(false)
  }
  // These terminal stubs are actually blocked by retained routed wires. Do not
  // hide those collisions or delete their labels to make the snapshot pass.
  for (const netId of ["CHG_IRQ", "CHG_LP", "PG_BUTTON", "IMAX"]) {
    expect(
      output.netLabelPlacements.some((label) => label.netId === netId),
    ).toBe(true)
    expect(
      output.inlineNetLabelPlacements.some((label) => label.netId === netId),
    ).toBe(false)
  }
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
