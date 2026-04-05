import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // GND is only in netConnections (net label, no directConnections), so it
  // no longer generates MSP pairs after the issue #79 fix. Only the 2 direct
  // connections (VCC: U1.1↔C1.1, EN: U1.2↔C2.1) produce pairs.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
