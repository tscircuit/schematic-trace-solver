import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

export const isGlobalNetHandledByLabels = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
  globalNetId: string,
): boolean => {
  const labelOnlyNetIds = new Set(
    inputProblem.netConnections
      .filter((netConn) => {
        return inputProblem.availableNetLabelOrientations[netConn.netId]?.length
      })
      .map((netConn) => netConn.netId),
  )

  if (labelOnlyNetIds.has(globalNetId)) return true

  const directRoutedIds = new Set<string>()
  for (const directConn of inputProblem.directConnections) {
    if (directConn.netId) directRoutedIds.add(directConn.netId)
    for (const pinId of directConn.pinIds) {
      directRoutedIds.add(pinId)
    }
  }

  const allIds = netConnMap.getIdsConnectedToNet(globalNetId) as string[]
  if (allIds.some((id) => directRoutedIds.has(id))) return false

  return allIds.some((id) => labelOnlyNetIds.has(id))
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
