import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

export const getNetConnectionIdsWithLabelOrientations = (
  inputProblem: InputProblem,
): Set<string> => {
  const netIds = new Set<string>()
  for (const netConn of inputProblem.netConnections) {
    if (inputProblem.availableNetLabelOrientations[netConn.netId]?.length) {
      netIds.add(netConn.netId)
    }
  }
  return netIds
}

export const isGlobalNetHandledByLabels = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
  netId: string,
): boolean => {
  const netIdsWithLabels =
    getNetConnectionIdsWithLabelOrientations(inputProblem)
  if (netIdsWithLabels.has(netId)) return true

  const allIds = netConnMap.getIdsConnectedToNet(netId) as string[]
  return allIds.some((id) => netIdsWithLabels.has(id))
}

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

  const netConnMap = new ConnectivityMap(
    Object.fromEntries(
      Object.entries(directConnMap.netMap).map(([netId, ids]) => [
        netId,
        [...ids],
      ]),
    ),
  )

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
