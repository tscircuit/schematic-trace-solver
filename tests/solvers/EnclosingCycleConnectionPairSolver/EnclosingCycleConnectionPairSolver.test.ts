import { expect, test } from "bun:test"
import { EnclosingCycleConnectionPairSolver } from "lib/solvers/EnclosingCycleConnectionPairSolver/EnclosingCycleConnectionPairSolver"
import { detectEnclosingCycles } from "lib/solvers/EnclosingCycleConnectionPairSolver/detectEnclosingCycles"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const nonEnclosingInput: InputProblem = {
  chips: [
    {
      chipId: "left",
      center: { x: -1, y: 0 },
      width: 0.5,
      height: 0.5,
      pins: [
        {
          pinId: "left.pin",
          x: -0.75,
          y: 0,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "right",
      center: { x: 1, y: 0 },
      width: 0.5,
      height: 0.5,
      pins: [
        {
          pinId: "right.pin",
          x: 0.75,
          y: 0,
          _facingDirection: "x-",
        },
      ],
    },
  ],
  directConnections: [
    {
      netId: "ordinary-connection",
      pinIds: ["left.pin", "right.pin"],
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
}

const skewedCycleInput: InputProblem = {
  chips: [
    { chipId: "north-west", center: { x: -2, y: 1 } },
    { chipId: "north-east", center: { x: 1.4, y: 1.8 } },
    { chipId: "south-east", center: { x: 2, y: -0.8 } },
    { chipId: "south-west", center: { x: -1.5, y: -1.7 } },
    { chipId: "inner-top", center: { x: 0, y: 0.3 } },
    { chipId: "inner-bottom", center: { x: 0, y: -0.3 } },
  ].map((chip) => ({
    ...chip,
    width: 0.4,
    height: 0.4,
    pins: [
      {
        pinId: `${chip.chipId}.a`,
        ...chip.center,
        _facingDirection: "x+" as const,
      },
      {
        pinId: `${chip.chipId}.b`,
        ...chip.center,
        _facingDirection: "x+" as const,
      },
    ],
  })),
  directConnections: [
    {
      netId: "north-west-to-north-east",
      pinIds: ["north-west.b", "north-east.a"],
    },
    {
      netId: "north-east-to-south-east",
      pinIds: ["north-east.b", "south-east.a"],
    },
    {
      netId: "south-east-to-south-west",
      pinIds: ["south-east.b", "south-west.a"],
    },
    {
      netId: "south-west-to-north-west",
      pinIds: ["south-west.b", "north-west.a"],
    },
    {
      netId: "north-west-to-inner-top",
      pinIds: ["north-west.a", "inner-top.a"],
    },
    {
      netId: "north-east-to-inner-top",
      pinIds: ["north-east.b", "inner-top.b"],
    },
    {
      netId: "inner-top-a-to-inner-bottom-a",
      pinIds: ["inner-top.a", "inner-bottom.a"],
    },
    {
      netId: "inner-top-b-to-inner-bottom-b",
      pinIds: ["inner-top.b", "inner-bottom.b"],
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
}

const detectCycles = (inputProblem: InputProblem) => {
  const mspSolver = new MspConnectionPairSolver({ inputProblem })
  mspSolver.solve()
  return detectEnclosingCycles(inputProblem, mspSolver.globalConnMap)
}

test("leaves ordinary MSP connection pairs unchanged", () => {
  const mspSolver = new MspConnectionPairSolver({
    inputProblem: nonEnclosingInput,
  })
  mspSolver.solve()

  const cycleSolver = new EnclosingCycleConnectionPairSolver({
    inputProblem: nonEnclosingInput,
    inputPairs: mspSolver.mspConnectionPairs,
    globalConnMap: mspSolver.globalConnMap,
  })
  cycleSolver.solve()

  expect(cycleSolver.detectedCycles).toHaveLength(0)
  expect(cycleSolver.getOutput().mspConnectionPairs).toEqual(
    mspSolver.mspConnectionPairs,
  )
  expect(cycleSolver.stats.preservedNetCount).toBe(0)
  expect(cycleSolver.visualize()).toEqual(mspSolver.visualize())
})

test("detects a skewed enclosing cycle without axis alignment", () => {
  const detectedCycles = detectCycles(skewedCycleInput)

  expect(detectedCycles).toHaveLength(1)
  expect(new Set(detectedCycles[0]!.boundaryChipIds)).toEqual(
    new Set(["north-west", "north-east", "south-east", "south-west"]),
  )
  expect(detectedCycles[0]!.innerChipIds).toEqual(["inner-top", "inner-bottom"])
})

test("ignores an enclosure without the nested two-net branch", () => {
  const inputWithoutNestedBranch = {
    ...skewedCycleInput,
    directConnections: skewedCycleInput.directConnections.slice(0, 4),
  }

  expect(detectCycles(inputWithoutNestedBranch)).toHaveLength(0)
})
