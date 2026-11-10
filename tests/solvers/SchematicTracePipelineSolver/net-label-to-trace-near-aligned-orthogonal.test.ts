import { expect, test } from "bun:test"
import { NetLabelToTraceSolver } from "lib/solvers/NetLabelToTraceSolver/NetLabelToTraceSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import example51 from "../../assets/example51.json"

const isOrthogonalPath = (points: Array<{ x: number; y: number }>) =>
  points.every((point, index) => {
    if (index === 0) return true
    const prev = points[index - 1]!
    return (
      Math.abs(point.x - prev.x) <= 1e-6 || Math.abs(point.y - prev.y) <= 1e-6
    )
  })

test("NetLabelToTraceSolver emits strictly orthogonal traces for near-aligned pins in example51", () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(example51) as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const nearAlignedPairs = [
    ["schematic_port_113", "schematic_port_110"],
    ["schematic_port_116", "schematic_port_111"],
    ["schematic_port_73", "schematic_port_112"],
  ]

  for (const pair of nearAlignedPairs) {
    const recoveredTrace = output.traces.find((trace) =>
      pair.every((pinId) => trace.pinIds.includes(pinId)),
    )
    expect(recoveredTrace).toBeDefined()
    expect(recoveredTrace!.tracePath.length).toBeGreaterThanOrEqual(4)
    expect(isOrthogonalPath(recoveredTrace!.tracePath)).toBe(true)
  }

  for (const trace of output.traces) {
    expect(isOrthogonalPath(trace.tracePath)).toBe(true)
  }
})

test("NetLabelToTraceSolver orthogonalizes 2-point routes between near-aligned pins within alignment tolerance", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "U1.1",
            x: 0.5,
            y: 0,
            _facingDirection: "x+",
          },
        ],
      },
      {
        chipId: "U2",
        center: { x: 4, y: 0.005 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "U2.1",
            x: 3.5,
            y: 0.005,
            _facingDirection: "x-",
          },
        ],
      },
    ],
    directConnections: [
      {
        netId: "SIG",
        pinIds: ["U1.1", "U2.1"],
      },
    ],
    netConnections: [
      {
        netId: "SIG",
        pinIds: ["U1.1", "U2.1"],
      },
    ],
    availableNetLabelOrientations: {
      SIG: ["x+", "x-"],
    },
  }

  const solver = new NetLabelToTraceSolver({
    inputProblem,
    traces: [],
    inlineNetLabelPlacements: [],
    netLabelPlacements: [
      {
        globalConnNetId: "connectivity_net1",
        netId: "SIG",
        mspConnectionPairIds: [],
        pinIds: ["U1.1"],
        orientation: "x+",
        anchorPoint: { x: 0.5, y: 0 },
        center: { x: 0.8, y: 0 },
        width: 0.6,
        height: 0.2,
      },
      {
        globalConnNetId: "connectivity_net1",
        netId: "SIG",
        mspConnectionPairIds: [],
        pinIds: ["U2.1"],
        orientation: "x-",
        anchorPoint: { x: 3.5, y: 0.005 },
        center: { x: 3.2, y: 0.005 },
        width: 0.6,
        height: 0.2,
      },
    ],
  })

  solver.solve()
  const { traces } = solver.getOutput()
  expect(traces).toHaveLength(1)
  expect(traces[0]!.tracePath).toEqual([
    { x: 0.5, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 0.005 },
    { x: 3.5, y: 0.005 },
  ])
  expect(isOrthogonalPath(traces[0]!.tracePath)).toBe(true)
})
