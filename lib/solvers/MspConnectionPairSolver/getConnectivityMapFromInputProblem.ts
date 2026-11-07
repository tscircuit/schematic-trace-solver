import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Creates connectivity maps from the input problem.
 *
 * CRITICAL FIX: Direct connections and net connections with the same netId
 * are NO LONGER automatically merged together. This prevents traces from
 * incorrectly jumping/connecting to other pins that happen to share the same
 * net name but are not part of the same electrical connection.
 *
 * The connectivity is determined by:
 * 1. Direct connections: Each is treated as its own connectivity island
 * 2. Net connections: Each is treated as its own connectivity island
 *
 * Two pins are ONLY considered connected if they are explicitly listed in
 * the SAME directConnection or SAME netConnection entry. Sharing a netId
 * alone does NOT make pins connected.
 *
 * Edge cases handled:
 * - Multiple directConnections with the same netId remain separate
 * - Multiple netConnections with the same netId remain separate
 * - Empty pinIds arrays are safely handled
 * - Single-pin connections are valid (won't create pairs)
 */
export const getConnectivityMapsFromInputProblem = (
  inputProblem: InputProblem,
): { directConnMap: ConnectivityMap; netConnMap: ConnectivityMap } => {
  const directConnMap = new ConnectivityMap({})

  // DEFENSIVE FIX: Each directConnection is added as its own connectivity island.
  // Previously, directConnections with the same netId were merged together,
  // causing traces to incorrectly connect to pins from different directConnections.
  // Now we use a unique synthetic net ID (dc_<index>) to keep them separate.
  //
  // Note: directConn.pinIds is typed as [PinId, PinId] tuple (always 2 elements),
  // so no validation for empty arrays is needed here.
  for (let i = 0; i < inputProblem.directConnections.length; i++) {
    const directConn = inputProblem.directConnections[i]!

    // Create a unique synthetic net ID for this direct connection.
    // This prevents different directConnections with the same netId from
    // being merged, which was causing traces to jump to unrelated pins.
    const syntheticNetId = `dc_${i}`
    directConnMap.addConnections([[syntheticNetId, ...directConn.pinIds]])
  }

  const netConnMap = new ConnectivityMap(directConnMap.netMap)

  // DEFENSIVE: Each netConnection is added as a separate connectivity island.
  // We use a unique synthetic net ID (nc_<index>) to prevent different
  // netConnection objects with the same netId from being merged together.
  for (let i = 0; i < inputProblem.netConnections.length; i++) {
    const netConn = inputProblem.netConnections[i]!

    // Validate: skip if no pins to connect
    if (!netConn.pinIds || netConn.pinIds.length === 0) {
      continue
    }

    // Check if any pins in this netConnection are already connected via
    // directConnections. If so, we extend that existing connectivity.
    // Otherwise, create a unique island for this netConnection.
    const existingNetId = netConn.pinIds
      .map((pinId) => directConnMap.getNetConnectedToId(pinId))
      .find((netId) => netId !== undefined)

    if (existingNetId) {
      // At least one pin is already in the direct connection map,
      // add all pins from this netConnection to that existing net
      netConnMap.addConnections([[existingNetId, ...netConn.pinIds]])
    } else {
      // No pins are already connected via directConnections.
      // Create a unique synthetic net ID to keep this netConnection
      // separate from other netConnections with the same netId.
      const syntheticNetId = `nc_${i}`
      netConnMap.addConnections([[syntheticNetId, ...netConn.pinIds]])
    }
  }

  return { directConnMap, netConnMap }
}
