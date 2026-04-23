import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // Only directConnections produce MSP pairs (VCC: U1.1↔C1.1, EN: U1.2↔C2.1).
  // GND is a netConnection and should only receive net labels, not traces.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
