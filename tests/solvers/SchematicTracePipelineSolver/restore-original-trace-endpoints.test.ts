import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import {
  getOriginalPinById,
  restoreOriginalTraceEndpoints,
} from "lib/solvers/SchematicTracePipelineSolver/restoreOriginalTraceEndpoints"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"

const makeProblem = (pin: InputPin): InputProblem => ({
  chips: [
    {
      chipId: "chip",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [pin],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
})

const originalProblem = makeProblem({
  pinId: "terminal",
  x: 0,
  y: 0,
  _facingDirection: "x-",
})
const routingProblem = makeProblem({ pinId: "terminal", x: 0, y: -0.5 })
const routingPin = {
  ...routingProblem.chips[0]!.pins[0]!,
  chipId: "chip",
}
const otherPin = {
  pinId: "other",
  chipId: "other-chip",
  x: -1,
  y: -0.5,
  _facingDirection: "x+" as const,
}

const makeTrace = (
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath => ({
  mspPairId: "pair",
  mspConnectionPairIds: ["pair"],
  dcConnNetId: "net",
  globalConnNetId: "net",
  pins: [routingPin, otherPin] as MspConnectionPair["pins"],
  pinIds: [routingPin.pinId, otherPin.pinId],
  tracePath,
})

for (const atStart of [true, false]) {
  test(`restores a moved ${atStart ? "start" : "end"} endpoint`, () => {
    const path = [
      { x: 0, y: -0.5 },
      { x: -0.7, y: -0.5 },
      { x: -1, y: -0.5 },
    ]
    const trace = makeTrace(atStart ? path : [...path].reverse())

    const [restoredTrace] = restoreOriginalTraceEndpoints({
      traces: [trace],
      routingProblem,
      originalPinById: getOriginalPinById(originalProblem),
    })

    expect(
      atStart ? restoredTrace!.tracePath[0] : restoredTrace!.tracePath.at(-1),
    ).toEqual({ x: 0, y: 0 })
    expect(restoredTrace!.tracePath).toContainEqual({ x: -0.7, y: 0 })
    expect(restoredTrace!.pins[0]).toMatchObject({ x: 0, y: 0 })
  })
}

test("keeps an endpoint whose routing axis did not change", () => {
  const alignedRoutingProblem = makeProblem({
    pinId: "terminal",
    x: -0.5,
    y: 0,
    _facingDirection: "x-",
  })
  const alignedRoutingPin = {
    ...alignedRoutingProblem.chips[0]!.pins[0]!,
    chipId: "chip",
  }
  const trace = {
    ...makeTrace([
      { x: -0.5, y: 0 },
      { x: -1, y: 0 },
    ]),
    pins: [alignedRoutingPin, otherPin] as MspConnectionPair["pins"],
  }

  const [unchangedTrace] = restoreOriginalTraceEndpoints({
    traces: [trace],
    routingProblem: alignedRoutingProblem,
    originalPinById: getOriginalPinById(originalProblem),
  })

  expect(unchangedTrace!.tracePath).toEqual(trace.tracePath)
  expect(unchangedTrace!.pins).toEqual(trace.pins)
})
