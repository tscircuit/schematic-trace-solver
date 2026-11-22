import { expect, test } from "bun:test"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
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

test("net-label connector trace does not pass through a foreign net pin endpoint", () => {
  const foreignPin = { pinId: "R2.pin2", x: -0.9, y: 0.575 }
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0.4, y: 0.575 },
        width: 1.37,
        height: 1.4,
        pins: [{ pinId: "U1.GND", x: -0.285, y: 0.575 }],
      },
      {
        chipId: "R2",
        center: { x: -0.9, y: 1.075 },
        width: 0.4,
        height: 1.0,
        pins: [{ pinId: "R2.pin1", x: -0.9, y: 1.575 }, foreignPin],
      },
    ],
    directConnections: [],
    availableNetLabelOrientations: {
      GND: ["y-"],
    },
    netConnections: [
      {
        netId: "GND",
        pinIds: ["U1.GND"],
        isGround: true,
      },
      {
        netId: "IN_N",
        pinIds: ["R2.pin2"],
      },
    ],
    // Block immediate downward placement directly below U1.GND;
    // any horizontal connector passing through R2.pin2 at (-0.9, 0.575) must be rejected.
    textBoxes: [
      {
        center: { x: -0.45, y: 0.25 },
        width: 0.8,
        height: 0.3,
        text: "blocker-below",
      },
    ],
  }

  const initialLabel: NetLabelPlacement = {
    globalConnNetId: "conn_gnd",
    dcConnNetId: "conn_gnd",
    netId: "GND",
    pinIds: ["U1.GND"],
    mspConnectionPairIds: [],
    orientation: "x-",
    anchorPoint: { x: -0.285, y: 0.575 },
    center: { x: -0.585, y: 0.575 },
    width: 0.6,
    height: 0.3,
  }

  const solver = new AvailableNetOrientationSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: [initialLabel],
  })
  solver.solve()

  const connectorTraces = solver.traces.filter((t) =>
    solver.netLabelConnectorTraceIds.has(t.mspPairId),
  )
  expect(connectorTraces.length).toBeGreaterThan(0)

  for (const trace of connectorTraces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const hitForeignPin = pointOnSegment(
        foreignPin,
        trace.tracePath[i]!,
        trace.tracePath[i + 1]!,
      )
      expect(hitForeignPin).toBe(false)
    }
  }
})
