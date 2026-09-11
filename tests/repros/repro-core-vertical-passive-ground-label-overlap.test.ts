import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-core-vertical-passive-ground-label-overlap.input.json"

// Captured via solver:started from @tscircuit/core repro187. Symbol names and
// display text were added for a readable snapshot; routing geometry is intact.
test("VREF trace clears a vertical passive GND label", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_7"),
  )!
  const vrefTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_6") &&
      trace.pinIds.includes("schematic_port_8"),
  )!

  expect(groundLabel).toBeDefined()
  expect(vrefTrace).toBeDefined()
  expect(vrefTrace.globalConnNetId).not.toBe(groundLabel.globalConnNetId)
  // The VREF route must approach the resistor without crossing its GND terminal.
  expect(pathIntersectsRenderedLabel(vrefTrace.tracePath, groundLabel)).toBe(
    false,
  )
  for (const pinId of ["schematic_port_7", "schematic_port_9"]) {
    const pin = inputProblem.chips
      .flatMap((chip) => chip.pins)
      .find((pin) => pin.pinId === pinId)!
    const label = netLabelPlacements.find(
      (label) => label.netId === "GND" && label.pinIds.includes(pinId),
    )!
    expect(label.anchorPoint.x).toBeCloseTo(pin.x)
    expect(label.anchorPoint.y).toBeCloseTo(pin.y - 0.2)
    expect(
      traces.some(
        (trace) =>
          trace.globalConnNetId === label.globalConnNetId &&
          trace.tracePath.some(
            (point) => point.x === pin.x && point.y === pin.y,
          ) &&
          trace.tracePath.some(
            (point) =>
              point.x === label.anchorPoint.x &&
              point.y === label.anchorPoint.y,
          ),
      ),
    ).toBe(true)
  }
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
