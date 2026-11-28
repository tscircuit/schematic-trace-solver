import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { InputProblem } from "lib/types/InputProblem"
import { getConnectivityMapsFromInputProblem } from "../MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { OverlappingSameNetTraceGroup } from "./NetLabelPlacementSolver"

export function computeOverlappingSameNetTraceGroups(params: {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
}): Array<OverlappingSameNetTraceGroup> {
  const { inputProblem, inputTraceMap } = params
  // Group existing traces by their global connectivity net id.
  const byGlobal: Record<string, Array<SolvedTracePath>> = {}
  for (const trace of Object.values(inputTraceMap)) {
    const key = trace.globalConnNetId
    if (!byGlobal[key]) byGlobal[key] = []
    byGlobal[key].push(trace)
  }

  // Build global connectivity from input so we also consider pins with no traces
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

  const pinIdToPinMap = new Map<string, unknown>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      pinIdToPinMap.set(pin.pinId, pin)
    }
  }

  // Map pins to user-provided connectivity ids and display text (if any).
  const userNetIdByPinId: Record<string, string | undefined> = {}
  const netLabelTextByPinId: Record<string, string | undefined> = {}
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

  // Consider every global connectivity net id
  for (const globalConnNetId of allGlobalConnNetIds) {
    const allIdsInNet = netConnMap.getIdsConnectedToNet(
      globalConnNetId,
    ) as string[]
    const pinsInNet = allIdsInNet.filter((id) => pinIdToPinMap.has(id))

    for (const traceConnectedComponent of getTraceConnectedPinComponents({
      pinIds: pinsInNet,
      traces: byGlobal[globalConnNetId] ?? [],
    })) {
      const component = new Set(traceConnectedComponent.pinIds)
      const compTraces = traceConnectedComponent.traces

      if (compTraces.length > 0) {
        // This routed trace exists specifically because two endpoint labels
        // could not fit in the available gap. Do not replace that pair with
        // one redundant long label on the newly routed wire. If routing had
        // failed there would be no trace here, so the port-only fallback
        // branch below would still label both endpoints.
        if (compTraces.some((trace) => trace.suppressNetLabel)) continue

        // Choose a representative trace (longest by L1 length)
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

        const group = {
          globalConnNetId,
          netId: userNetId,
          netLabelText: [...component]
            .map((pinId) => netLabelTextByPinId[pinId])
            .find((text): text is string => Boolean(text)),
          overlappingTraces: rep,
          mspConnectionPairIds,
        }
        groups.push(group)
      } else {
        // No traces in this component: place label at each pin that has a user net id
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
