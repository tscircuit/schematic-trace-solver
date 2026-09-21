import type { Point } from "@tscircuit/math-utils"
import { simplifyPath } from "./simplifyPath"
import { tryConnectPoints } from "./tryConnectPoints"

export const getInteriorShortcutPaths = (path: Point[]): Point[][] => {
  const candidates: Point[][] = [path]
  // Reconnect interior points to remove old loops left behind by a connector detour.
  for (let startIndex = 1; startIndex < path.length - 3; startIndex++) {
    for (
      let endIndex = startIndex + 2;
      endIndex < path.length - 1;
      endIndex++
    ) {
      for (const connection of tryConnectPoints(
        path[startIndex]!,
        path[endIndex]!,
      )) {
        const candidate = simplifyPath([
          ...path.slice(0, startIndex),
          ...connection,
          ...path.slice(endIndex + 1),
        ])
        const preservesTerminalDirections = [
          [0, 1],
          [-1, -2],
        ].every(([endIndex, neighborIndex]) => {
          const endpoint = path.at(endIndex!)!
          const neighbor = path.at(neighborIndex!)!
          const candidateNeighbor = candidate.at(neighborIndex!)!
          return (
            (neighbor.x - endpoint.x) * (candidateNeighbor.x - endpoint.x) +
              (neighbor.y - endpoint.y) * (candidateNeighbor.y - endpoint.y) >
            0
          )
        })
        if (preservesTerminalDirections) candidates.push(candidate)
      }
    }
  }
  return candidates
}
