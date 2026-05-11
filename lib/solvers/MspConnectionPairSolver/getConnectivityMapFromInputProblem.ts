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

  // Deep-clone before seeding netConnMap. ConnectivityMap retains a reference
  // to the constructor argument, so subsequent addConnections on netConnMap
  // would otherwise mutate directConnMap.netMap and merge net-label-only pins
  // into the direct-wire connectivity.
  const netConnMap = new ConnectivityMap(structuredClone(directConnMap.netMap))

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
