import { describe, expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { SchematicDebugObjectsSolver } from "./SchematicDebugObjectsSolver"

// Minimal mock InputProblem
const mockInputProblem: InputProblem = {
  chips: [
    {
      chipId: "chip1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "pin1", x: -1, y: 0 },
        { pinId: "pin2", x: 1, y: 0 },
      ],
    },
    {
      chipId: "chip2",
      center: { x: 5, y: 0 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "pin3", x: 4, y: 0 },
        { pinId: "pin4", x: 6, y: 0 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "net1",
      pinIds: ["pin1", "pin3"],
    },
  ],
} as any as InputProblem

const mockTrace: SolvedTracePath = {
  mspPairId: "pair1",
  globalConnNetId: "net1",
  userNetId: "net1",
  dcConnNetId: "net1",
  mspConnectionPairIds: ["pair1"],
  tracePath: [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 0 },
  ],
  pinIds: ["pin1", "pin3"],
  connectedPinIds: ["pin1", "pin3"],
  pins: [],
  edges: [],
} as any as SolvedTracePath

const mockLabel: NetLabelPlacement = {
  netId: "net1",
  globalConnNetId: "net1",
  center: { x: 2.5, y: 1 },
  width: 1,
  height: 0.5,
  anchorPoint: { x: 2.5, y: 1 },
  direction: "up",
} as any as NetLabelPlacement

describe("SchematicDebugObjectsSolver", () => {
  test("marks trace endpoints", () => {
    const solver = new SchematicDebugObjectsSolver({
      inputProblem: mockInputProblem,
      traces: [mockTrace],
      netLabelPlacements: [mockLabel],
    })

    solver.solve()

    expect(solver.solved).toBe(true)

    const output = solver.getOutput()

    // Should have start and end points for each trace
    const startPoints = output.debugPoints.filter((p) =>
      p.label?.startsWith("start:"),
    )
    const endPoints = output.debugPoints.filter((p) =>
      p.label?.startsWith("end:"),
    )

    expect(startPoints.length).toBe(1)
    expect(endPoints.length).toBe(1)

    expect(startPoints[0]!.x).toBe(-1)
    expect(startPoints[0]!.y).toBe(0)
    expect(endPoints[0]!.x).toBe(4)
    expect(endPoints[0]!.y).toBe(0)
  })

  test("marks direction-change junctions", () => {
    const solver = new SchematicDebugObjectsSolver({
      inputProblem: mockInputProblem,
      traces: [mockTrace],
      netLabelPlacements: [mockLabel],
    })

    solver.solve()

    const output = solver.getOutput()

    // Trace has 3 junctions: (1,0) turn, (2,1) turn, (3,1) turn
    expect(output.debugCircles.length).toBe(3)

    const junctionXs = output.debugCircles.map((c) => c.x)
    expect(junctionXs).toContain(1)
    expect(junctionXs).toContain(2)
    expect(junctionXs).toContain(3)
  })

  test("marks net label anchors and texts", () => {
    const solver = new SchematicDebugObjectsSolver({
      inputProblem: mockInputProblem,
      traces: [mockTrace],
      netLabelPlacements: [mockLabel],
    })

    solver.solve()

    const output = solver.getOutput()

    // Should have anchor point for each label
    const anchors = output.debugPoints.filter((p) =>
      p.label?.startsWith("anchor:"),
    )
    expect(anchors.length).toBe(1)
    expect(anchors[0]!.color).toBe("orange")

    // Should have text for each label
    expect(output.debugTexts.length).toBe(1)
    expect(output.debugTexts[0]!.text).toContain("net1")
  })

  test("empty traces — no crash", () => {
    const solver = new SchematicDebugObjectsSolver({
      inputProblem: mockInputProblem,
      traces: [],
      netLabelPlacements: [],
    })

    solver.solve()

    expect(solver.solved).toBe(true)

    const output = solver.getOutput()
    expect(output.debugPoints.length).toBe(0)
    expect(output.debugCircles.length).toBe(0)
    expect(output.debugTexts.length).toBe(0)
  })

  test("straight line trace — no junctions", () => {
    const straightTrace: SolvedTracePath = {
      ...mockTrace,
      tracePath: [
        { x: -1, y: 0 },
        { x: 4, y: 0 },
      ],
    } as any as SolvedTracePath

    const solver = new SchematicDebugObjectsSolver({
      inputProblem: mockInputProblem,
      traces: [straightTrace],
      netLabelPlacements: [],
    })

    solver.solve()

    const output = solver.getOutput()
    expect(output.debugCircles.length).toBe(0)
  })

  test("getOutput preserves traces and labels", () => {
    const solver = new SchematicDebugObjectsSolver({
      inputProblem: mockInputProblem,
      traces: [mockTrace],
      netLabelPlacements: [mockLabel],
    })

    solver.solve()

    const output = solver.getOutput()
    expect(output.traces).toEqual([mockTrace])
    expect(output.netLabelPlacements).toEqual([mockLabel])
  })
})
