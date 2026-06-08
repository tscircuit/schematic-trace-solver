import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // This input has two direct connections (VCC: U1.1-C1.1, EN: U1.2-C2.1) and
  // one net-label-only net (GND: U1.3, C2.2, C1.2). Only the two direct
  // connections may be routed as msp pairs; the GND net is placed as net labels
  // instead, so it must not contribute any msp pairs. See issue #79.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
