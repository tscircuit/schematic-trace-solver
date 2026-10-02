import { expect, test } from "bun:test"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import { pathMatchesPinDirections } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/calculateDirectShortPath"
import { canRouteThroughOverlappingEndpointBounds } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/canRouteThroughOverlappingEndpointBounds"
import type { InputProblem } from "lib/types/InputProblem"

const createProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "upper",
      center: { x: 0, y: 0.6 },
      width: 2,
      height: 1.2,
      pins: [{ pinId: "upper.1", x: 0, y: 0, _facingDirection: "y-" }],
    },
    {
      chipId: "lower",
      center: { x: 0.1, y: -0.4 },
      width: 2,
      height: 1.2,
      pins: [{ pinId: "lower.1", x: 0.1, y: 0.2, _facingDirection: "y+" }],
    },
  ],
  directConnections: [{ pinIds: ["upper.1", "lower.1"] }],
  netConnections: [],
  availableNetLabelOrientations: {},
})

const createSolver = (inputProblem: InputProblem) =>
  new SchematicTraceSingleLineSolver2({
    inputProblem,
    chipMap: Object.fromEntries(
      inputProblem.chips.map((chip) => [chip.chipId, chip]),
    ),
    pins: inputProblem.chips.slice(0, 2).map((chip) => ({
      ...chip.pins[0]!,
      chipId: chip.chipId,
    })) as ConstructorParameters<
      typeof SchematicTraceSingleLineSolver2
    >[0]["pins"],
  })

for (const rotation of [0, 1, 2, 3]) {
  test(`connects mutually enclosed terminals, rotation ${rotation * 90}`, () => {
    const input = createProblem()
    for (let i = 0; i < rotation; i++) {
      for (const chip of input.chips) {
        chip.center = { x: -chip.center.y, y: chip.center.x }
        ;[chip.width, chip.height] = [chip.height, chip.width]
        for (const pin of chip.pins) {
          ;[pin.x, pin.y] = [-pin.y, pin.x]
          pin._facingDirection = (
            {
              "y-": "x+",
              "x+": "y+",
              "y+": "x-",
              "x-": "y-",
            } as const
          )[pin._facingDirection!]
        }
      }
    }
    const solver = createSolver(input)
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)
    expect(
      pathMatchesPinDirections({
        path: solver.solvedTracePath!,
        pin1: solver.pins[0],
        pin2: solver.pins[1],
      }),
    ).toBe(true)
    for (const [point, pin] of [
      [solver.solvedTracePath![0]!, solver.pins[0]],
      [solver.solvedTracePath!.at(-1)!, solver.pins[1]],
    ] as const) {
      expect(point.x).toBeCloseTo(pin.x, 9)
      expect(point.y).toBeCloseTo(pin.y, 9)
    }
  })
}

for (const blocker of ["chip", "endpoint text", "unrelated text"] as const) {
  test(`overlapping endpoint exception still checks ${blocker}`, () => {
    const input = createProblem()
    const obstacle = { center: { x: 0.05, y: 0.1 }, width: 0.02, height: 0.8 }
    if (blocker === "chip") {
      input.chips.push({ chipId: "blocker", pins: [], ...obstacle })
    } else {
      input.textBoxes = [
        {
          ...obstacle,
          text: "blocked",
          ...(blocker === "endpoint text" ? { chipId: "upper" } : {}),
        },
      ]
    }
    const solver = createSolver(input)
    expect(
      canRouteThroughOverlappingEndpointBounds({
        pins: solver.pins,
        path: solver.baseElbow,
        obstacles: solver.obstacles,
      }),
    ).toBe(false)
    solver.solve()
    expect(solver.solvedTracePath).toBeNull()
    expect(solver.failed).toBe(true)
  })
}

test("overlapping boxes alone do not relax endpoint obstacles", () => {
  const input = createProblem()
  // Only upper.1 is enclosed; lower.1 is outside the upper box.
  input.chips[1]!.pins[0]!.x = 1.1
  const solver = createSolver(input)
  expect(
    canRouteThroughOverlappingEndpointBounds({
      pins: solver.pins,
      path: solver.baseElbow,
      obstacles: solver.obstacles,
    }),
  ).toBe(false)
})

test("touching the opposite boundary does not relax endpoint obstacles", () => {
  const input = createProblem()
  input.chips[1]!.pins[0]!.y = 0
  const solver = createSolver(input)
  expect(
    canRouteThroughOverlappingEndpointBounds({
      pins: solver.pins,
      path: solver.baseElbow,
      obstacles: solver.obstacles,
    }),
  ).toBe(false)
})
