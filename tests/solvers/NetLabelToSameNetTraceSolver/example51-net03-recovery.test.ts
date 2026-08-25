import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/example51.json"

const solveExample51 = (problem: typeof inputProblem = inputProblem) => {
  const solver = new SchematicTracePipelineSolver(problem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  return solver.netLabelToSameNetTraceSolver!.getOutput()
}

test("example51 connects NET_03 branches while retaining one y+ label", () => {
  const net03Labels = solveExample51().netLabelPlacements.filter(
    (label) => label.globalConnNetId === "connectivity_net11",
  )

  expect(net03Labels).toHaveLength(1)
  expect(net03Labels[0]!.orientation).toBe("y+")
})

test("example51 retains one label for an explicit power net", () => {
  const powerProblem = structuredClone(inputProblem)
  powerProblem.availableNetLabelOrientations.NET_03 = ["x+"]
  const net03Connection = powerProblem.netConnections.find(
    (connection) => connection.netId === "NET_03",
  )!
  ;(
    net03Connection as typeof net03Connection & { isPowerNet: boolean }
  ).isPowerNet = true

  expect(
    solveExample51(powerProblem).netLabelPlacements.filter(
      (label) => label.globalConnNetId === "connectivity_net11",
    ),
  ).toHaveLength(1)
})

test("example51 connects component 36 NET_01 to the same-net trace", () => {
  const output = solveExample51()
  const net01Labels = output.netLabelPlacements.filter(
    (label) => label.globalConnNetId === "connectivity_net9",
  )
  const component36Recovery = output.traces.find(
    (trace) =>
      trace.globalConnNetId === "connectivity_net9" &&
      trace.mspPairId.startsWith("net-label-trace-junction-") &&
      trace.pinIds.includes("schematic_port_73"),
  )

  expect(net01Labels).toHaveLength(1)
  expect(component36Recovery).toBeDefined()
})

test("example51 connects component 36 left pin to the PPHV rail", () => {
  const output = solveExample51()
  const pphvLabels = output.netLabelPlacements.filter(
    (label) => label.netId === "PPHV",
  )
  const component36Recovery = output.traces.find(
    (trace) =>
      trace.globalConnNetId === "connectivity_net6" &&
      trace.mspPairId.startsWith("net-label-trace-junction-") &&
      trace.pinIds.includes("schematic_port_72"),
  )

  expect(pphvLabels.length).toBeGreaterThanOrEqual(1)
  expect(component36Recovery).toBeDefined()
})
