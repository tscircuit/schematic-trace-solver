import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { getGroundGlobalConnNetIds } from "lib/solvers/MspConnectionPairSolver/getGroundGlobalConnNetIds"
import type { InputProblem } from "lib/types/InputProblem"

const pins = (names: string[]) =>
  names.map((name, index) => ({
    pinId: name,
    x: index,
    y: 0,
  }))

const chip = (
  chipId: string,
  pinNames: string[],
): InputProblem["chips"][0] => ({
  chipId,
  center: { x: 0, y: 0 },
  width: 0.4,
  height: 0.4,
  pins: pins(pinNames),
})

test("includes canonical GND and every isGround alias", () => {
  const inputProblem: InputProblem = {
    chips: [chip("U", ["U.1", "U.2", "U.3"])],
    directConnections: [],
    netConnections: [
      { netId: "GND", pinIds: ["U.1"] },
      { netId: "AGND", pinIds: ["U.2"], isGround: true },
      { netId: "VCC", pinIds: ["U.3"] },
    ],
    availableNetLabelOrientations: {
      GND: ["y-"],
      AGND: ["y-"],
      VCC: ["y+"],
    },
  }
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const ids = getGroundGlobalConnNetIds(inputProblem, netConnMap)
  expect(ids.has(netConnMap.getNetConnectedToId("GND")!)).toBe(true)
  expect(ids.has(netConnMap.getNetConnectedToId("AGND")!)).toBe(true)
  expect(ids.has(netConnMap.getNetConnectedToId("VCC")!)).toBe(false)
})

test("does not treat an unmarked alias as ground", () => {
  const inputProblem: InputProblem = {
    chips: [chip("U", ["U.1"])],
    directConnections: [],
    netConnections: [{ netId: "RETURN", pinIds: ["U.1"] }],
    availableNetLabelOrientations: { RETURN: ["y-"] },
  }
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  expect(getGroundGlobalConnNetIds(inputProblem, netConnMap).size).toBe(0)
})
