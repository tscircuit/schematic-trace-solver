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

  // ConnectivityMap stores the netMap by reference; if we passed
  // `directConnMap.netMap` directly, subsequent `netConnMap.addConnections`
  // calls would mutate `directConnMap` too, polluting the "direct only" view.
  // Clone so the two maps stay independent. (See repro61, tscircuit/schematic-trace-solver#79.)
  const netConnMap = new ConnectivityMap(structuredClone(directConnMap.netMap))

  for (const netConn of inputProblem.netConnections) {
    netConnMap.addConnections([[netConn.netId, ...netConn.pinIds]])
  }

  return { directConnMap, netConnMap }
}
