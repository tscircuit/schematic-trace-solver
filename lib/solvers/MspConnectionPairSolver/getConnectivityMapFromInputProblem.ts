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

  // Deep-clone the directConnMap netMap so that subsequent mutations on
  // netConnMap (via addConnections) do not bleed back into directConnMap.
  // ConnectivityMap stores arrays by reference, so a shallow copy is not
  // enough — each net's pin array must be cloned too.
  const seededNetMap: Record<string, string[]> = {}
  for (const [netId, ids] of Object.entries(directConnMap.netMap)) {
    seededNetMap[netId] = [...ids]
  }
  const netConnMap = new ConnectivityMap(seededNetMap)

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
