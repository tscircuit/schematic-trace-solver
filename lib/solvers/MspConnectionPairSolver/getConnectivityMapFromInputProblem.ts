import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

export const getConnectivityMapsFromInputProblem = (
  inputProblem: InputProblem,
): { directConnMap: ConnectivityMap; netConnMap: ConnectivityMap } => {
  const directConnMap = new ConnectivityMap({})

  for (let i = 0; i < inputProblem.directConnections.length; i++) {
    const directConn = inputProblem.directConnections[i]
    // Use a unique ID for each direct connection to prevent jumping between nets
    // with the same name.
    const syntheticId = `dc_${i}`
    directConnMap.addConnections([[syntheticId, ...directConn.pinIds]])
  }

  const netConnMap = new ConnectivityMap(directConnMap.netMap)

  for (let i = 0; i < inputProblem.netConnections.length; i++) {
    const netConn = inputProblem.netConnections[i]
    // Use a unique ID for each net connection
    const syntheticId = `nc_${i}`
    netConnMap.addConnections([[syntheticId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
