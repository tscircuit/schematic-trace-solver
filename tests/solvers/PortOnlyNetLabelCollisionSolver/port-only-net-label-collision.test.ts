import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { PortOnlyNetLabelCollisionSolver } from "lib/solvers/PortOnlyNetLabelCollisionSolver/PortOnlyNetLabelCollisionSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import bugReport601 from "../../bug-reports/bug-report-20260706T220324Z/bug-report-20260706T220324Z.json"
import bugReport617 from "../../bug-reports/bug-report-20260707T092615Z/bug-report-20260707T092615Z.json"

const boundsOverlap = (
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
) =>
  a.minX < b.maxX - 1e-6 &&
  a.maxX > b.minX + 1e-6 &&
  a.minY < b.maxY - 1e-6 &&
  a.maxY > b.minY + 1e-6

test("steps an obstructed port-only label around a blocking chip via an orthogonal connector", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [{ pinId: "U1.1", x: 1, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "R_BLOCK",
        center: { x: 1.55, y: 0 },
        width: 0.7,
        height: 0.5,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [{ netId: "SIG_OUT", pinIds: ["U1.1"] }],
    availableNetLabelOrientations: { SIG_OUT: ["x+", "x-"] },
  }

  const initialLabel: NetLabelPlacement = {
    globalConnNetId: "net_sig_out",
    dcConnNetId: "net_sig_out",
    netId: "SIG_OUT",
    mspConnectionPairIds: [],
    pinIds: ["U1.1"],
    orientation: "x+",
    anchorPoint: { x: 1, y: 0 },
    center: { x: 1.45, y: 0 },
    width: 0.9,
    height: 0.22,
  }

  const solver = new PortOnlyNetLabelCollisionSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: [initialLabel],
  })
  solver.solve()

  const out = solver.getOutput()
  expect(out.traces.length).toBe(1)
  const connector = out.traces[0]!
  expect(out.netLabelConnectorTraceIds.has(connector.mspPairId)).toBe(true)
  expect(connector.tracePath[0]).toEqual({ x: 1, y: 0 })

  const placed = out.netLabelPlacements[0]!
  expect(["x+", "x-"]).toContain(placed.orientation)
  expect(connector.tracePath.at(-1)).toEqual(placed.anchorPoint)

  for (let i = 0; i < connector.tracePath.length - 1; i++) {
    const a = connector.tracePath[i]!
    const b = connector.tracePath[i + 1]!
    expect(Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9).toBe(true)
  }

  const renderedBounds = getAnchoredNetLabelRenderedBounds(placed)
  for (const chip of inputProblem.chips) {
    expect(
      boundsOverlap(
        renderedBounds,
        getRectBounds(chip.center, chip.width, chip.height),
      ),
    ).toBe(false)
  }
})

test("separates two colliding facing port-only labels by moving only one", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "R1",
        center: { x: -0.5, y: 0 },
        width: 1,
        height: 0.4,
        pins: [{ pinId: "R1.2", x: 0, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "R2",
        center: { x: 1.5, y: 0 },
        width: 1,
        height: 0.4,
        pins: [{ pinId: "R2.1", x: 1.0, y: 0, _facingDirection: "x-" }],
      },
    ],
    directConnections: [],
    netConnections: [
      { netId: "LED_A", pinIds: ["R1.2"] },
      { netId: "LED_B", pinIds: ["R2.1"] },
    ],
    availableNetLabelOrientations: {
      LED_A: ["x+", "x-"],
      LED_B: ["x+", "x-"],
    },
  }

  const labelA: NetLabelPlacement = {
    globalConnNetId: "net_a",
    dcConnNetId: "net_a",
    netId: "LED_A",
    mspConnectionPairIds: [],
    pinIds: ["R1.2"],
    orientation: "x+",
    anchorPoint: { x: 0, y: 0 },
    center: { x: 0.4, y: 0 },
    width: 0.8,
    height: 0.22,
  }
  const labelB: NetLabelPlacement = {
    globalConnNetId: "net_b",
    dcConnNetId: "net_b",
    netId: "LED_B",
    mspConnectionPairIds: [],
    pinIds: ["R2.1"],
    orientation: "x-",
    anchorPoint: { x: 1.0, y: 0 },
    center: { x: 0.6, y: 0 },
    width: 0.8,
    height: 0.22,
  }

  const solver = new PortOnlyNetLabelCollisionSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: [labelA, labelB],
  })
  solver.solve()

  const out = solver.getOutput()
  expect(out.traces.length).toBe(1)
  expect(
    boundsOverlap(
      getAnchoredNetLabelRenderedBounds(out.netLabelPlacements[0]!),
      getAnchoredNetLabelRenderedBounds(out.netLabelPlacements[1]!),
    ),
  ).toBe(false)
})

test("leaves unobstructed port-only labels untouched with zero added traces", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [{ pinId: "U1.1", x: 1, y: 0, _facingDirection: "x+" }],
      },
    ],
    directConnections: [],
    netConnections: [{ netId: "FREE_NET", pinIds: ["U1.1"] }],
    availableNetLabelOrientations: { FREE_NET: ["x+", "x-"] },
  }

  const label: NetLabelPlacement = {
    globalConnNetId: "net_free",
    dcConnNetId: "net_free",
    netId: "FREE_NET",
    mspConnectionPairIds: [],
    pinIds: ["U1.1"],
    orientation: "x+",
    anchorPoint: { x: 1, y: 0 },
    center: { x: 1.45, y: 0 },
    width: 0.9,
    height: 0.22,
  }

  const solver = new PortOnlyNetLabelCollisionSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: [label],
  })
  solver.solve()

  const out = solver.getOutput()
  expect(out.traces).toHaveLength(0)
  expect(out.netLabelPlacements[0]).toEqual(label)
})

test("resolves all label collisions and chip overlaps on bug reports #617 and #601", () => {
  for (const input of [bugReport617, bugReport601]) {
    const solver = new SchematicTracePipelineSolver(input as any, {
      hideRatsNet: true,
    })
    solver.solve()

    const finalOut = solver.netLabelToTraceSolver!.getOutput()
    expect(getOutputLabelCollisions(finalOut)).toHaveLength(0)

    for (const label of finalOut.netLabelPlacements) {
      const rendered = getAnchoredNetLabelRenderedBounds(label)
      for (const chip of solver.inputProblem.chips) {
        expect(
          boundsOverlap(
            rendered,
            getRectBounds(chip.center, chip.width, chip.height),
          ),
        ).toBe(false)
      }
    }
  }
})
