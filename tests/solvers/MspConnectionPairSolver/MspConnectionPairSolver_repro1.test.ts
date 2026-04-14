import inputParams from "site/MspConnectionPairSolver/MspConnectionPairSolver01_params.json"
import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_repro1", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputParams.inputProblem as unknown as InputProblem,
  })

  solver.solve()

  // GND is connected only via netConnections with an availableNetLabelOrientation,
  // so it is represented by a net label only and not routed as wire traces (issue #79).
  // VCC and EN have direct connections, so they produce 1 pair each = 2 total.
  expect(solver.mspConnectionPairs.length).toBe(2)
})
