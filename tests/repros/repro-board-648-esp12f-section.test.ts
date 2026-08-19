import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-board-648-esp12f-section.input.json"

const pointIsExactlyOnPath = ({
  point,
  path,
}: {
  point: Point
  path: Point[]
}) =>
  path.some((start, index) => {
    const end = path[index + 1]
    if (!end) return false
    if (start.x === end.x && point.x === start.x) {
      return (
        point.y >= Math.min(start.y, end.y) &&
        point.y <= Math.max(start.y, end.y)
      )
    }
    if (start.y === end.y && point.y === start.y) {
      return (
        point.x >= Math.min(start.x, end.x) &&
        point.x <= Math.max(start.x, end.x)
      )
    }
    return false
  })

test("board 648 ESP-12F power and boot section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.trimmedSameNetOverlapCount,
  ).toBe(4)
  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.collapsedSameNetHairpinCount,
  ).toBe(1)
  const gndTrace = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_60-schematic_port_43",
  )!
  expect(gndTrace.tracePath).toHaveLength(4)
  expect(
    gndTrace.tracePath.every((point, index, path) => {
      const nextPoint = path[index + 1]
      if (!nextPoint) return true
      return point.x === nextPoint.x || point.y === nextPoint.y
    }),
  ).toBe(true)
  for (let traceIndex = 0; traceIndex < output.traces.length; traceIndex++) {
    const trace = output.traces[traceIndex]!
    const laterSameNetTraces = output.traces
      .slice(traceIndex + 1)
      .filter(
        (candidate) => candidate.globalConnNetId === trace.globalConnNetId,
      )
    expect(
      doesPathCoincideWithTraces(trace.tracePath, laterSameNetTraces),
    ).toBe(false)
  }

  const exactJunctions = [
    {
      incomingTraceId: "schematic_port_57-schematic_port_59",
      incomingEndpointIndex: -1,
      trunkTraceId: "schematic_port_59-schematic_port_42",
    },
    {
      incomingTraceId: "schematic_port_67-schematic_port_57",
      incomingEndpointIndex: 0,
      trunkTraceId: "schematic_port_65-schematic_port_67",
    },
    {
      incomingTraceId: "schematic_port_67-schematic_port_57",
      incomingEndpointIndex: -1,
      trunkTraceId: "schematic_port_57-schematic_port_59",
    },
    {
      incomingTraceId: "schematic_port_60-schematic_port_43",
      incomingEndpointIndex: 0,
      trunkTraceId: "schematic_port_58-schematic_port_60",
    },
  ] as const
  for (const junction of exactJunctions) {
    const incomingTrace = output.traces.find(
      (trace) => trace.mspPairId === junction.incomingTraceId,
    )!
    const trunkTrace = output.traces.find(
      (trace) => trace.mspPairId === junction.trunkTraceId,
    )!
    let incomingEndpoint = incomingTrace.tracePath[0]!
    if (junction.incomingEndpointIndex === -1) {
      incomingEndpoint = incomingTrace.tracePath.at(-1)!
    }
    expect(
      pointIsExactlyOnPath({
        point: incomingEndpoint,
        path: trunkTrace.tracePath,
      }),
    ).toBe(true)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
