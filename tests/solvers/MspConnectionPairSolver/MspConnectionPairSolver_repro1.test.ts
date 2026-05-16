import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // Two MSP pairs come from the two directConnections (VCC: U1.1↔C1.1,
  // EN: U1.2↔C2.1). The GND net is expressed only via netConnections, so
  // its three pins are placed as net labels rather than routed traces —
  // no MSP pairs from that net. See issue #79 / repro61 for context.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
