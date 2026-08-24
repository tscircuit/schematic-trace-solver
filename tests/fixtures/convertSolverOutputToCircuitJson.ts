import type { Point } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  SchematicBox,
  SchematicComponent,
  SchematicNetLabel,
  SchematicPort,
  SchematicText,
  SchematicTrace,
  SourceNet,
  SourcePort,
  SourceSimpleChip,
  SourceTrace,
} from "circuit-json"
import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

type SnapshotTrace = Partial<SolvedTracePath> & {
  tracePath: Point[]
  mspPairId?: string
  netId?: string
}

type SolverOutput = {
  traces?: SnapshotTrace[]
  allTraces?: SnapshotTrace[]
  allTracesMerged?: SnapshotTrace[]
  netLabelPlacements?: NetLabelPlacement[]
  inlineNetLabelPlacements?: InlineNetLabelPlacement[]
}

type SolverLike = BaseSolver & {
  inputProblem?: InputProblem
  problem?: InputProblem
  input?: {
    inputProblem?: InputProblem
    problem?: InputProblem
    traces?: SnapshotTrace[]
    allTraces?: SnapshotTrace[]
    allLabelPlacements?: NetLabelPlacement[]
    netLabelPlacements?: NetLabelPlacement[]
  }
  params?: { inputProblem?: InputProblem }
  traces?: SnapshotTrace[]
  allTraces?: SnapshotTrace[]
  outputTraces?: SnapshotTrace[]
  solvedTracePaths?: SnapshotTrace[]
  solvedTracePath?: Point[] | null
  initialTrace?: SnapshotTrace
  connectionPair?: Partial<SnapshotTrace>
  pins?: Array<InputPin & { chipId?: string }>
  netLabelPlacements?: NetLabelPlacement[]
  outputNetLabelPlacements?: NetLabelPlacement[]
  inputNetLabelPlacements?: NetLabelPlacement[]
  initialNetLabelPlacements?: NetLabelPlacement[]
  inlineNetLabelPlacements?: InlineNetLabelPlacement[]
  label?: NetLabelPlacement
  getOutput?: () => SolverOutput
  inlineNetLabelSolver?: { getOutput: () => SolverOutput }
}

const isInputProblem = (value: unknown): value is InputProblem => {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<InputProblem>
  return (
    Array.isArray(candidate.chips) &&
    Array.isArray(candidate.directConnections) &&
    Array.isArray(candidate.netConnections)
  )
}

export const getInputProblemFromSolver = (
  solver: BaseSolver,
): InputProblem | undefined => {
  const candidate = solver as SolverLike
  const possibleInputs = [
    candidate.inputProblem,
    candidate.problem,
    candidate.input?.inputProblem,
    candidate.input?.problem,
    candidate.params?.inputProblem,
  ]

  return possibleInputs.find(isInputProblem)
}

const safelyGetOutput = (solver: SolverLike): SolverOutput | undefined => {
  try {
    if (solver.inlineNetLabelSolver?.getOutput) {
      return solver.inlineNetLabelSolver.getOutput()
    }
    return solver.getOutput?.()
  } catch {
    // A partially solved solver can expose getOutput before it is ready. The
    // property fallbacks below still produce a useful snapshot in that case.
    return undefined
  }
}

const isTraceArray = (value: unknown): value is SnapshotTrace[] =>
  Array.isArray(value) &&
  value.every(
    (trace) =>
      trace &&
      typeof trace === "object" &&
      Array.isArray((trace as SnapshotTrace).tracePath),
  )

const firstTraceArray = (candidates: unknown[]): SnapshotTrace[] | undefined =>
  candidates.find(isTraceArray)

const firstArray = <T>(candidates: unknown[]): T[] | undefined =>
  candidates.find(Array.isArray) as T[] | undefined

const getSnapshotData = (solver: BaseSolver) => {
  const candidate = solver as SolverLike
  const output = safelyGetOutput(candidate)

  let traces = firstTraceArray([
    output?.traces,
    output?.allTraces,
    output?.allTracesMerged,
    candidate.outputTraces,
    candidate.traces,
    candidate.solvedTracePaths,
    candidate.allTraces,
    candidate.input?.traces,
    candidate.input?.allTraces,
  ])

  if (!traces && candidate.solvedTracePath) {
    traces = [
      {
        ...(candidate.initialTrace ?? candidate.connectionPair),
        tracePath: candidate.solvedTracePath,
        pinIds:
          candidate.connectionPair?.pinIds ??
          candidate.pins?.map((p) => p.pinId),
      },
    ]
  } else if (!traces && candidate.initialTrace) {
    traces = [candidate.initialTrace]
  }

  const netLabelPlacements =
    firstArray<NetLabelPlacement>([
      output?.netLabelPlacements,
      candidate.outputNetLabelPlacements,
      candidate.netLabelPlacements,
      candidate.inputNetLabelPlacements,
      candidate.initialNetLabelPlacements,
      candidate.input?.allLabelPlacements,
      candidate.input?.netLabelPlacements,
    ]) ?? (candidate.label ? [candidate.label] : [])

  const inlineNetLabelPlacements =
    firstArray<InlineNetLabelPlacement>([
      output?.inlineNetLabelPlacements,
      candidate.inlineNetLabelPlacements,
    ]) ?? []

  const tracesWithInlineStubs = [...(traces ?? [])]
  for (const [inlineIndex, placement] of inlineNetLabelPlacements.entries()) {
    if (!placement.stubTracePath) continue
    tracesWithInlineStubs.push({
      tracePath: placement.stubTracePath,
      mspPairId: `inline-stub-${inlineIndex}`,
      globalConnNetId: placement.globalConnNetId,
      userNetId: placement.netId,
      pinIds: placement.pinIds,
    })
  }

  return {
    traces: tracesWithInlineStubs,
    netLabelPlacements,
    inlineNetLabelPlacements,
  }
}

const getRefdes = (chip: InputChip) => {
  const pinPrefixes = new Set(
    chip.pins
      .map((pin) => pin.pinId.split(".")[0])
      .filter((prefix): prefix is string => Boolean(prefix)),
  )
  if (pinPrefixes.size === 1) return [...pinPrefixes][0]!
  return chip.chipId
}

const getPinLabel = (pinId: string) =>
  pinId.includes(".") ? pinId.slice(pinId.indexOf(".") + 1) : pinId

const getPinNumber = (pinId: string) => {
  const label = getPinLabel(pinId)
  return /^\d+$/.test(label) ? Number(label) : undefined
}

const getFacingDirection = (pin: InputPin, chip: InputChip): FacingDirection =>
  pin._facingDirection ?? getPinDirection(pin, chip)

const facingDirectionToSide = (
  facingDirection: FacingDirection,
): NonNullable<SchematicPort["side_of_component"]> => {
  switch (facingDirection) {
    case "x+":
      return "right"
    case "x-":
      return "left"
    case "y+":
      return "top"
    case "y-":
      return "bottom"
  }
}

const facingDirectionToCircuitJson = (
  facingDirection: FacingDirection,
): NonNullable<SchematicPort["facing_direction"]> => {
  switch (facingDirection) {
    case "x+":
      return "right"
    case "x-":
      return "left"
    case "y+":
      return "up"
    case "y-":
      return "down"
  }
}

const getPassiveSymbolName = (chip: InputChip, refdes: string) => {
  if (chip.pins.length !== 2) return undefined
  const prefix = refdes.match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
  const baseSymbol =
    prefix === "R"
      ? "resistor"
      : prefix === "C"
        ? "capacitor"
        : prefix === "L"
          ? "inductor"
          : undefined
  if (!baseSymbol) return undefined

  const [firstPin, secondPin] = chip.pins
  const isHorizontal =
    Math.abs(firstPin!.x - secondPin!.x) >= Math.abs(firstPin!.y - secondPin!.y)
  return `${baseSymbol}_${isHorizontal ? "right" : "up"}`
}

const pointKey = (point: Point) => `${point.x.toFixed(9)},${point.y.toFixed(9)}`

const traceKey = (trace: SnapshotTrace) =>
  trace.mspPairId ?? trace.tracePath.map(pointKey).join(";")

const dedupeTraces = (traces: SnapshotTrace[]) => {
  const uniqueTraces = new Map<string, SnapshotTrace>()
  for (const trace of traces) {
    if (trace.tracePath.length < 2) continue
    uniqueTraces.set(traceKey(trace), trace)
  }
  return [...uniqueTraces.values()]
}

const getTraceNetName = (trace: SnapshotTrace) =>
  trace.userNetId ?? trace.netId ?? trace.globalConnNetId

const getTracePinIds = (trace: SnapshotTrace) =>
  trace.pinIds ?? trace.pins?.map((pin) => pin.pinId) ?? []

const getJunctionsByTraceIndex = (traces: SnapshotTrace[]) => {
  const traceIndexesByNetPoint = new Map<
    string,
    { point: Point; traceIndexes: Set<number> }
  >()

  for (const [traceIndex, trace] of traces.entries()) {
    const netKey = trace.globalConnNetId ?? getTraceNetName(trace) ?? "unknown"
    for (const key of new Set(trace.tracePath.map(pointKey))) {
      const netPointKey = `${netKey}:${key}`
      const entry = traceIndexesByNetPoint.get(netPointKey) ?? {
        point: trace.tracePath.find((point) => pointKey(point) === key)!,
        traceIndexes: new Set<number>(),
      }
      entry.traceIndexes.add(traceIndex)
      traceIndexesByNetPoint.set(netPointKey, entry)
    }
  }

  const junctionsByTraceIndex = new Map<number, Point[]>()
  for (const {
    point: sharedPoint,
    traceIndexes,
  } of traceIndexesByNetPoint.values()) {
    if (traceIndexes.size < 2) continue
    const traceIndex = Math.min(...traceIndexes)
    const junctions = junctionsByTraceIndex.get(traceIndex) ?? []
    if (!junctions.some((point) => pointKey(point) === pointKey(sharedPoint))) {
      junctions.push(sharedPoint)
    }
    junctionsByTraceIndex.set(traceIndex, junctions)
  }

  return junctionsByTraceIndex
}

const orientationToAnchorSide = (
  orientation: FacingDirection,
): SchematicNetLabel["anchor_side"] => {
  switch (orientation) {
    case "x+":
      return "left"
    case "x-":
      return "right"
    case "y+":
      return "bottom"
    case "y-":
      return "top"
  }
}

/**
 * Builds a semantic, renderable Circuit JSON schematic from a solver snapshot.
 * Only solved/output traces are emitted, so input connection lines (the rats
 * nest) are intentionally absent.
 */
export const convertSolverOutputToCircuitJson = (
  solver: BaseSolver,
): AnyCircuitElement[] => {
  const inputProblem = getInputProblemFromSolver(solver)
  if (!inputProblem) {
    throw new Error(
      `Unable to find an InputProblem on ${solver.constructor.name}`,
    )
  }

  const snapshotData = getSnapshotData(solver)
  const traces = dedupeTraces(snapshotData.traces)
  const circuitJson: AnyCircuitElement[] = []
  const sourcePortIdByPinId = new Map<string, string>()
  const schematicPortIdByPinId = new Map<string, string>()
  const sourcePortIdsByPoint = new Map<string, string[]>()
  const schematicPortIdsByPoint = new Map<string, string[]>()

  for (const [chipIndex, chip] of inputProblem.chips.entries()) {
    const sourceComponentId = `source_component_${chipIndex}`
    const schematicComponentId = `schematic_component_${chipIndex}`
    const refdes = getRefdes(chip)
    const symbolName = getPassiveSymbolName(chip, refdes)

    circuitJson.push({
      type: "source_component",
      ftype: "simple_chip",
      source_component_id: sourceComponentId,
      name: refdes,
    } satisfies SourceSimpleChip)

    circuitJson.push({
      type: "schematic_component",
      schematic_component_id: schematicComponentId,
      source_component_id: sourceComponentId,
      center: chip.center,
      size: { width: chip.width, height: chip.height },
      is_box_with_pins: true,
      symbol_name: symbolName,
    } satisfies SchematicComponent)

    if (!symbolName) {
      circuitJson.push({
        type: "schematic_text",
        schematic_text_id: `schematic_component_label_${chipIndex}`,
        schematic_component_id: schematicComponentId,
        text: refdes,
        font_size: Math.max(0.1, Math.min(0.18, chip.height / 3)),
        position: chip.center,
        rotation: 0,
        anchor: "center",
        color: "#0f172a",
      } satisfies SchematicText)
    }

    for (const [pinIndex, pin] of chip.pins.entries()) {
      const sourcePortId = `source_port_${chipIndex}_${pinIndex}`
      const schematicPortId = `schematic_port_${chipIndex}_${pinIndex}`
      const facingDirection = getFacingDirection(pin, chip)
      const sideOfComponent = facingDirectionToSide(facingDirection)
      const pinLabel = getPinLabel(pin.pinId)
      const pinNumber = getPinNumber(pin.pinId)
      const componentDimension =
        sideOfComponent === "left" || sideOfComponent === "right"
          ? chip.width
          : chip.height

      circuitJson.push({
        type: "source_port",
        source_port_id: sourcePortId,
        source_component_id: sourceComponentId,
        name: pinLabel,
        pin_number: pinNumber,
      } satisfies SourcePort)

      circuitJson.push({
        type: "schematic_port",
        schematic_port_id: schematicPortId,
        source_port_id: sourcePortId,
        schematic_component_id: schematicComponentId,
        center: { x: pin.x, y: pin.y },
        facing_direction: facingDirectionToCircuitJson(facingDirection),
        side_of_component: sideOfComponent,
        distance_from_component_edge: Math.min(0.2, componentDimension / 3),
        display_pin_label: pinNumber === undefined ? pinLabel : undefined,
        pin_number: pinNumber,
      } satisfies SchematicPort)

      sourcePortIdByPinId.set(pin.pinId, sourcePortId)
      schematicPortIdByPinId.set(pin.pinId, schematicPortId)
      const key = pointKey(pin)
      sourcePortIdsByPoint.set(key, [
        ...(sourcePortIdsByPoint.get(key) ?? []),
        sourcePortId,
      ])
      schematicPortIdsByPoint.set(key, [
        ...(schematicPortIdsByPoint.get(key) ?? []),
        schematicPortId,
      ])
    }
  }

  for (const [textBoxIndex, textBox] of (
    inputProblem.textBoxes ?? []
  ).entries()) {
    circuitJson.push({
      type: "schematic_box",
      schematic_component_id: textBox.chipId,
      x: textBox.center.x - textBox.width / 2,
      y: textBox.center.y - textBox.height / 2,
      width: textBox.width,
      height: textBox.height,
      is_dashed: true,
    } satisfies SchematicBox)

    if (textBox.text) {
      circuitJson.push({
        type: "schematic_text",
        schematic_text_id: `schematic_text_box_${textBoxIndex}`,
        text: textBox.text,
        font_size: Math.max(0.08, Math.min(0.18, textBox.height)),
        position: textBox.center,
        rotation: 0,
        anchor: "center",
        color: "#7e22ce",
      } satisfies SchematicText)
    }
  }

  const netNames = new Set<string>()
  for (const connection of [
    ...inputProblem.directConnections,
    ...inputProblem.netConnections,
  ]) {
    if (connection.netId) netNames.add(connection.netId)
  }
  for (const trace of traces) {
    const netName = getTraceNetName(trace)
    if (netName) netNames.add(netName)
  }
  for (const label of snapshotData.netLabelPlacements) {
    netNames.add(label.netId ?? label.dcConnNetId ?? label.globalConnNetId)
  }
  for (const label of snapshotData.inlineNetLabelPlacements) {
    netNames.add(label.netId ?? label.globalConnNetId)
  }

  const sourceNetIdByName = new Map<string, string>()
  for (const [netIndex, netName] of [...netNames].sort().entries()) {
    const sourceNetId = `source_net_${netIndex}`
    sourceNetIdByName.set(netName, sourceNetId)
    circuitJson.push({
      type: "source_net",
      source_net_id: sourceNetId,
      name: netName,
      member_source_group_ids: [],
      is_ground: /(^|[._-])gnd($|[._-])/i.test(netName),
      is_power: /(^|[._-])(vcc|vdd|vss|gnd)($|[._-])/i.test(netName),
    } satisfies SourceNet)
  }

  const junctionsByTraceIndex = getJunctionsByTraceIndex(traces)
  for (const [traceIndex, trace] of traces.entries()) {
    const sourceTraceId = `source_trace_${traceIndex}`
    const schematicTraceId = `schematic_trace_${traceIndex}`
    const tracePinIds = getTracePinIds(trace)
    const startKey = pointKey(trace.tracePath[0]!)
    const endKey = pointKey(trace.tracePath.at(-1)!)
    const sourcePortIds = [
      ...tracePinIds
        .map((pinId) => sourcePortIdByPinId.get(pinId))
        .filter((id): id is string => Boolean(id)),
    ]
    if (sourcePortIds.length === 0) {
      sourcePortIds.push(
        ...(sourcePortIdsByPoint.get(startKey)?.slice(0, 1) ?? []),
        ...(sourcePortIdsByPoint.get(endKey)?.slice(0, 1) ?? []),
      )
    }
    const netName = getTraceNetName(trace)

    circuitJson.push({
      type: "source_trace",
      source_trace_id: sourceTraceId,
      connected_source_port_ids: [...new Set(sourcePortIds)],
      connected_source_net_ids: netName
        ? [sourceNetIdByName.get(netName)!]
        : [],
      name: netName,
    } satisfies SourceTrace)

    circuitJson.push({
      type: "schematic_trace",
      schematic_trace_id: schematicTraceId,
      source_trace_id: sourceTraceId,
      junctions: junctionsByTraceIndex.get(traceIndex) ?? [],
      edges: trace.tracePath.slice(0, -1).map((point, pointIndex) => {
        const nextPoint = trace.tracePath[pointIndex + 1]!
        const fromSchematicPortId =
          pointIndex === 0
            ? (tracePinIds
                .map((pinId) => schematicPortIdByPinId.get(pinId))
                .find(
                  (portId) =>
                    portId &&
                    schematicPortIdsByPoint
                      .get(pointKey(point))
                      ?.includes(portId),
                ) ?? schematicPortIdsByPoint.get(pointKey(point))?.[0])
            : undefined
        const toSchematicPortId =
          pointIndex === trace.tracePath.length - 2
            ? (tracePinIds
                .map((pinId) => schematicPortIdByPinId.get(pinId))
                .find(
                  (portId) =>
                    portId &&
                    schematicPortIdsByPoint
                      .get(pointKey(nextPoint))
                      ?.includes(portId),
                ) ?? schematicPortIdsByPoint.get(pointKey(nextPoint))?.[0])
            : undefined

        return {
          from: point,
          to: nextPoint,
          from_schematic_port_id: fromSchematicPortId,
          to_schematic_port_id: toSchematicPortId,
        }
      }),
    } satisfies SchematicTrace)
  }

  for (const [labelIndex, label] of snapshotData.netLabelPlacements.entries()) {
    const netName = label.netId ?? label.dcConnNetId ?? label.globalConnNetId
    circuitJson.push({
      type: "schematic_net_label",
      schematic_net_label_id: `schematic_net_label_${labelIndex}`,
      source_net_id: sourceNetIdByName.get(netName)!,
      center: label.center,
      anchor_position: label.anchorPoint,
      anchor_side: orientationToAnchorSide(label.orientation),
      text: netName,
    } satisfies SchematicNetLabel)
  }

  for (const [
    labelIndex,
    label,
  ] of snapshotData.inlineNetLabelPlacements.entries()) {
    circuitJson.push({
      type: "schematic_text",
      schematic_text_id: `schematic_inline_net_label_${labelIndex}`,
      text: label.netId ?? label.globalConnNetId,
      font_size: label.height,
      position: label.center,
      // Match core's schematic convention: vertical labels read bottom-to-top.
      rotation: label.axis === "y" ? -90 : 0,
      anchor: "center",
      color: "#047857",
    } satisfies SchematicText)
  }

  return circuitJson
}
