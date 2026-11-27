import type { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

/** Resolve ground declarations to the connectivity IDs used by traces and labels. */
export const getGroundNetIds = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
  opts?: { includeDefaultGroundName?: boolean },
): Set<string> => {
  const groundNetIds = new Set<string>()
  const explicitlyNonGroundNetIds = new Set<string>()
  for (const connection of inputProblem.netConnections) {
    const netId = netConnMap.getNetConnectedToId(connection.netId)
    if (!netId) continue
    if (connection.isGround === true) {
      groundNetIds.add(netId)
    } else if (connection.isGround === false) {
      explicitlyNonGroundNetIds.add(netId)
    }
  }
  if (opts?.includeDefaultGroundName) {
    const defaultGroundNetId = netConnMap.getNetConnectedToId("GND")
    if (
      defaultGroundNetId &&
      !explicitlyNonGroundNetIds.has(defaultGroundNetId)
    ) {
      groundNetIds.add(defaultGroundNetId)
    }
  }
  return groundNetIds
}
