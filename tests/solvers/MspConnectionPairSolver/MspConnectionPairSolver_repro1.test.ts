import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // Only nets that have at least one pin in a direct wire connection generate
  // MSP pairs. The GND net (U1.3, C2.2, C1.2) is connected only via a
  // netConnection (net label) so it should NOT produce traces.
  // The 2 direct-wire nets (VCC: U1.1-C1.1, EN: U1.2-C2.1) each produce 1
  // pair → total 2 pairs.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
