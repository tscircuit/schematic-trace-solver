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

  // Deep-clone the direct-connection netMap before seeding netConnMap.
  // ConnectivityMap keeps a reference to the object it is constructed with (and
  // mutates its inner arrays via addConnections), so passing directConnMap.netMap
  // directly would let net-label connections leak back into directConnMap and
  // pollute the pure direct-wire connectivity.
  const netConnMap = new ConnectivityMap(structuredClone(directConnMap.netMap))

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
