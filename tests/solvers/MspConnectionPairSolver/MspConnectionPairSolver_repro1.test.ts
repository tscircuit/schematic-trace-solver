import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // Input has 2 directConnections (VCC: U1.1-C1.1, EN: U1.2-C2.1) and 1
  // netConnection (GND: U1.3, C2.2, C1.2). Net-label-only nets must NOT
  // generate MSP pairs — they're placed as labels in a later phase. So we
  // expect exactly 2 pairs (one per direct connection), not the previous 4
  // which incorrectly included the MST edges of the GND net. See #79.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
