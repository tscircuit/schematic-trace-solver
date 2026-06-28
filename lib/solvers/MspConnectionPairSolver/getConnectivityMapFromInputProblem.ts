import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

const getExistingNetId = (
  connMap: ConnectivityMap,
  pinIds: string[],
): string | undefined => {
  for (const pinId of pinIds) {
    const connectedNetId = connMap.getNetConnectedToId(pinId)
    if (connectedNetId) return connectedNetId
  }

  return undefined
}

export const getConnectivityMapsFromInputProblem = (
  inputProblem: InputProblem,
): { directConnMap: ConnectivityMap; netConnMap: ConnectivityMap } => {
  const directConnMap = new ConnectivityMap({})

  for (const [index, directConn] of inputProblem.directConnections.entries()) {
    directConnMap.addConnections([[`dc_${index}`, ...directConn.pinIds]])
  }

  const netConnMap = new ConnectivityMap(directConnMap.netMap)

  for (const [index, netConn] of inputProblem.netConnections.entries()) {
    if (netConn.pinIds.length === 0) continue

    const netId =
      getExistingNetId(netConnMap, netConn.pinIds) ?? `nc_${index}`

    netConnMap.addConnections([[netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
