import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

const cloneNetMap = (
  netMap: Record<string, string[]>,
): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(netMap).map(([netId, ids]) => [netId, [...ids]]),
  )

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

  const netConnMap = new ConnectivityMap(cloneNetMap(directConnMap.netMap))

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
