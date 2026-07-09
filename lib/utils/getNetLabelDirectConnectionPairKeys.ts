import type { InputProblem } from "lib/types/InputProblem"

/**
 * Direct connections that carry a `netLabelWidth` are net labels: the caller
 * intends `NetLabelPlacementSolver` to render them as labels, not as routed
 * wires. Any solver that turns pin pairs into traces must skip these pairs.
 *
 * Returns the set of pair keys (`[pinA, pinB].sort().join("--")`) for every
 * such connection so callers can look a candidate pair up in O(1).
 */
export const getNetLabelDirectConnectionPairKeys = (
  inputProblem: InputProblem,
): Set<string> => {
  const pairKeys = new Set<string>()
  for (const directConnection of inputProblem.directConnections) {
    if (directConnection.netLabelWidth == null) continue
    pairKeys.add([...directConnection.pinIds].sort().join("--"))
  }
  return pairKeys
}
