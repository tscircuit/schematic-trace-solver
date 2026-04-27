import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { getConnectivityMapsFromInputProblem } from "../MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { OverlappingSameNetTraceGroup } from "./NetLabelPlacementSolver"

/**
 * Build the per-net trace groups consumed by both
 * NetLabelPlacementSolver (multi-pin host-trace groups) and
 * SinglePinNetLabelPlacementPipelineSolver (port-only groups, one per
 * pin in a net component with no traces).
 *
 * Extracted out of NetLabelPlacementSolver so the two solvers share the
 * grouping rules without depending on each other.
 */
export function computeOverlappingSameNetTraceGroups(params: {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
}): OverlappingSameNetTraceGroup[] {
  const { inputProblem, inputTraceMap } = params

  const byGlobal: Record<string, Array<SolvedTracePath>> = {}
  for (const trace of Object.values(inputTraceMap)) {
    const key = trace.globalConnNetId
    if (!byGlobal[key]) byGlobal[key] = []
    byGlobal[key].push(trace)
  }

  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

  const pinIdToPinMap = new Map<string, unknown>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      pinIdToPinMap.set(pin.pinId, pin)
    }
  }

  const userNetIdByPinId: Record<string, string | undefined> = {}
  for (const dc of inputProblem.directConnections) {
    if (dc.netId) {
      const [a, b] = dc.pinIds
      userNetIdByPinId[a] = dc.netId
      userNetIdByPinId[b] = dc.netId
    }
  }
  for (const nc of inputProblem.netConnections) {
    for (const pid of nc.pinIds) {
      userNetIdByPinId[pid] = nc.netId
    }
  }

  const groups: OverlappingSameNetTraceGroup[] = []

  const allPinIds = inputProblem.chips.flatMap((c) =>
    c.pins.map((p) => p.pinId),
  )

  const allGlobalConnNetIds = new Set<string>()
  for (const pinId of allPinIds) {
    const netId = netConnMap.getNetConnectedToId(pinId)
    if (netId) allGlobalConnNetIds.add(netId)
  }

  for (const globalConnNetId of allGlobalConnNetIds) {
    const allIdsInNet = netConnMap.getIdsConnectedToNet(
      globalConnNetId,
    ) as string[]
    const pinsInNet = allIdsInNet.filter((id) => pinIdToPinMap.has(id))

    const adj: Record<string, Set<string>> = {}
    for (const pid of pinsInNet) adj[pid] = new Set()
    for (const t of byGlobal[globalConnNetId] ?? []) {
      const a = t.pins[0].pinId
      const b = t.pins[1].pinId
      if (adj[a] && adj[b]) {
        adj[a].add(b)
        adj[b].add(a)
      }
    }

    const visited = new Set<string>()
    for (const pid of pinsInNet) {
      if (visited.has(pid)) continue
      const stack = [pid]
      const component = new Set<string>()
      visited.add(pid)
      while (stack.length > 0) {
        const u = stack.pop()!
        component.add(u)
        for (const v of adj[u] ?? []) {
          if (!visited.has(v)) {
            visited.add(v)
            stack.push(v)
          }
        }
      }

      const compTraces = (byGlobal[globalConnNetId] ?? []).filter(
        (t) => component.has(t.pins[0].pinId) && component.has(t.pins[1].pinId),
      )

      if (compTraces.length > 0) {
        const lengthOf = (path: SolvedTracePath) => {
          let sum = 0
          const pts = path.tracePath
          for (let i = 0; i < pts.length - 1; i++) {
            sum +=
              Math.abs(pts[i + 1]!.x - pts[i]!.x) +
              Math.abs(pts[i + 1]!.y - pts[i]!.y)
          }
          return sum
        }
        let rep = compTraces[0]!
        let repLen = lengthOf(rep)
        for (let i = 1; i < compTraces.length; i++) {
          const len = lengthOf(compTraces[i]!)
          if (len > repLen) {
            rep = compTraces[i]!
            repLen = len
          }
        }

        let userNetId = compTraces.find((t) => t.userNetId != null)?.userNetId
        if (!userNetId) {
          for (const p of component) {
            if (userNetIdByPinId[p]) {
              userNetId = userNetIdByPinId[p]
              break
            }
          }
        }
        const mspConnectionPairIds = Array.from(
          new Set(
            compTraces.flatMap((t) => t.mspConnectionPairIds ?? [t.mspPairId]),
          ),
        )

        groups.push({
          globalConnNetId,
          netId: userNetId,
          overlappingTraces: rep,
          mspConnectionPairIds,
        })
      } else {
        for (const p of component) {
          const userNetId = userNetIdByPinId[p]
          if (!userNetId) continue
          groups.push({
            globalConnNetId,
            netId: userNetId,
            portOnlyPinId: p,
          })
        }
      }
    }
  }

  return groups
}
