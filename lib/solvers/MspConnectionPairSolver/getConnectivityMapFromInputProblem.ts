import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

export const getConnectivityMapsFromInputProblem = (
  inputProblem: InputProblem,
): { directConnMap: ConnectivityMap; netConnMap: ConnectivityMap } => {
  const directConnMap = new ConnectivityMap({})

  for (const directConn of inputProblem.directConnections) {
    directConnMap.addConnections([
      directConn.netId
        ? [directConn.netId, ...directConn.pinIds]
        : directConn.pinIds,
    ])
  }

  // Deep-clone each array so that mutations in netConnMap (e.g. merging net-label
  // pins into an existing direct-wire net) do NOT corrupt directConnMap.
  const clonedNetMap = Object.fromEntries(
    Object.entries(directConnMap.netMap).map(([k, v]) => [k, [...v]]),
  )
  const netConnMap = new ConnectivityMap(clonedNetMap)

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
