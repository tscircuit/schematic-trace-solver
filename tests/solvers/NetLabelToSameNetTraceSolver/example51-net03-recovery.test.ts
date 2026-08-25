import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/example51.json"

const solveExample51 = (problem: typeof inputProblem = inputProblem) => {
  const solver = new SchematicTracePipelineSolver(problem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  return solver
    .netLabelToSameNetTraceSolver!.getOutput()
    .netLabelPlacements.filter(
      (label) => label.globalConnNetId === "connectivity_net11",
    )
}

test("example51 connects NET_03 branches while retaining one y+ label", () => {
  const net03Labels = solveExample51()

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

  expect(solveExample51(powerProblem)).toHaveLength(1)
})
