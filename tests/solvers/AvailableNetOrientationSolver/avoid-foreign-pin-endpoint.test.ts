import { expect, test } from "bun:test"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import { tracePathIntersectsBounds } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

function pointOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  eps = 1e-4,
): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < eps * eps) return Math.hypot(p.x - a.x, p.y - a.y) <= eps
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
  )
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(p.x - projX, p.y - projY) <= eps
}

test("issue #1457 repro: U1.GND detours around R2.pin2 without leaving the label on other-net traces", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "schematic_component_0",
        center: { x: 0.865, y: 0.875 },
        width: 2.3,
        height: 1,
        pins: [
          {
            pinId: "schematic_port_0",
            x: -0.285,
            y: 1.175,
            _facingDirection: "x-",
          },
          {
            pinId: "schematic_port_1",
            x: -0.285,
            y: 0.975,
            _facingDirection: "x-",
          },
          {
            pinId: "schematic_port_2",
            x: -0.285,
            y: 0.775,
            _facingDirection: "x-",
          },
          {
            pinId: "schematic_port_3",
            x: -0.285,
            y: 0.575,
            _facingDirection: "x-",
          },
          {
            pinId: "schematic_port_4",
            x: 2.015,
            y: 0.575,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_5",
            x: 2.015,
            y: 0.775,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_6",
            x: 2.015,
            y: 0.975,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_7",
            x: 2.015,
            y: 1.175,
            _facingDirection: "x+",
          },
        ],
      },
      {
        chipId: "schematic_component_1",
        center: { x: -1.0575, y: 0.875 },
        width: 1.085,
        height: 0.6,
        pins: [
          {
            pinId: "schematic_port_8",
            x: -1.275,
            y: 1.175,
            _facingDirection: "y+",
          },
          {
            pinId: "schematic_port_9",
            x: -1.275,
            y: 0.575,
            _facingDirection: "y-",
          },
        ],
      },
      {
        chipId: "schematic_component_2",
        center: { x: -0.3625, y: -0.975 },
        width: 0.965,
        height: 0.6,
        pins: [
          {
            pinId: "schematic_port_10",
            x: -0.52,
            y: -0.675,
            _facingDirection: "y+",
          },
          {
            pinId: "schematic_port_11",
            x: -0.52,
            y: -1.275,
            _facingDirection: "y-",
          },
        ],
      },
      {
        chipId: "schematic_component_3",
        center: { x: 0.89, y: -1.225 },
        width: 0.84,
        height: 1.1,
        pins: [
          {
            pinId: "schematic_port_12",
            x: 1.19,
            y: -0.675,
            _facingDirection: "y+",
          },
          {
            pinId: "schematic_port_13",
            x: 1.2,
            y: -1.775,
            _facingDirection: "y-",
          },
          {
            pinId: "schematic_port_14",
            x: 0.47,
            y: -1.325,
            _facingDirection: "x-",
          },
        ],
      },
      {
        chipId: "schematic_component_4",
        center: { x: 0.4225, y: 3.775 },
        width: 0.885,
        height: 0.8,
        pins: [
          {
            pinId: "schematic_port_15",
            x: 0.865,
            y: 3.975,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_16",
            x: 0.865,
            y: 3.775,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_17",
            x: 0.865,
            y: 3.575,
            _facingDirection: "x+",
          },
        ],
      },
    ],
    directConnections: [
      {
        netId: "U1.OUT to R2.pin1",
        pinIds: ["schematic_port_0", "schematic_port_8"],
      },
      {
        netId: "R2.pin2 to U1.IN_N",
        pinIds: ["schematic_port_9", "schematic_port_1"],
      },
      {
        netId: "U1.OUT to R5.pin1",
        pinIds: ["schematic_port_0", "schematic_port_10"],
      },
      {
        netId: "R5.pin2 to Q1.gate",
        pinIds: ["schematic_port_11", "schematic_port_14"],
      },
    ],
    netConnections: [
      {
        netId: "GND",
        isGround: true,
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
        pinIds: ["schematic_port_3", "schematic_port_13", "schematic_port_17"],
      },
      {
        netId: "VCC",
        isGround: false,
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
        pinIds: ["schematic_port_7", "schematic_port_15"],
      },
    ],
    textBoxes: [
      {
        chipId: "schematic_component_0",
        center: { x: 0.2302, y: 1.49 },
        width: 0.3504,
        height: 0.25,
        text: "U1",
      },
      {
        chipId: "schematic_component_4",
        center: { x: 0.0754, y: 4.29 },
        width: 0.3108,
        height: 0.25,
        text: "J1",
      },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      GND: ["y-"],
    },
    maxMspPairDistance: 2.4,
  }

  const pipeline = new SchematicTracePipelineSolver(inputProblem)
  pipeline.solve()

  const availSolver = pipeline.availableNetOrientationSolver!
  const finalLabels =
    pipeline.netLabelToTraceSolver?.outputNetLabelPlacements ??
    availSolver.outputNetLabelPlacements

  const u1GndLabel = finalLabels.find((l) =>
    l.pinIds.includes("schematic_port_3"),
  )
  expect(u1GndLabel).toBeDefined()
  // Label must be rotated/relocated to its required y- orientation instead of
  // remaining at U1.GND where other-net traces cross through its box.
  expect(u1GndLabel!.orientation).toBe("y-")

  const u1GndBounds = getRectBounds(
    u1GndLabel!.center,
    u1GndLabel!.width,
    u1GndLabel!.height,
  )
  const finalTraces = availSolver.traces
  for (const trace of finalTraces) {
    if (trace.globalConnNetId === u1GndLabel!.globalConnNetId) continue
    expect(tracePathIntersectsBounds(trace.tracePath, u1GndBounds)).toBe(false)
  }

  const u1GndConnector = finalTraces.find(
    (t) =>
      availSolver.netLabelConnectorTraceIds.has(t.mspPairId) &&
      t.pinIds.includes("schematic_port_3"),
  )
  expect(u1GndConnector).toBeDefined()

  const r2Pin2 = { x: -1.275, y: 0.575 }
  for (let i = 0; i < u1GndConnector!.tracePath.length - 1; i++) {
    expect(
      pointOnSegment(
        r2Pin2,
        u1GndConnector!.tracePath[i]!,
        u1GndConnector!.tracePath[i + 1]!,
      ),
    ).toBe(false)
  }
})

test("reports pin-collision status when a foreign pin blocks the connector and no detour is available", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0.5, y: 0.5 },
        width: 1.0,
        height: 1.0,
        pins: [{ pinId: "U1.GND", x: 0.0, y: 0.5 }],
      },
      {
        chipId: "R2",
        center: { x: -0.5, y: 0.8 },
        width: 0.4,
        height: 0.6,
        pins: [{ pinId: "R2.pin2", x: -0.5, y: 0.5 }],
      },
      {
        // Block the space below the corridor so no downward detour can pass
        chipId: "BLOCKER",
        center: { x: -0.5, y: -0.05 },
        width: 0.9,
        height: 1.15,
        pins: [],
      },
    ],
    directConnections: [],
    availableNetLabelOrientations: {
      GND: ["y-"],
    },
    netConnections: [
      { netId: "GND", pinIds: ["U1.GND"], isGround: true },
      { netId: "IN_N", pinIds: ["R2.pin2"] },
    ],
  }

  const initialLabel: NetLabelPlacement = {
    globalConnNetId: "conn_gnd",
    dcConnNetId: "conn_gnd",
    netId: "GND",
    pinIds: ["U1.GND"],
    mspConnectionPairIds: [],
    orientation: "x-",
    anchorPoint: { x: 0.0, y: 0.5 },
    center: { x: -0.3, y: 0.5 },
    width: 0.6,
    height: 0.3,
  }

  const solver = new AvailableNetOrientationSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: [initialLabel],
  })
  // Step once to inspect candidate evaluations on the queued label
  solver.step()
  expect(
    solver.currentCandidateResults.some((c) => c.status === "pin-collision"),
  ).toBe(true)
})
