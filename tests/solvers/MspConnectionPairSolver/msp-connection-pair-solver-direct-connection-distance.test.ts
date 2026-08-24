import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: 0, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "U2",
      center: { x: 2, y: 2 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 2, y: 2, _facingDirection: "x-" }],
    },
  ],
  directConnections: [{ pinIds: ["U1.1", "U2.1"] }],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 3,
})

test("two-pin direct connections use Euclidean max distance", () => {
  const directConnectionSolver = new MspConnectionPairSolver({
    inputProblem: createInputProblem(),
  })
  directConnectionSolver.solve()

  const netConnectionProblem = createInputProblem()
  netConnectionProblem.directConnections = []
  netConnectionProblem.netConnections = [
    { pinIds: ["U1.1", "U2.1"], netId: "SIG" },
  ]
  const netConnectionSolver = new MspConnectionPairSolver({
    inputProblem: netConnectionProblem,
  })
  netConnectionSolver.solve()

  expect(directConnectionSolver.mspConnectionPairs).toHaveLength(1)
  expect(netConnectionSolver.mspConnectionPairs).toHaveLength(0)
})

test("routes a distant labeled connection when opposed fallback labels would overlap", () => {
  const inputProblem = createInputProblem()
  inputProblem.maxMspPairDistance = 1
  inputProblem.chips[0]!.sectionId = "power-output"
  inputProblem.chips[1]!.sectionId = "power-output"
  inputProblem.chips[0]!.pins.push({
    pinId: "U1.2",
    x: 0,
    y: -0.2,
    _facingDirection: "x+",
  })
  inputProblem.chips[1]!.pins.push({
    pinId: "U2.2",
    x: 2,
    y: 1.8,
    _facingDirection: "x-",
  })
  inputProblem.chips[1]!.pins[0]!.y = 0.1
  inputProblem.directConnections[0]!.netId = "LONG_POWER_NAME"
  inputProblem.directConnections[0]!.netLabelWidth = 1.2

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
  expect(solver.mspConnectionPairs[0]?.suppressNetLabel).toBe(true)
})

test("keeps distant labeled fallback when opposed labels have room", () => {
  const inputProblem = createInputProblem()
  inputProblem.maxMspPairDistance = 1
  inputProblem.chips[0]!.sectionId = "power-output"
  inputProblem.chips[1]!.sectionId = "power-output"
  inputProblem.chips[0]!.pins.push({
    pinId: "U1.2",
    x: 0,
    y: -0.2,
    _facingDirection: "x+",
  })
  inputProblem.chips[1]!.pins.push({
    pinId: "U2.2",
    x: 2,
    y: 1.8,
    _facingDirection: "x-",
  })
  inputProblem.chips[1]!.pins[0]!.y = 0.1
  inputProblem.directConnections[0]!.netId = "SIG"
  inputProblem.directConnections[0]!.netLabelWidth = 0.6

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("does not apply the overlap fallback outside a shared schematic section", () => {
  const inputProblem = createInputProblem()
  inputProblem.maxMspPairDistance = 1
  inputProblem.chips[0]!.pins.push({
    pinId: "U1.2",
    x: 0,
    y: -0.2,
    _facingDirection: "x+",
  })
  inputProblem.chips[1]!.pins.push({
    pinId: "U2.2",
    x: 2,
    y: 1.8,
    _facingDirection: "x-",
  })
  inputProblem.chips[1]!.pins[0]!.y = 0.1
  inputProblem.directConnections[0]!.netId = "LONG_POWER_NAME"
  inputProblem.directConnections[0]!.netLabelWidth = 1.2

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})
