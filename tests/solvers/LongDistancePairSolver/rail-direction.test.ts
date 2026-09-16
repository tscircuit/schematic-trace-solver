import { expect, test } from "bun:test"
import { getRailRecoveryPolicy } from "lib/solvers/LongDistancePairSolver/getRailRecoveryPolicy"
import { getAdverseTravelToRail } from "lib/solvers/LongDistancePairSolver/getAdverseTravelToRail"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createProblem = (
  orientation: "y+" | "y-",
  ys: number[],
): InputProblem => ({
  chips: ys.map((y, i) => ({
    chipId: `J${i + 1}`,
    center: { x: i * 4, y },
    width: 1,
    height: 1,
    pins: [0, 0.3, -0.3].map((offset, p) => ({
      pinId: `J${i + 1}.${p + 1}`,
      x: i * 4 - 1,
      y: y + offset,
      _facingDirection: "x-",
    })),
  })),
  directConnections: [],
  netConnections: [
    {
      netId: "rail",
      netLabelText: orientation === "y+" ? "VDD" : "GND",
      isGround: orientation === "y-",
      pinIds: ys.map((_, i) => `J${i + 1}.1`),
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
    },
  ],
  availableNetLabelOrientations: { rail: [orientation] },
  maxMspPairDistance: 0.1,
})

function fixture(orientation: "y+" | "y-", offset: number) {
  const input = createProblem(orientation, [offset, 0])
  const pins = input.chips.map((chip) => ({
    ...chip.pins[0]!,
    chipId: chip.chipId,
  })) as SolvedTracePath["pins"]
  const globalConnNetId =
    getConnectivityMapsFromInputProblem(input).netConnMap.getNetConnectedToId(
      "rail",
    )!
  const trace: SolvedTracePath = {
    pins,
    pinIds: pins.map((p) => p.pinId),
    mspPairId: "J1.1-J2.1",
    mspConnectionPairIds: ["J1.1-J2.1"],
    dcConnNetId: "",
    globalConnNetId,
    userNetId: "rail",
    tracePath: [pins[0], { x: 1, y: offset }, { x: 1, y: 0 }, pins[1]],
  }
  const label: NetLabelPlacement = {
    globalConnNetId,
    netId: "rail",
    pinIds: trace.pinIds,
    mspConnectionPairIds: [trace.mspPairId],
    orientation,
    anchorPoint: { x: 1, y: 0 },
    center: { x: 1, y: 0 },
    width: 0.4,
    height: 0.4,
  }
  return { input, trace, label }
}

for (const orientation of ["y+", "y-"] as const) {
  for (const [distance, allowed] of [
    [0.8, true],
    [1, true],
    [1.01, false],
  ] as const) {
    test(`${orientation} permits at most 1 unit toward the rail (${distance})`, () => {
      const { input, trace, label } = fixture(
        orientation,
        orientation === "y+" ? distance : -distance,
      )
      const policy = getRailRecoveryPolicy(input)
      expect(
        policy({ trace, existingTraces: [], retainedLabels: [label] }),
      ).toBe(allowed)
      expect(
        policy({
          trace: {
            ...trace,
            pins: [...trace.pins].reverse() as typeof trace.pins,
            tracePath: [...trace.tracePath].reverse(),
          },
          existingTraces: [],
          retainedLabels: [label],
        }),
      ).toBe(allowed)
    })
  }
  test(`${orientation} allows large height differences in the correct direction`, () => {
    const { input, trace, label } = fixture(
      orientation,
      orientation === "y+" ? -4 : 4,
    )
    expect(
      getRailRecoveryPolicy(input)({
        trace,
        existingTraces: [],
        retainedLabels: [label],
      }),
    ).toBe(true)
  })
}

test("explicit physical wires override recovery preferences", () => {
  const { input, trace, label } = fixture("y+", 4)
  input.directConnections = [{ pinIds: [trace.pinIds[0]!, trace.pinIds[1]!] }]
  expect(
    getRailRecoveryPolicy(input)({
      trace,
      existingTraces: [],
      retainedLabels: [label],
    }),
  ).toBe(true)
})

test("net aliases retain the rail direction constraint", () => {
  const { input, trace, label } = fixture("y+", 4)
  input.netConnections.push({ netId: "alias", pinIds: ["J1.1"] })
  input.availableNetLabelOrientations = { alias: ["y+"] }
  expect(
    getRailRecoveryPolicy(input)({
      trace,
      existingTraces: [],
      retainedLabels: [label],
    }),
  ).toBe(false)
})

for (const directConnections of [
  [
    { netId: "rail", pinIds: ["J1.1", "J1.2"] },
    { netId: "rail", pinIds: ["J2.1", "J2.2"] },
  ],
  [{ pinIds: ["J1.1", "J2.1"], netLabelWidth: 0.5 }],
])
  test("shared net IDs and fallback labels do not force physical recovery", () => {
    const { input, trace, label } = fixture("y+", 4)
    input.directConnections =
      directConnections as InputProblem["directConnections"]
    expect(
      getRailRecoveryPolicy(input)({
        trace,
        existingTraces: [],
        retainedLabels: [label],
      }),
    ).toBe(false)
  })

test("signals and rotated labels are not constrained", () => {
  const { input, trace, label } = fixture("y+", 4)
  input.availableNetLabelOrientations = { rail: ["x+"] }
  expect(
    getRailRecoveryPolicy(input)({
      trace,
      existingTraces: [],
      retainedLabels: [label],
    }),
  ).toBe(true)
})

test("an interior GND anchor stops traversal before the other pin's uphill branch", () => {
  expect(
    getAdverseTravelToRail({
      paths: [
        [
          { x: 0, y: 4 },
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 2 },
        ],
      ],
      source: { x: 0, y: 4 },
      anchors: [{ x: 2, y: 0 }],
      orientation: "y-",
    }),
  ).toBe(0)
})

test("counts cumulative wrong-way detours instead of endpoint displacement", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 0.6 },
    { x: 1, y: 0.6 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 0.6 },
  ]
  expect(
    getAdverseTravelToRail({
      paths: [path],
      source: path[0]!,
      anchors: [path.at(-1)!],
      orientation: "y-",
    }),
  ).toBeCloseTo(1.2)
})

test("a same-net junction offers the least adverse route to any rail label", () => {
  const paths = [
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ],
    [
      { x: 2, y: -3 },
      { x: 2, y: 3 },
    ],
  ]
  expect(
    getAdverseTravelToRail({
      paths,
      source: { x: 0, y: 0 },
      anchors: [
        { x: 2, y: 3 },
        { x: 2, y: -3 },
      ],
      orientation: "y-",
    }),
  ).toBe(0)
  expect(
    getAdverseTravelToRail({
      paths,
      source: { x: 0, y: 0 },
      anchors: [{ x: 8, y: 8 }],
      orientation: "y-",
    }),
  ).toBe(Infinity)
})
