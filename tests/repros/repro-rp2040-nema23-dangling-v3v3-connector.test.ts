import { expect, test } from "bun:test"
import {
  NetLabelNetLabelCollisionSolver,
  type NetLabelNetLabelCollisionSolverParams,
} from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import {
  rectsOverlap,
  tracePathContainsPoint,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import "tests/fixtures/matcher"
import input from "./assets/repro-rp2040-nema23-dangling-v3v3-connector.input.json"

// Complete collision-stage input from the controller sheet of:
// https://tscircuit.com/seveibar/rp2040-nema23-stepper-motor-controller#schematic
// Release 0.1.1: 6b3025cf-5ddf-456e-8edb-12028f05a514.
// Captured from the published solver 0.0.196 using the real core 0.0.1914
// solver:started input in repro-rp2040-nema23-controller.input.json.
// All 28 chips, 39 traces, and 62 label placements are preserved. Only the
// derived _chipObstacleSpatialIndex cache is omitted for JSON serialization.
// Current pipeline routing avoids this collision; the captured stage input
// still reproduces the unused connector left behind when V3V3 moves.
// This repro intentionally records the bug. A fix should remove the unused
// connector while preserving the VREG_IN / IOVDD2 power connection.
test("repro RP2040 NEMA23: moved V3V3 label leaves a dangling connector", async () => {
  const solver = new NetLabelNetLabelCollisionSolver(
    structuredClone(input) as unknown as NetLabelNetLabelCollisionSolverParams,
  )
  const initialLabel = solver.netLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" && label.pinIds.includes("schematic_port_83"),
  )!
  const adcLabel = solver.netLabelPlacements.find(
    (label) =>
      label.netId === "ADC_VREF" && label.pinIds.includes("schematic_port_82"),
  )!
  const connectorId = "available-net-orientation-0-V3V3"
  const originalConnector = solver.traces.find(
    (trace) => trace.mspPairId === connectorId,
  )!
  expect(
    tracePathContainsPoint(
      originalConnector.tracePath,
      initialLabel.anchorPoint,
    ),
  ).toBe(true)
  expect(
    rectsOverlap(
      getRectBounds(
        initialLabel.center,
        initialLabel.width,
        initialLabel.height,
      ),
      getRectBounds(adcLabel.center, adcLabel.width, adcLabel.height),
    ),
  ).toBe(true)

  solver.solve()

  const labels = solver.getOutput().netLabelPlacements
  const movedLabel = labels.find(
    (label) =>
      label.netId === "V3V3" && label.pinIds.includes("schematic_port_83"),
  )!
  const powerTrace = solver.traces.find(
    (trace) => trace.mspPairId === "schematic_port_83-schematic_port_81",
  )!
  expect(movedLabel.anchorPoint).not.toEqual(initialLabel.anchorPoint)
  expect(
    tracePathContainsPoint(powerTrace.tracePath, movedLabel.anchorPoint),
  ).toBe(true)

  // BUG: the old branch survives, with a tip touching no label, pin, or trace.
  const danglingConnector = solver.traces.find(
    (trace) => trace.mspPairId === connectorId,
  )!
  const tip = danglingConnector.tracePath.at(-1)!
  expect(
    labels.some((label) =>
      tracePathContainsPoint(danglingConnector.tracePath, label.anchorPoint),
    ),
  ).toBe(false)
  expect(
    solver.traces.some(
      (trace) =>
        trace.mspPairId !== connectorId &&
        tracePathContainsPoint(trace.tracePath, tip),
    ),
  ).toBe(false)
  expect(
    solver.inputProblem.chips.some((chip) =>
      chip.pins.some((pin) => Math.hypot(pin.x - tip.x, pin.y - tip.y) < 1e-6),
    ),
  ).toBe(false)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
