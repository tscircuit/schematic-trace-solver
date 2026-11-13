import { expect, test } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./bug-report-20260907T083336Z.json"
import "tests/fixtures/matcher"

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

  // U1 left-side GND rail stays clear of all cross-net labels and inline stubs.
  const crossNetTraceLabelCollisions: string[] = []
  for (const label of [...netLabelPlacements, ...inlineNetLabelPlacements]) {
    const bounds = getRectBounds(label.center, label.width, label.height)
    for (const trace of traces) {
      if (trace.globalConnNetId === label.globalConnNetId) continue
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        if (
          segmentIntersectsRect(
            trace.tracePath[i]!,
            trace.tracePath[i + 1]!,
            bounds,
          )
        ) {
          crossNetTraceLabelCollisions.push(
            `${trace.mspPairId}:${label.pinIds.join(",")}`,
          )
        }
      }
    }
  }
  expect(crossNetTraceLabelCollisions).toEqual([])

  // U3 VBUS power-label connector reattaches as a clean 1-turn L-branch off EN.
  const u3VbusConnector = traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-11-VBUS",
  )!
  expect(u3VbusConnector.tracePath).toHaveLength(3)
  expect(u3VbusConnector.tracePath[0]!.y).toBeCloseTo(-6.29)

  // U2 USB_DP and USB_DM inline terminal stubs stop short of capacitor C24.
  const c24 = inputProblem.chips.find(
    (chip) => chip.chipId === "schematic_component_24",
  )!
  const c24RightEdge = c24.center.x + c24.width / 2
  for (const pinId of ["schematic_port_20", "schematic_port_21"]) {
    const usbLabel = inlineNetLabelPlacements.find((label) =>
      label.pinIds.includes(pinId),
    )!
    expect(usbLabel.stubTracePath).toBeDefined()
    expect(usbLabel.stubTracePath![1]!.x).toBeGreaterThan(c24RightEdge)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
