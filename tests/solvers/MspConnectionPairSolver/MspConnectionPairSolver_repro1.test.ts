import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // Only direct connections should create routed MSP pairs. Net connections are
  // represented by net labels instead of additional schematic wire traces.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
