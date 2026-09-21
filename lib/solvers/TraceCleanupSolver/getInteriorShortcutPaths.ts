import type { Point } from "@tscircuit/math-utils"
import { simplifyPath } from "./simplifyPath"
import { tryConnectPoints } from "./tryConnectPoints"

export const getInteriorShortcutPaths = (path: Point[]): Point[][] => {
  const candidates: Point[][] = [path]
  // Keep the terminal segments so shortcuts preserve the pin exit directions.
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
        const preservesTerminalDirections = [0, path.length - 1].every(
          (index) => {
            let neighborIndex = 1
            let candidateNeighbor = candidate[1]!
            if (index !== 0) {
              neighborIndex = path.length - 2
              candidateNeighbor = candidate.at(-2)!
            }
            const endpoint = path[index]!
            const neighbor = path[neighborIndex]!
            return (
              (neighbor.x - endpoint.x) * (candidateNeighbor.x - endpoint.x) +
                (neighbor.y - endpoint.y) * (candidateNeighbor.y - endpoint.y) >
              0
            )
          },
        )
        if (preservesTerminalDirections) candidates.push(candidate)
      }
    }
  }
  return candidates
}
