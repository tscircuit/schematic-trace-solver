import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260907T083336Z.json"
import "tests/fixtures/matcher"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"

test("bug-report-20260907T083336Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const shellPinIds = new Set([
    "schematic_port_0",
    "schematic_port_1",
    "schematic_port_2",
    "schematic_port_3",
    "schematic_port_4",
    "schematic_port_15",
  ])
  const shellTraces = traces.filter((trace) =>
    trace.pins.every((pin) => shellPinIds.has(pin.pinId)),
  )
  expect(shellTraces).toHaveLength(5)
  const shellRailX =
    inputProblem.chips[0]!.pins.find((pin) => pin.pinId === "schematic_port_0")!
      .x + 0.2
  for (const trace of shellTraces) {
    const verticalSegments = trace.tracePath
      .slice(1)
      .filter(
        (end, index) =>
          Math.abs(end.x - trace.tracePath[index]!.x) < 1e-6 &&
          Math.abs(end.y - trace.tracePath[index]!.y) > 1e-6,
      )
    expect(verticalSegments).toHaveLength(1)
    expect(verticalSegments[0]!.x).toBeCloseTo(shellRailX, 6)
  }
  const externalGround = traces.find(
    (trace) => trace.mspPairId === "schematic_port_111-schematic_port_1",
  )!
  const shellPin = inputProblem.chips[0]!.pins.find(
    (pin) => pin.pinId === "schematic_port_1",
  )!
  expect(tracePathContainsPoint(externalGround.tracePath, shellPin)).toBe(true)
  expect(
    externalGround.tracePath.some(
      (point) => Math.abs(point.x - shellRailX) < 1e-6,
    ),
  ).toBe(false)
  const r6 = traces.find(
    (trace) => trace.mspPairId === "schematic_port_134-schematic_port_120",
  )!
  const capacitorRail = traces.find(
    (trace) => trace.mspPairId === "schematic_port_132-schematic_port_134",
  )!
  expect(
    tracePathContainsPoint(capacitorRail.tracePath, r6.tracePath.at(-1)!),
  ).toBe(true)
  expect(r6.tracePath.at(-1)!.y).toBeCloseTo(-3.135)

  const { inlineNetLabelPlacements, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  expect(
    inlineNetLabelPlacements.some((label) =>
      label.pinIds.includes("schematic_port_144"),
    ),
  ).toBe(true)
  expect(
    inlineNetLabelPlacements.some((label) =>
      label.pinIds.includes("schematic_port_145"),
    ),
  ).toBe(true)
  expect(
    netLabelPlacements.some(
      (label) =>
        label.pinIds.includes("schematic_port_144") ||
        label.pinIds.includes("schematic_port_145"),
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
