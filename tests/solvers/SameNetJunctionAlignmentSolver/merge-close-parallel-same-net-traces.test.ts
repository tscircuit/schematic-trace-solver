import { expect, test } from "bun:test"
import { alignSameNetJunctions } from "lib/solvers/SameNetJunctionAlignmentSolver/alignSameNetJunctions"
import { NetLabelToTraceSolver } from "lib/solvers/NetLabelToTraceSolver/NetLabelToTraceSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import {
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import example51Problem from "tests/assets/example51.json"
import rp2040UsbCc2Problem from "tests/repros/assets/repro-rp2040-usb-cc2-ground-overlap.input.json"

const createHorizontalCloseParallelFixture = (mirrorX = 1, mirrorY = 1) => {
  const point = (x: number, y: number) => ({ x: x * mirrorX, y: y * mirrorY })
  const pins: Array<SolvedTracePath["pins"][number]> = [
    {
      pinId: "U1.1",
      chipId: "U1",
      ...point(-2, 0),
      _facingDirection: mirrorX === 1 ? "x+" : "x-",
    },
    {
      pinId: "U2.1",
      chipId: "U2",
      ...point(2, 0.6),
      _facingDirection: mirrorX === 1 ? "x-" : "x+",
    },
    {
      pinId: "C1.1",
      chipId: "C1",
      ...point(-1, -0.4),
      _facingDirection: mirrorY === 1 ? "y+" : "y-",
    },
    {
      pinId: "C2.1",
      chipId: "C2",
      ...point(1.2, -1),
      _facingDirection: mirrorX === 1 ? "x-" : "x+",
    },
  ]

  const donorTrace: SolvedTracePath = {
    mspPairId: "U1.1-U2.1",
    dcConnNetId: "gnd",
    globalConnNetId: "gnd",
    userNetId: "GND",
    mspConnectionPairIds: ["U1.1-U2.1"],
    pins: [pins[0]!, pins[1]!],
    pinIds: ["U1.1", "U2.1"],
    tracePath: [point(-2, 0), point(1.5, 0), point(1.5, 0.6), point(2, 0.6)],
  }

  const branchTrace: SolvedTracePath = {
    mspPairId: "C1.1-C2.1",
    dcConnNetId: "gnd",
    globalConnNetId: "gnd",
    userNetId: "GND",
    mspConnectionPairIds: ["C1.1-C2.1"],
    pins: [pins[2]!, pins[3]!],
    pinIds: ["C1.1", "C2.1"],
    tracePath: [
      point(-1, -0.4),
      point(-1, -0.025),
      point(0.8, -0.025),
      point(0.8, -1),
      point(1.2, -1),
    ],
  }

  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: point(-2.4, 0),
        width: 0.8,
        height: 0.8,
        pins: [pins[0]!],
      },
      {
        chipId: "U2",
        center: point(2.4, 0.6),
        width: 0.8,
        height: 0.8,
        pins: [pins[1]!],
      },
      {
        chipId: "C1",
        center: point(-1, -0.8),
        width: 0.6,
        height: 0.8,
        pins: [pins[2]!],
      },
      {
        chipId: "C2",
        center: point(1.6, -1),
        width: 0.8,
        height: 0.6,
        pins: [pins[3]!],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        pinIds: pins.map((pin) => pin.pinId),
      },
    ],
    availableNetLabelOrientations: {},
  }

  return {
    inputProblem,
    traces: [donorTrace, branchTrace],
    point,
    netLabelPlacements: [] as NetLabelPlacement[],
    netLabelConnectorTraceIds: new Set<string>(),
  }
}

const createVerticalCloseParallelFixture = (mirrorX = 1, mirrorY = 1) => {
  const point = (x: number, y: number) => ({ x: x * mirrorX, y: y * mirrorY })
  const pins: Array<SolvedTracePath["pins"][number]> = [
    {
      pinId: "L1.1",
      chipId: "L1",
      ...point(-2, -1.8),
      _facingDirection: mirrorY === 1 ? "y-" : "y+",
    },
    {
      pinId: "U1.1",
      chipId: "U1",
      ...point(-0.2, 0),
      _facingDirection: mirrorY === 1 ? "y-" : "y+",
    },
    {
      pinId: "R1.1",
      chipId: "R1",
      ...point(2, -1.9),
      _facingDirection: mirrorY === 1 ? "y-" : "y+",
    },
    {
      pinId: "U1.2",
      chipId: "U1",
      ...point(1.4, -1),
      _facingDirection: mirrorX === 1 ? "x-" : "x+",
    },
  ]

  const donorTrace: SolvedTracePath = {
    mspPairId: "L1.1-U1.1",
    dcConnNetId: "gnd",
    globalConnNetId: "gnd",
    userNetId: "GND",
    mspConnectionPairIds: ["L1.1-U1.1"],
    pins: [pins[0]!, pins[1]!],
    pinIds: ["L1.1", "U1.1"],
    tracePath: [
      point(-2, -1.8),
      point(-2, -2),
      point(0.695, -2),
      point(0.695, -0.2),
      point(-0.2, -0.2),
      point(-0.2, 0),
    ],
  }

  const branchTrace: SolvedTracePath = {
    mspPairId: "R1.1-U1.2",
    dcConnNetId: "gnd",
    globalConnNetId: "gnd",
    userNetId: "GND",
    mspConnectionPairIds: ["R1.1-U1.2"],
    pins: [pins[2]!, pins[3]!],
    pinIds: ["R1.1", "U1.2"],
    tracePath: [
      point(2, -1.9),
      point(2, -2.1),
      point(0.709, -2.1),
      point(0.709, -1),
      point(1.4, -1),
    ],
  }

  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "L1",
        center: point(-2, -1.4),
        width: 0.6,
        height: 0.8,
        pins: [pins[0]!],
      },
      {
        chipId: "U1",
        center: point(1.8, -0.2),
        width: 0.8,
        height: 2,
        pins: [pins[1]!, pins[3]!],
      },
      {
        chipId: "R1",
        center: point(2, -1.5),
        width: 0.6,
        height: 0.8,
        pins: [pins[2]!],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        pinIds: pins.map((pin) => pin.pinId),
      },
    ],
    availableNetLabelOrientations: {},
  }

  return {
    inputProblem,
    traces: [donorTrace, branchTrace],
    point,
    netLabelPlacements: [] as NetLabelPlacement[],
    netLabelConnectorTraceIds: new Set<string>(),
  }
}

for (const mirrorX of [1, -1]) {
  for (const mirrorY of [1, -1]) {
    test(`merges close parallel horizontal same-net rails onto the same Y (${mirrorX}, ${mirrorY})`, () => {
      const fixture = createHorizontalCloseParallelFixture(mirrorX, mirrorY)
      const beforeCount = getVisibleTraceSegmentCount(fixture.traces)
      const beforeLength = getVisibleTraceLength(fixture.traces)

      const result = alignSameNetJunctions(fixture)
      expect(result.alignedJunctionCount).toBe(1)

      const branch = result.traces.find(
        (trace) => trace.mspPairId === "C1.1-C2.1",
      )!
      expect(branch.tracePath).toEqual([
        fixture.point(-1, -0.4),
        fixture.point(-1, 0),
        fixture.point(0.8, 0),
        fixture.point(0.8, -1),
        fixture.point(1.2, -1),
      ])
      expect(getVisibleTraceSegmentCount(result.traces)).toBeLessThan(
        beforeCount,
      )
      expect(getVisibleTraceLength(result.traces)).toBeLessThan(beforeLength)
    })

    test(`merges close parallel vertical same-net rails onto the same X (${mirrorX}, ${mirrorY})`, () => {
      const fixture = createVerticalCloseParallelFixture(mirrorX, mirrorY)
      const beforeCount = getVisibleTraceSegmentCount(fixture.traces)
      const beforeLength = getVisibleTraceLength(fixture.traces)

      const result = alignSameNetJunctions(fixture)
      expect(result.alignedJunctionCount).toBe(1)

      const branch = result.traces.find(
        (trace) => trace.mspPairId === "R1.1-U1.2",
      )!
      expect(branch.tracePath[2]!.x).toBeCloseTo(0.695 * mirrorX, 6)
      expect(branch.tracePath[3]!.x).toBeCloseTo(0.695 * mirrorX, 6)
      expect(getVisibleTraceSegmentCount(result.traces)).toBeLessThan(
        beforeCount,
      )
      expect(getVisibleTraceLength(result.traces)).toBeLessThan(beforeLength)
    })
  }
}

test("reversing trace order and path direction preserves close-parallel rail alignment", () => {
  const fixture = createHorizontalCloseParallelFixture()
  fixture.traces.reverse()
  for (const trace of fixture.traces) {
    trace.pins.reverse()
    trace.pinIds.reverse()
    trace.tracePath.reverse()
  }

  const result = alignSameNetJunctions(fixture)
  expect(result.alignedJunctionCount).toBe(1)
  const branch = result.traces.find((trace) => trace.mspPairId === "C1.1-C2.1")!
  expect(branch.tracePath[2]!.y).toBeCloseTo(0, 6)
  expect(branch.tracePath[3]!.y).toBeCloseTo(0, 6)
})

test("moves a corner-anchored net label when aligning a close parallel rail", () => {
  const fixture = createHorizontalCloseParallelFixture()
  fixture.netLabelPlacements.push({
    globalConnNetId: "gnd",
    dcConnNetId: "gnd",
    netId: "GND",
    mspConnectionPairIds: ["C1.1-C2.1"],
    pinIds: ["C1.1", "C2.1"],
    anchorPoint: { x: 0.8, y: -0.025 },
    center: { x: 0.8, y: 0.175 },
    width: 0.3,
    height: 0.2,
    orientation: "y+",
  })

  const result = alignSameNetJunctions(fixture)
  expect(result.alignedJunctionCount).toBe(1)
  expect(result.netLabelPlacements[0]!.anchorPoint).toEqual({ x: 0.8, y: 0 })
  expect(result.netLabelPlacements[0]!.center.y).toBeCloseTo(0.2, 6)
})

test("does not merge close parallel rails belonging to different nets", () => {
  const fixture = createHorizontalCloseParallelFixture()
  fixture.traces[1]!.globalConnNetId = "vcc"
  const original = structuredClone(fixture.traces[1]!)

  const result = alignSameNetJunctions(fixture)
  expect(result.alignedJunctionCount).toBe(0)
  expect(result.traces[1]).toEqual(original)
})

test("does not merge parallel rails separated by more than the close-parallel threshold", () => {
  const fixture = createHorizontalCloseParallelFixture()
  fixture.traces[1]!.tracePath[1]!.y = -0.08
  fixture.traces[1]!.tracePath[2]!.y = -0.08
  const original = structuredClone(fixture.traces[1]!)

  const result = alignSameNetJunctions(fixture)
  expect(result.alignedJunctionCount).toBe(0)
  expect(result.traces[1]).toEqual(original)
})

test("does not pull a branch rail off an already-shared same-net rail", () => {
  const fixture = createHorizontalCloseParallelFixture()
  fixture.traces.push({
    ...fixture.traces[1]!,
    mspPairId: "shared-partner",
    tracePath: [
      { x: 0.8, y: -0.4 },
      { x: 0.8, y: -0.025 },
      { x: 1.4, y: -0.025 },
      { x: 1.4, y: -0.4 },
    ],
  })
  const originalBranch = structuredClone(fixture.traces[1]!)

  const result = alignSameNetJunctions(fixture)
  expect(
    result.traces.find((trace) => trace.mspPairId === "C1.1-C2.1"),
  ).toEqual(originalBranch)
})

test("does not align a close parallel rail across a foreign-net trace", () => {
  const fixture = createHorizontalCloseParallelFixture()
  fixture.traces.push({
    ...fixture.traces[0]!,
    mspPairId: "foreign",
    globalConnNetId: "foreign",
    tracePath: [
      { x: -1.5, y: -0.01 },
      { x: 0, y: -0.01 },
    ],
  })
  const original = structuredClone(fixture.traces[1]!)

  const result = alignSameNetJunctions(fixture)
  expect(result.alignedJunctionCount).toBe(0)
  expect(result.traces[1]).toEqual(original)
})

test("NetLabelToTraceSolver aligns a close parallel rail when recovering a same-net trace", () => {
  const fixture = createHorizontalCloseParallelFixture()
  for (const trace of fixture.traces) {
    trace.globalConnNetId = "connectivity_net0"
    trace.dcConnNetId = "connectivity_net0"
    trace.userNetId = "SIG"
  }
  const recoveredDonorPinA = {
    pinId: "U3.1",
    chipId: "U3",
    x: -1.2,
    y: 0,
    _facingDirection: "x+" as const,
  }
  const recoveredDonorPinB = {
    pinId: "U4.1",
    chipId: "U4",
    x: 1.2,
    y: 0,
    _facingDirection: "x-" as const,
  }
  fixture.inputProblem.chips.push(
    {
      chipId: "U3",
      center: { x: -1.6, y: 0 },
      width: 0.8,
      height: 0.6,
      pins: [recoveredDonorPinA],
    },
    {
      chipId: "U4",
      center: { x: 1.6, y: 0 },
      width: 0.8,
      height: 0.6,
      pins: [recoveredDonorPinB],
    },
  )
  fixture.inputProblem.netConnections = [
    {
      netId: "SIG",
      pinIds: ["C1.1", "C2.1", "U3.1", "U4.1"],
      isGround: false,
    },
  ]

  const solver = new NetLabelToTraceSolver({
    inputProblem: fixture.inputProblem,
    traces: [fixture.traces[1]!],
    netLabelPlacements: [
      {
        globalConnNetId: "connectivity_net0",
        dcConnNetId: "connectivity_net0",
        netId: "SIG",
        mspConnectionPairIds: [],
        pinIds: ["U3.1"],
        anchorPoint: { x: -1.2, y: 0 },
        center: { x: -1, y: 0 },
        width: 0.4,
        height: 0.2,
        orientation: "x+",
      },
      {
        globalConnNetId: "connectivity_net0",
        dcConnNetId: "connectivity_net0",
        netId: "SIG",
        mspConnectionPairIds: [],
        pinIds: ["U4.1"],
        anchorPoint: { x: 1.2, y: 0 },
        center: { x: 1, y: 0 },
        width: 0.4,
        height: 0.2,
        orientation: "x-",
      },
    ],
    inlineNetLabelPlacements: [],
  })

  solver.solve()
  const output = solver.getOutput()
  const branch = output.traces.find((trace) => trace.mspPairId === "C1.1-C2.1")!
  expect(branch.tracePath[1]!.y).toBeCloseTo(0, 6)
  expect(branch.tracePath[2]!.y).toBeCloseTo(0, 6)
})

test("merges close parallel same-net rails in example51 and RP2040 USB-C CC2", () => {
  const rp2040Solver = new SchematicTracePipelineSolver(
    rp2040UsbCc2Problem as unknown as InputProblem,
  )
  rp2040Solver.solve()
  const rp2040Traces = rp2040Solver.sameNetJunctionAlignmentSolver!.outputTraces
  const upperGndBranch = rp2040Traces.find(
    (trace) => trace.mspPairId === "schematic_port_94-schematic_port_92",
  )!
  const upperGndRail = rp2040Traces.find(
    (trace) => trace.mspPairId === "schematic_port_92-schematic_port_90",
  )!
  expect(upperGndBranch.tracePath).toHaveLength(4)
  expect(upperGndBranch.tracePath.at(-1)!.y).toBeCloseTo(
    upperGndRail.tracePath[1]!.y,
    6,
  )

  const example51Solver = new SchematicTracePipelineSolver(
    example51Problem as unknown as InputProblem,
  )
  example51Solver.solve()
  const example51Traces =
    example51Solver.sameNetJunctionAlignmentSolver!.outputTraces
  const branchTrace = example51Traces.find(
    (trace) => trace.mspPairId === "schematic_port_36-schematic_port_109",
  )!
  const busTrace = example51Traces.find(
    (trace) => trace.mspPairId === "schematic_port_87-schematic_port_128",
  )!
  expect(branchTrace.tracePath[1]!.y).toBeCloseTo(busTrace.tracePath[0]!.y, 6)
  expect(branchTrace.tracePath[2]!.y).toBeCloseTo(busTrace.tracePath[1]!.y, 6)
})
