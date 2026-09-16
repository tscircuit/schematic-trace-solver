import { expect, test } from "bun:test"
import { getRailRecoveryPolicy } from "lib/solvers/LongDistancePairSolver/getRailRecoveryPolicy"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
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

for (const [orientation, offset, allowed] of [
  ["y+", 0.2, true],
  ["y+", 0.21, false],
  ["y-", 1, true],
  ["y-", 1.01, false],
] as const) {
  test(`automatic ${orientation} rail sharing at offset ${offset}: ${allowed}`, () => {
    const input = createProblem(orientation, [offset, 0])
    const first = input.chips[0]!.pins[0]!
    const second = input.chips[1]!.pins[0]!
    const canRecover = getRailRecoveryPolicy(input, new Set())
    expect(canRecover(first, second)).toBe(allowed)
    expect(canRecover(second, first)).toBe(allowed)
  })
}

for (const [orientation, sourceY, targetY, allowed] of [
  ["y+", 4, 0, false],
  ["y+", 0, 4, true],
  ["y-", 0, 4, false],
  ["y-", 4, 0, true],
] as const) {
  test(`${orientation} attachment from ${sourceY} to established rail at ${targetY}`, () => {
    const input = createProblem(orientation, [sourceY, targetY])
    const first = input.chips[0]!.pins[0]!
    const second = input.chips[1]!.pins[0]!
    const canRecover = getRailRecoveryPolicy(input, new Set([second.pinId]))
    expect(canRecover(first, second)).toBe(allowed)
    expect(canRecover(second, first)).toBe(allowed)
  })
}

test("rail aliases use connectivity and orientation rather than their names", () => {
  const input = createProblem("y+", [4, 0])
  input.netConnections.push({ netId: "alias", pinIds: ["J1.1"] })
  input.availableNetLabelOrientations = { alias: ["y+"] }
  const canRecover = getRailRecoveryPolicy(input, new Set())
  expect(canRecover(input.chips[0]!.pins[0]!, input.chips[1]!.pins[0]!)).toBe(
    false,
  )
})

test("explicit physical wires override the rail recovery preference", () => {
  const input = createProblem("y+", [4, 0, -4])
  input.directConnections = [
    { pinIds: ["J1.1", "J2.1"] },
    { pinIds: ["J2.1", "J3.1"] },
  ]
  const canRecover = getRailRecoveryPolicy(input, new Set())
  expect(canRecover(input.chips[0]!.pins[0]!, input.chips[2]!.pins[0]!)).toBe(
    true,
  )
})

test("a shared direct-connection net ID does not request an inter-island wire", () => {
  const input = createProblem("y+", [4, 0])
  input.directConnections = [
    { netId: "rail", pinIds: ["J1.1", "J1.2"] },
    { netId: "rail", pinIds: ["J2.1", "J2.2"] },
  ]
  const canRecover = getRailRecoveryPolicy(input, new Set())
  expect(canRecover(input.chips[0]!.pins[0]!, input.chips[1]!.pins[0]!)).toBe(
    false,
  )
})

test("fallback-label connections do not force a distant rail join", () => {
  const input = createProblem("y+", [4, 0])
  input.directConnections = [{ pinIds: ["J1.1", "J2.1"], netLabelWidth: 0.5 }]
  const canRecover = getRailRecoveryPolicy(input, new Set())
  expect(canRecover(input.chips[0]!.pins[0]!, input.chips[1]!.pins[0]!)).toBe(
    false,
  )
})

test("signals and explicitly rotated labels retain their routing", () => {
  for (const orientations of [["x-", "x+"], ["x+"], ["y+", "y-"]] as const) {
    const input = createProblem("y+", [4, 0])
    input.availableNetLabelOrientations.rail = [...orientations]
    expect(
      getRailRecoveryPolicy(input, new Set())(
        input.chips[0]!.pins[0]!,
        input.chips[1]!.pins[0]!,
      ),
    ).toBe(true)
  }
})

for (const orientation of ["y+", "y-"] as const) {
  for (const reversed of [false, true]) {
    test(`pipeline keeps remote ${orientation} terminals local (reversed=${reversed})`, () => {
      const input = createProblem(
        orientation,
        orientation === "y+" ? [4, 0, 0] : [-4, 0, 0],
      )
      if (reversed) {
        input.chips.reverse()
        input.netConnections[0]!.pinIds.reverse()
      }
      const solver = new SchematicTracePipelineSolver(input)
      solver.solve()
      expect(solver.solved).toBe(true)
      expect(solver.failed).toBe(false)
      const { traces, netLabelPlacements } =
        solver.netLabelToTraceSolver!.getOutput()
      const components = getTraceConnectedPinComponents({
        pinIds: input.netConnections[0]!.pinIds,
        traces,
      })
      expect(
        components.find((component) => component.pinIds.includes("J1.1"))
          ?.pinIds,
      ).toEqual(["J1.1"])
      expect(
        netLabelPlacements.some((label) => label.pinIds.includes("J1.1")),
      ).toBe(true)
    })
  }
}

for (const [orientation, y, allowed] of [
  ["y+", -0.2, true],
  ["y+", -0.21, false],
  ["y-", 1, true],
  ["y-", 1.01, false],
] as const) {
  test(`level ${orientation} endpoints cannot hide an adverse path detour of ${y}`, () => {
    const input = createProblem(orientation, [0, 0])
    const first = input.chips[0]!.pins[0]!
    const second = input.chips[1]!.pins[0]!
    const canRecover = getRailRecoveryPolicy(input, new Set())
    expect(canRecover(first, second)).toBe(true)
    const path = [first, { x: first.x, y }, { x: second.x, y }, second]
    expect(canRecover(first, second, path)).toBe(allowed)
    expect(canRecover(second, first, [...path].reverse())).toBe(allowed)
  })
}
