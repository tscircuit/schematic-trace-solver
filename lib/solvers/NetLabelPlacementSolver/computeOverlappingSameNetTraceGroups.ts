import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import { getConnectivityMapsFromInputProblem } from "../MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { OverlappingSameNetTraceGroup } from "./NetLabelPlacementSolver"

export function computeOverlappingSameNetTraceGroups(params: {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
}): Array<OverlappingSameNetTraceGroup> {
  const { inputProblem, inputTraceMap } = params
  const byGlobal: Record<string, Array<SolvedTracePath>> = {}
  for (const trace of Object.values(inputTraceMap)) {
    const key = trace.globalConnNetId
    if (!byGlobal[key]) byGlobal[key] = []
    byGlobal[key].push(trace)
  }

  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

  const knownPinIds = new Set<PinId>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      knownPinIds.add(pin.pinId)
    }
  }

  const userNetIdByPinId: Record<PinId, string | undefined> = {}
  const netLabelTextByPinId: Record<PinId, string | undefined> = {}
  for (const dc of inputProblem.directConnections) {
    if (dc.netId) {
      const [a, b] = dc.pinIds
      userNetIdByPinId[a] = dc.netId
      userNetIdByPinId[b] = dc.netId
    }
    const netLabelText = dc.netLabelText?.trim()
    if (netLabelText) {
      const [a, b] = dc.pinIds
      netLabelTextByPinId[a] = netLabelText
      netLabelTextByPinId[b] = netLabelText
    }
  }
  for (const nc of inputProblem.netConnections) {
    for (const pid of nc.pinIds) {
      userNetIdByPinId[pid] = nc.netId
      const netLabelText = nc.netLabelText?.trim()
      if (netLabelText) netLabelTextByPinId[pid] = netLabelText
    }
  }

  const groups: Array<OverlappingSameNetTraceGroup> = []

  const allPinIds = inputProblem.chips.flatMap((c) =>
    c.pins.map((p) => p.pinId),
  )

  const allGlobalConnNetIds = new Set<string>()
  for (const pinId of allPinIds) {
    const netId = netConnMap.getNetConnectedToId(pinId)
    if (netId) {
      allGlobalConnNetIds.add(netId)
    }
  }

  for (const globalConnNetId of allGlobalConnNetIds) {
    const allIdsInNet = netConnMap.getIdsConnectedToNet(
      globalConnNetId,
    ) as PinId[]
    const pinsInNet = allIdsInNet.filter((id) => knownPinIds.has(id))

    for (const traceConnectedComponent of getTraceConnectedPinComponents({
      pinIds: pinsInNet,
      traces: byGlobal[globalConnNetId] ?? [],
    })) {
      const component = new Set(traceConnectedComponent.pinIds)
      const compTraces = traceConnectedComponent.traces

      if (compTraces.length > 0) {
        if (compTraces.some((trace) => trace.suppressNetLabel)) continue

        let rep = compTraces[0]!
        let repLen = -1
        for (const candidateTrace of compTraces) {
          let len = 0
          const pts = candidateTrace.tracePath
          for (let j = 0; j < pts.length - 1; j++) {
            len +=
              Math.abs(pts[j + 1]!.x - pts[j]!.x) +
              Math.abs(pts[j + 1]!.y - pts[j]!.y)
          }
          if (len > repLen) {
            rep = candidateTrace
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
          netLabelText: [...component]
            .map((pinId) => netLabelTextByPinId[pinId])
            .find((text): text is string => Boolean(text)),
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
            netLabelText: netLabelTextByPinId[p],
            portOnlyPinId: p,
          })
        }
      }
    }
  }

  return groups
}
