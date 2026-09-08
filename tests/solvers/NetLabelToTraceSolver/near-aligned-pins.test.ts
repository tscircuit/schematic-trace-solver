import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { isAxisAlignedSegment } from "lib/solvers/NetLabelToTraceSolver/orthogonalizeTracePath"
import type { InputProblem } from "lib/types/InputProblem"

const nearAlignedNetLabelPins: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_1",
      center: { x: -11.8075, y: 9 },
      width: 1.2850000000000001,
      height: 0.759999999999998,
      pins: [
        {
          pinId: "schematic_port_2",
          x: -12,
          y: 9.379999999999999,
          _facingDirection: "y+",
        },
      ],
    },
    {
      chipId: "schematic_component_36",
      center: { x: -15, y: 10.4 },
      width: 0.6000000000000014,
      height: 0.6799999999999997,
      pins: [
        {
          pinId: "schematic_port_73",
          x: -14.7,
          y: 10.4,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "schematic_component_40",
      center: { x: -14.044999999999998, y: 6.4 },
      width: 1.209999999999999,
      height: 0.5999999999999996,
      pins: [
        {
          pinId: "schematic_port_81",
          x: -14.2,
          y: 6.7,
          _facingDirection: "y+",
        },
      ],
    },
    {
      chipId: "schematic_component_56",
      center: { x: -9.42, y: 10.09 },
      width: 1.1400000000000006,
      height: 0.870000000000001,
      pins: [
        {
          pinId: "schematic_port_112",
          x: -9.99,
          y: 10.39,
          _facingDirection: "x-",
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "NET_01",
      isGround: false,
      netLabelWidth: 0.42,
      netLabelHeight: 0.84,
      pinIds: [
        "schematic_port_2",
        "schematic_port_73",
        "schematic_port_81",
        "schematic_port_112",
      ],
    },
  ],
  availableNetLabelOrientations: { NET_01: ["y+"] },
  maxMspPairDistance: 2.4,
}

test("net-label recovery traces stay axis-aligned for near-aligned pins", () => {
  const solver = new SchematicTracePipelineSolver(nearAlignedNetLabelPins)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces } = solver.netLabelToTraceSolver!.getOutput()
  const recovered = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_112") &&
      trace.pinIds.includes("schematic_port_73"),
  )
  expect(recovered).toBeDefined()
  expect(recovered!.tracePath.length).toBeGreaterThan(2)

  for (const trace of traces) {
    for (let index = 0; index < trace.tracePath.length - 1; index++) {
      expect(
        isAxisAlignedSegment(
          trace.tracePath[index]!,
          trace.tracePath[index + 1]!,
        ),
      ).toBe(true)
    }
  }
})
