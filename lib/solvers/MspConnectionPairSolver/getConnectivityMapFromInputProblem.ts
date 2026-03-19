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

  // Deep-clone the netMap so that netConnMap mutations (adding net-label
  // connections) don't pollute directConnMap.  Without this, net-label-only
  // connections leak into directConnMap and cause spurious MSP pairs / traces.
  const clonedNetMap: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(directConnMap.netMap)) {
    clonedNetMap[key] = [...ids]
  }
  const netConnMap = new ConnectivityMap(clonedNetMap)

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
