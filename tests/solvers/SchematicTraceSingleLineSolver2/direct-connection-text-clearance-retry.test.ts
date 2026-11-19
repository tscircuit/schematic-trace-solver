import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { InputProblem } from "lib/types/InputProblem"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"

const createUnambiguousPinTextPaddingProblem = (
  overrides: Partial<InputProblem> = {},
): InputProblem => ({
  chips: [
    {
      chipId: "P1",
      center: { x: 0, y: 0.625 },
      width: 2.2,
      height: 1.8,
      pins: [
        {
          pinId: "P1.A6",
          x: 1.1,
          y: 0.125,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "R21",
      center: { x: 2.1, y: -0.665 },
      width: 0.6,
      height: 0.68,
      pins: [
        {
          pinId: "R21.pin2",
          x: 1.8,
          y: -0.665,
          _facingDirection: "x-",
        },
      ],
    },
  ],
  directConnections: [
    {
      netId: ".R21 > .pin2 to .P1 > .A6",
      pinIds: ["R21.pin2", "P1.A6"],
    },
  ],
  netConnections: [],
  textBoxes: [
    {
      chipId: "P1",
      center: { x: 0.26, y: -0.405 },
      width: 1.92,
      height: 0.18,
      text: "USB4105-GF-A-060",
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2.4,
  ...overrides,
})

const solveLinesStage = (inputProblem: InputProblem) => {
  const mspSolver = new MspConnectionPairSolver({ inputProblem })
  mspSolver.solve()
  const { directConnMap, netConnMap } =
    getConnectivityMapsFromInputProblem(inputProblem)
  const chipMap = Object.fromEntries(
    inputProblem.chips.map((chip) => [chip.chipId, chip]),
  )
  const linesSolver = new SchematicTraceLinesSolver({
    mspConnectionPairs: mspSolver.mspConnectionPairs,
    chipMap,
    dcConnMap: directConnMap,
    globalConnMap: netConnMap,
    inputProblem,
  })
  linesSolver.solve()
  return linesSolver
}

test("retries without synthetic net-label padding for unlabeled directConnections on non-corner pins", () => {
  const inputProblem = createUnambiguousPinTextPaddingProblem()
  const linesSolver = solveLinesStage(inputProblem)

  expect(linesSolver.failedConnectionPairs).toHaveLength(0)
  expect(linesSolver.solvedTracePaths).toHaveLength(1)

  const tracePath = linesSolver.solvedTracePaths[0]!.tracePath
  const textBounds = inputProblem.textBoxes!.map((textBox) =>
    getTextBoxBounds(textBox),
  )
  expect(isPathCollidingWithObstacles(tracePath, textBounds)).toBe(false)
})

test("does not bypass net-label clearance when the connection belongs to netConnections", () => {
  const inputProblem = createUnambiguousPinTextPaddingProblem({
    directConnections: [],
    netConnections: [
      {
        netId: "USB_DP",
        netLabelWidth: 0.9,
        pinIds: ["R21.pin2", "P1.A6"],
      },
    ],
  })

  const linesSolver = solveLinesStage(inputProblem)
  expect(linesSolver.failedConnectionPairs).toHaveLength(1)
  expect(linesSolver.solvedTracePaths).toHaveLength(0)
})

test("preserves synthetic text clearance around foreign component textBoxes", () => {
  const inputProblem = createUnambiguousPinTextPaddingProblem({
    textBoxes: [
      {
        chipId: "FOREIGN_U502",
        center: { x: 0.26, y: -0.405 },
        width: 1.92,
        height: 0.18,
        text: "USB4105-GF-A-060",
      },
    ],
  })

  const linesSolver = solveLinesStage(inputProblem)
  expect(linesSolver.failedConnectionPairs).toHaveLength(1)
  expect(linesSolver.solvedTracePaths).toHaveLength(0)
})

test("still rejects unlabeled directConnections when actual unpadded textBoxes block all routes", () => {
  const inputProblem = createUnambiguousPinTextPaddingProblem({
    textBoxes: [
      {
        chipId: "P1",
        center: { x: 0.26, y: -0.405 },
        width: 1.92,
        height: 0.18,
        text: "USB4105-GF-A-060",
      },
      {
        chipId: "R21",
        center: { x: 1.45, y: 0 },
        width: 0.7,
        height: 20,
        text: "FULL_WALL_TEXT",
      },
    ],
  })

  const linesSolver = solveLinesStage(inputProblem)
  expect(linesSolver.failedConnectionPairs).toHaveLength(1)
  expect(linesSolver.solvedTracePaths).toHaveLength(0)
})
