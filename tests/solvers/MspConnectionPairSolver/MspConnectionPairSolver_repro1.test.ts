import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // GND is a net-label-only connection (only in netConnections, not
  // directConnections), so no MSP pair is created for it. Only VCC and EN
  // have direct connections, producing 2 MSP pairs.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
