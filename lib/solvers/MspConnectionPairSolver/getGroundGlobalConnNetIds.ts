import type { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Ground policy used to key off the literal net name "GND", so aliases that
 * core already marks `isGround` (AGND, VSS, USB_GND, …) were treated as
 * ordinary signal nets. Collect every connectivity id that is either the
 * canonical "GND" name or an `isGround` net connection.
 */
export const getGroundGlobalConnNetIds = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
): Set<string> => {
  const ids = new Set<string>()
  const add = (key: string | undefined) => {
    if (!key) return
    const id = netConnMap.getNetConnectedToId(key)
    if (id) ids.add(id)
  }
  add("GND")
  for (const net of inputProblem.netConnections) {
    if (!net.isGround) continue
    add(net.netId)
    for (const pinId of net.pinIds) add(pinId)
  }
  return ids
}
