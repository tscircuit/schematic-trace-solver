import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

export const getConnectivityMapsFromInputProblem = (
  inputProblem: InputProblem,
): { directConnMap: ConnectivityMap; netConnMap: ConnectivityMap } => {
  const directConnMap = new ConnectivityMap({})

  for (const directConn of inputProblem.directConnections) {
    directConnMap.addConnections([directConn.pinIds])
  }

  const netConnMap = new ConnectivityMap(directConnMap.netMap)

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([netConn.pinIds])
  }

  return { directConnMap, netConnMap }
}
