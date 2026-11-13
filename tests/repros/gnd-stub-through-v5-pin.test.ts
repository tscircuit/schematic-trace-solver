import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "./assets/gnd-stub-through-v5-pin.input.json"
import "tests/fixtures/matcher"

// Captured from core 0.0.2359 (schematic-trace-solver 0.0.238). R3 is a reset
// pull-up from RST to V5 (through U1.P1). The GND stub from U1.P2 to its GND
// label used to run straight through R3.pin2, which sits on V5, so the
// schematic drew GND joined to V5.
//
//   <chip name="U1" footprint="soic4"
//     pinLabels={{ pin1: "P1", pin2: "P2", pin3: "P3", pin4: "P4" }}
//     connections={{ P1: "net.V5", P2: "net.GND", P4: "net.RST" }} />
//   <chip name="U3" footprint="soic8"
//     pinLabels={{ pin1: "P1", pin2: "P2", pin3: "P3", pin4: "P4", pin5: "P5", pin6: "P6", pin7: "P7", pin8: "P8" }}
//     connections={{ P1: "net.RST", P3: "net.GND", P7: "net.V5" }} />
//   <resistor name="R3" resistance="10k" footprint="0402" connections={{ pin1: "net.RST", pin2: "U1.P1" }} />
test("GND label stub from U1.P2 does not pass through R3.pin2 on V5", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const netIdByPinId = new Map<string, string>()
  for (const netConnection of inputProblem.netConnections) {
    for (const pinId of netConnection.pinIds) {
      netIdByPinId.set(pinId, netConnection.netId)
    }
  }
  const pins = inputProblem.chips.flatMap((chip) => chip.pins)
  const EPSILON = 1e-6

  const crossings: string[] = []
  for (const trace of solver.inlineNetLabelSolver!.getOutput().traces) {
    const traceNetId = trace.pinIds
      .map((pinId) => netIdByPinId.get(pinId))
      .find(Boolean)
    for (let index = 1; index < trace.tracePath.length; index++) {
      const start = trace.tracePath[index - 1]!
      const end = trace.tracePath[index]!
      for (const pin of pins) {
        if (trace.pinIds.includes(pin.pinId)) continue
        const pinNetId = netIdByPinId.get(pin.pinId)
        if (!pinNetId || pinNetId === traceNetId) continue
        const isOnHorizontalSegment =
          Math.abs(start.y - end.y) < EPSILON &&
          Math.abs(pin.y - start.y) < EPSILON &&
          pin.x > Math.min(start.x, end.x) - EPSILON &&
          pin.x < Math.max(start.x, end.x) + EPSILON
        const isOnVerticalSegment =
          Math.abs(start.x - end.x) < EPSILON &&
          Math.abs(pin.x - start.x) < EPSILON &&
          pin.y > Math.min(start.y, end.y) - EPSILON &&
          pin.y < Math.max(start.y, end.y) + EPSILON
        if (isOnHorizontalSegment || isOnVerticalSegment) {
          crossings.push(
            `${traceNetId} trace through ${pin.pinId} (${pinNetId})`,
          )
        }
      }
    }
  }

  expect(crossings).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
