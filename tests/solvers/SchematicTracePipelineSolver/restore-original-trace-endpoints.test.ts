import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { restoreOriginalTraceEndpoints } from "lib/solvers/SchematicTracePipelineSolver/restoreOriginalTraceEndpoints"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputChip } from "lib/types/InputProblem"

const routingChip: InputChip = {
  chipId: "chip",
  center: { x: 0, y: 0 },
  width: 1,
  height: 1,
  pins: [{ pinId: "terminal", x: 0, y: -0.5 }],
}
const routingPin = { ...routingChip.pins[0]!, chipId: routingChip.chipId }
const otherPin = {
  pinId: "other",
  chipId: "other-chip",
  x: -1,
  y: -0.5,
  _facingDirection: "x+" as const,
}
const makeTrace = (
  tracePath: SolvedTracePath["tracePath"],
  firstPin = routingPin,
): SolvedTracePath => ({
  mspPairId: "pair",
  mspConnectionPairIds: ["pair"],
  dcConnNetId: "net",
  globalConnNetId: "net",
  pins: [firstPin, otherPin] as MspConnectionPair["pins"],
  pinIds: [firstPin.pinId, otherPin.pinId],
  tracePath,
})
const restore = (trace: SolvedTracePath) =>
  restoreOriginalTraceEndpoints({
    traces: [trace],
    routingChipById: { chip: routingChip },
    originalPinById: {
      terminal: { x: 0, y: 0, _facingDirection: "x-" },
    },
  })[0]!

for (const atStart of [true, false]) {
  test(`restores a moved ${atStart ? "start" : "end"} endpoint`, () => {
    const path = [
      { x: 0, y: -0.5 },
      { x: -0.7, y: -0.5 },
      { x: -1, y: -0.5 },
    ]
    const restoredTrace = restore(
      makeTrace(atStart ? path : [...path].reverse()),
    )

    expect(
      atStart ? restoredTrace.tracePath[0] : restoredTrace.tracePath.at(-1),
    ).toEqual({ x: 0, y: 0 })
    expect(restoredTrace.tracePath).toContainEqual({ x: -0.7, y: 0 })
    expect(restoredTrace.pins[0]).toMatchObject({ x: 0, y: 0 })
  })
}

test("keeps an endpoint whose routing axis did not change", () => {
  const alignedPin = {
    ...routingPin,
    x: -0.5,
    y: 0,
    _facingDirection: "x-" as const,
  }
  const trace = makeTrace(
    [
      { x: -0.5, y: 0 },
      { x: -1, y: 0 },
    ],
    alignedPin,
  )

  expect(restore(trace)).toEqual(trace)
})
