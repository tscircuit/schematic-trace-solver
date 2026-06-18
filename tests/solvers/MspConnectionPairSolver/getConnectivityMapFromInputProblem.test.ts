import { test, expect } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"

test("getConnectivityMapsFromInputProblem returns both maps", () => {
  const inputProblem = {
    chips: [],
    ports: [],
    chipsById: {},
    portsById: {},
    nets: [],
    directConnections: [],
    netConnections: [],
  }

  const result = getConnectivityMapsFromInputProblem(inputProblem as any)

  expect(result.directConnMap).toBeDefined()
  expect(result.netConnMap).toBeDefined()
})

test("getConnectivityMapsFromInputProblem handles empty connections", () => {
  const inputProblem = {
    chips: [],
    ports: [],
    chipsById: {},
    portsById: {},
    nets: [],
    directConnections: [],
    netConnections: [],
  }

  const result = getConnectivityMapsFromInputProblem(inputProblem as any)

  // Both maps should be created successfully
  expect(result.directConnMap).toBeDefined()
  expect(result.netConnMap).toBeDefined()
})
