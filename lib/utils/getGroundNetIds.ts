import type { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

/** Resolve ground declarations to the connectivity IDs used by traces and labels. */
export const getGroundNetIds = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
): Set<string> => {
  const groundNetIds = new Set<string>()
  for (const connection of inputProblem.netConnections) {
    if (!connection.isGround) continue
    const netId = netConnMap.getNetConnectedToId(connection.netId)
    if (netId) groundNetIds.add(netId)
  }
  return groundNetIds
}
