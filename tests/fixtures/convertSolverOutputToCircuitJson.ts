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
import { type SchSymbol, symbols } from "schematic-symbols"

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

const isOpaqueSchematicId = (id: string) =>
  /^(?:schematic|source)_(?:component|port)(?:_|$)/.test(id)

const getRefdes = (chip: InputChip) => {
  const pinPrefixes = chip.pins
    .map((pin) => {
      const separatorIndex = pin.pinId.indexOf(".")
      return separatorIndex > 0 ? pin.pinId.slice(0, separatorIndex) : undefined
    })
    .filter((prefix): prefix is string => Boolean(prefix))
  const uniquePinPrefixes = new Set(pinPrefixes)
  if (pinPrefixes.length === chip.pins.length && uniquePinPrefixes.size === 1) {
    const inferredRefdes = pinPrefixes[0]!
    if (!isOpaqueSchematicId(inferredRefdes)) return inferredRefdes
  }
  if (!isOpaqueSchematicId(chip.chipId)) return chip.chipId
  return ""
}

const getPinLabel = (pinId: string) => {
  if (isOpaqueSchematicId(pinId)) return undefined
  return pinId.includes(".") ? pinId.slice(pinId.indexOf(".") + 1) : pinId
}

const getPinDisplayName = (pin: InputPin) => {
  if (pin.displayName !== undefined) return pin.displayName || undefined
  return getPinLabel(pin.pinId)
}

const getPinNumber = (pin: InputPin) => {
  const idLabel = getPinLabel(pin.pinId)
  if (idLabel && /^\d+$/.test(idLabel)) return Number(idLabel)
  return pin.displayName && /^\d+$/.test(pin.displayName)
    ? Number(pin.displayName)
    : undefined
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

const getDefaultSymbolBaseName = (refdes: string) => {
  const prefix = refdes.match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
  if (!prefix) return undefined

  // Match the defaults used by tscircuit/core's normal components. The more
  // specific LED prefix must be checked before the generic inductor prefix.
  if (prefix === "LED") return "led"
  if (prefix.startsWith("R")) return "boxresistor"
  if (["C", "CIN", "COUT", "CCOMP"].includes(prefix)) return "capacitor"
  if (prefix === "L") return "inductor"
  if (prefix.startsWith("D")) return "diode"
  if (prefix === "F") return "fuse"
  if (["B", "BT", "BAT"].includes(prefix)) return "battery"
  if (prefix === "X" || prefix === "Y") return "crystal"
  if (prefix === "SW") return "spst_switch"
  if (prefix === "I") return "current_source"
  if (prefix === "V" || prefix === "VS") return "ac_voltmeter"

  return undefined
}

const getPinsInNumberOrder = (chip: InputChip) =>
  [...chip.pins].sort((pinA, pinB) => {
    const pinNumberA = getPinNumber(pinA)
    const pinNumberB = getPinNumber(pinB)
    if (pinNumberA === undefined || pinNumberB === undefined) return 0
    return pinNumberA - pinNumberB
  })

const getDefaultSymbolName = (chip: InputChip, refdes: string) => {
  if (chip.pins.length !== 2) return undefined
  if (chip.symbolName && chip.symbolName in symbols) return chip.symbolName
  const baseSymbolName = getDefaultSymbolBaseName(refdes)
  if (!baseSymbolName) return undefined

  const [firstPin, secondPin] = getPinsInNumberOrder(chip)
  const deltaX = secondPin!.x - firstPin!.x
  const deltaY = secondPin!.y - firstPin!.y
  const isHorizontal = Math.abs(deltaX) >= Math.abs(deltaY)

  const suffix =
    baseSymbolName === "fuse"
      ? isHorizontal
        ? "horz"
        : "vert"
      : isHorizontal
        ? deltaX >= 0
          ? "right"
          : "left"
        : deltaY >= 0
          ? "up"
          : "down"
  const symbolName = `${baseSymbolName}_${suffix}`

  return symbolName in symbols ? symbolName : undefined
}

const getAngularDifference = (angle1: number, angle2: number) => {
  const normalizedAngle1 = angle1 < 0 ? angle1 + 2 * Math.PI : angle1
  const normalizedAngle2 = angle2 < 0 ? angle2 + 2 * Math.PI : angle2
  const difference = Math.abs(normalizedAngle1 - normalizedAngle2)
  return difference > Math.PI ? 2 * Math.PI - difference : difference
}

/**
 * circuit-to-svg@0.0.407 derives a symbol transform from two schematic ports.
 * Its scale is correct, but its translation is calculated in unscaled symbol
 * coordinates. Offsetting the component and both ports here makes the rendered
 * symbol terminals land on the original solver pin coordinates.
 */
const getCircuitToSvgSymbolOffset = ({
  chip,
  componentCenter,
  symbol,
  scale,
}: {
  chip: InputChip
  componentCenter: Point
  symbol: SchSymbol
  scale: number
}): Point => {
  const pinsByAngle = chip.pins
    .map((pin) => ({
      pin,
      angle: Math.atan2(pin.y - componentCenter.y, pin.x - componentCenter.x),
    }))
    .sort((a, b) => a.angle - b.angle)
  const symbolPortsByAngle = symbol.ports
    .map((port) => ({
      port,
      angle: Math.atan2(port.y - symbol.center.y, port.x - symbol.center.x),
    }))
    .sort((a, b) => a.angle - b.angle)

  const matches: Array<{
    pin: InputPin
    symbolPort: SchSymbol["ports"][number]
  }> = []
  const usedSymbolPorts = new Set<SchSymbol["ports"][number]>()
  for (const pinWithAngle of pinsByAngle) {
    const match = symbolPortsByAngle
      .filter(({ port }) => !usedSymbolPorts.has(port))
      .map(({ port, angle }) => ({
        port,
        difference: getAngularDifference(pinWithAngle.angle, angle),
      }))
      .sort((a, b) => a.difference - b.difference)[0]
    if (!match || match.difference >= Math.PI / 4) continue
    matches.push({ pin: pinWithAngle.pin, symbolPort: match.port })
    usedSymbolPorts.add(match.port)
  }

  if (matches.length !== 2) return { x: 0, y: 0 }

  // Match circuit-to-svg's point-pair order: the second match is the
  // translation anchor and the first match determines the scale.
  const anchorMatch = matches[1]!
  const otherMatch = matches[0]!
  const symbolPortDistance = Math.hypot(
    otherMatch.symbolPort.x - anchorMatch.symbolPort.x,
    otherMatch.symbolPort.y - anchorMatch.symbolPort.y,
  )
  if (symbolPortDistance === 0) return { x: 0, y: 0 }

  return {
    x: (1 - scale) * anchorMatch.symbolPort.x,
    y: (1 - scale) * anchorMatch.symbolPort.y,
  }
}

type SnapshotSymbolGeometry = {
  symbolName: string
  center: Point
  size: { width: number; height: number }
  circuitToSvgOffset: Point
}

const GENERIC_BOX_STEM_LENGTH = 0.4
const CHIP_EDGE_TOLERANCE = 1e-6

/**
 * Legacy solver inputs describe generic box obstacles from stem tip to stem
 * tip. Circuit JSON's schematic_component size describes only the box body,
 * while each schematic_port's distance_from_component_edge draws its stem.
 * Newer inputs already place pin tips outside the box, so only contract an
 * axis when a pin tip lies on that obstacle's edge.
 */
const getGenericBoxSize = (chip: InputChip) => {
  const halfWidth = chip.width / 2
  const halfHeight = chip.height / 2
  const hasHorizontalPinOnEdge = chip.pins.some((pin) => {
    const direction = getFacingDirection(pin, chip)
    return (
      (direction === "x+" || direction === "x-") &&
      Math.abs(Math.abs(pin.x - chip.center.x) - halfWidth) <=
        CHIP_EDGE_TOLERANCE
    )
  })
  const hasVerticalPinOnEdge = chip.pins.some((pin) => {
    const direction = getFacingDirection(pin, chip)
    return (
      (direction === "y+" || direction === "y-") &&
      Math.abs(Math.abs(pin.y - chip.center.y) - halfHeight) <=
        CHIP_EDGE_TOLERANCE
    )
  })

  return {
    width: hasHorizontalPinOnEdge
      ? Math.max(0.1, chip.width - 2 * GENERIC_BOX_STEM_LENGTH)
      : chip.width,
    height: hasVerticalPinOnEdge
      ? Math.max(0.1, chip.height - 2 * GENERIC_BOX_STEM_LENGTH)
      : chip.height,
  }
}

const getGenericBoxPortStemLength = ({
  pin,
  chip,
  componentSize,
  sideOfComponent,
}: {
  pin: InputPin
  chip: InputChip
  componentSize: { width: number; height: number }
  sideOfComponent: "left" | "right" | "top" | "bottom"
}) => {
  const distanceFromBody =
    sideOfComponent === "left" || sideOfComponent === "right"
      ? Math.abs(pin.x - chip.center.x) - componentSize.width / 2
      : Math.abs(pin.y - chip.center.y) - componentSize.height / 2

  return Math.max(0, Math.min(GENERIC_BOX_STEM_LENGTH, distanceFromBody))
}

/**
 * Core passes the solver a text-inclusive chip obstacle. Its center and size
 * can therefore include {REF}, {VAL}, or explicit MPN text and must not be used
 * as the drawable symbol bounds. Reconstruct the original component geometry
 * from the two schematic pin positions and the selected symbol instead.
 */
const getSnapshotSymbolGeometry = (
  chip: InputChip,
  refdes: string,
): SnapshotSymbolGeometry | undefined => {
  const symbolName = getDefaultSymbolName(chip, refdes)
  if (!symbolName) return undefined
  const symbol = symbols[symbolName as keyof typeof symbols] as
    | SchSymbol
    | undefined
  if (!symbol || chip.pins.length !== 2 || symbol.ports.length !== 2) {
    return undefined
  }

  const unusedSymbolPorts = new Set(symbol.ports)
  const matches = chip.pins.map((pin) => {
    const pinDisplayName = getPinDisplayName(pin)
    const symbolPort = pinDisplayName
      ? [...unusedSymbolPorts].find((port) =>
          port.labels.includes(pinDisplayName),
        )
      : undefined
    if (symbolPort) unusedSymbolPorts.delete(symbolPort)
    return symbolPort ? { pin, symbolPort } : undefined
  })

  const matchedByLabel = matches.every(
    (match): match is NonNullable<typeof match> => Boolean(match),
  )
  const pinPortMatches = matchedByLabel
    ? matches
    : getPinsInNumberOrder(chip).map((pin, index) => ({
        pin,
        symbolPort: symbol.ports[index]!,
      }))

  const [firstMatch, secondMatch] = pinPortMatches
  const symbolPortDistance = Math.hypot(
    secondMatch!.symbolPort.x - firstMatch!.symbolPort.x,
    secondMatch!.symbolPort.y - firstMatch!.symbolPort.y,
  )
  const schematicPortDistance = Math.hypot(
    secondMatch!.pin.x - firstMatch!.pin.x,
    secondMatch!.pin.y - firstMatch!.pin.y,
  )
  if (symbolPortDistance === 0 || schematicPortDistance === 0) return undefined

  const scale = schematicPortDistance / symbolPortDistance
  const centers = pinPortMatches.map(({ pin, symbolPort }) => ({
    x: pin.x - (symbolPort.x - symbol.center.x) * scale,
    y: pin.y - (symbolPort.y - symbol.center.y) * scale,
  }))
  const center = {
    x: (centers[0]!.x + centers[1]!.x) / 2,
    y: (centers[0]!.y + centers[1]!.y) / 2,
  }

  return {
    symbolName,
    center,
    size: {
      width: symbol.size.width * scale,
      height: symbol.size.height * scale,
    },
    circuitToSvgOffset: getCircuitToSvgSymbolOffset({
      chip,
      componentCenter: center,
      symbol,
      scale,
    }),
  }
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

const getTracePinIds = (trace: SnapshotTrace) =>
  trace.pinIds ?? trace.pins?.map((pin) => pin.pinId) ?? []

const nonEmptyNetName = (name: string | undefined) => {
  const trimmedName = name?.trim()
  return trimmedName ? trimmedName : undefined
}

/**
 * circuit-to-svg sizes conventional net labels from their text. Approximate a
 * missing label with X characters so the rendered outline stays close to the
 * width that @tscircuit/core measured and supplied to the solver.
 */
const getAnchoredNetLabelPlaceholder = (label: NetLabelPlacement) => {
  const labelWidth =
    label.orientation === "x+" || label.orientation === "x-"
      ? label.width
      : label.height
  const fontSize = 0.18
  const fixedWidthInFontSizes = 0.9
  const xWidthInFontSizes = 16 / 27 + 0.06
  const xCount = Math.max(
    1,
    Math.round(
      (labelWidth / fontSize - fixedWidthInFontSizes) / xWidthInFontSizes,
    ),
  )
  return "X".repeat(xCount)
}

const getInlineNetLabelPlaceholder = (label: InlineNetLabelPlacement) => {
  const fontScale = label.height / 0.18
  const characterWidth = 0.12 * fontScale
  const xCount = Math.max(1, Math.round(label.width / characterWidth - 1))
  return "X".repeat(xCount)
}

const getNetNameResolvers = (
  inputProblem: InputProblem,
  traces: SnapshotTrace[],
  netLabelPlacements: NetLabelPlacement[],
  inlineNetLabelPlacements: InlineNetLabelPlacement[],
) => {
  const netNameByPinId = new Map<string, string>()
  const netLabelTextByPinId = new Map<string, string>()
  for (const connection of inputProblem.directConnections) {
    for (const pinId of connection.pinIds) {
      if (connection.netId) netNameByPinId.set(pinId, connection.netId)
      const netLabelText = nonEmptyNetName(connection.netLabelText)
      if (netLabelText) netLabelTextByPinId.set(pinId, netLabelText)
    }
  }
  for (const connection of inputProblem.netConnections) {
    for (const pinId of connection.pinIds) {
      netNameByPinId.set(pinId, connection.netId)
      const netLabelText = nonEmptyNetName(connection.netLabelText)
      if (netLabelText) netLabelTextByPinId.set(pinId, netLabelText)
    }
  }

  const inferUniqueFromPinIds = (
    pinIds: readonly string[],
    valuesByPinId: Map<string, string>,
  ) => {
    const names = [
      ...new Set(
        pinIds
          .map((pinId) => valuesByPinId.get(pinId))
          .filter((name): name is string => Boolean(name)),
      ),
    ]
    return names.length === 1 ? names[0] : undefined
  }
  const inferNetNameFromPinIds = (pinIds: readonly string[]) =>
    inferUniqueFromPinIds(pinIds, netNameByPinId)
  const inferNetLabelTextFromPinIds = (pinIds: readonly string[]) =>
    inferUniqueFromPinIds(pinIds, netLabelTextByPinId)

  const userNetNameByGlobalConnNetId = new Map<string, string>()
  const userNetNameByMspPairId = new Map<string, string>()
  const netLabelTextByGlobalConnNetId = new Map<string, string>()
  const netLabelTextByMspPairId = new Map<string, string>()
  for (const trace of traces) {
    const userNetName =
      nonEmptyNetName(trace.userNetId) ??
      inferNetNameFromPinIds(getTracePinIds(trace)) ??
      nonEmptyNetName(trace.netId)
    if (!userNetName) continue
    if (trace.globalConnNetId) {
      userNetNameByGlobalConnNetId.set(trace.globalConnNetId, userNetName)
    }
    for (const mspPairId of [
      trace.mspPairId,
      ...(trace.mspConnectionPairIds ?? []),
    ]) {
      if (mspPairId) userNetNameByMspPairId.set(mspPairId, userNetName)
    }
  }

  for (const label of [...netLabelPlacements, ...inlineNetLabelPlacements]) {
    const userNetName =
      nonEmptyNetName(label.netId) ?? inferNetNameFromPinIds(label.pinIds)
    if (userNetName) {
      userNetNameByGlobalConnNetId.set(label.globalConnNetId, userNetName)
    }

    const netLabelText =
      nonEmptyNetName(label.netLabelText) ??
      inferNetLabelTextFromPinIds(label.pinIds)
    if (!netLabelText) continue
    netLabelTextByGlobalConnNetId.set(label.globalConnNetId, netLabelText)
    if ("mspConnectionPairIds" in label) {
      for (const mspPairId of label.mspConnectionPairIds) {
        netLabelTextByMspPairId.set(mspPairId, netLabelText)
      }
    } else if (label.mspPairId) {
      netLabelTextByMspPairId.set(label.mspPairId, netLabelText)
    }
  }

  const getTraceNetName = (trace: SnapshotTrace) =>
    nonEmptyNetName(trace.userNetId) ??
    inferNetNameFromPinIds(getTracePinIds(trace)) ??
    (trace.globalConnNetId
      ? userNetNameByGlobalConnNetId.get(trace.globalConnNetId)
      : undefined) ??
    nonEmptyNetName(trace.netId) ??
    nonEmptyNetName(trace.globalConnNetId)

  const getNetLabelNetName = (label: NetLabelPlacement) =>
    nonEmptyNetName(label.netId) ??
    inferNetNameFromPinIds(label.pinIds) ??
    label.mspConnectionPairIds
      .map((mspPairId) => userNetNameByMspPairId.get(mspPairId))
      .find((name): name is string => Boolean(name)) ??
    userNetNameByGlobalConnNetId.get(label.globalConnNetId) ??
    nonEmptyNetName(label.dcConnNetId) ??
    nonEmptyNetName(label.globalConnNetId) ??
    "unnamed net"

  const getInlineNetLabelNetName = (label: InlineNetLabelPlacement) =>
    nonEmptyNetName(label.netId) ??
    inferNetNameFromPinIds(label.pinIds) ??
    (label.mspPairId
      ? userNetNameByMspPairId.get(label.mspPairId)
      : undefined) ??
    userNetNameByGlobalConnNetId.get(label.globalConnNetId) ??
    nonEmptyNetName(label.globalConnNetId) ??
    "unnamed net"

  const getNetLabelText = (label: NetLabelPlacement) =>
    nonEmptyNetName(label.netLabelText) ??
    inferNetLabelTextFromPinIds(label.pinIds) ??
    label.mspConnectionPairIds
      .map((mspPairId) => netLabelTextByMspPairId.get(mspPairId))
      .find((text): text is string => Boolean(text)) ??
    netLabelTextByGlobalConnNetId.get(label.globalConnNetId) ??
    getAnchoredNetLabelPlaceholder(label)

  const getInlineNetLabelText = (label: InlineNetLabelPlacement) =>
    nonEmptyNetName(label.netLabelText) ??
    inferNetLabelTextFromPinIds(label.pinIds) ??
    (label.mspPairId
      ? netLabelTextByMspPairId.get(label.mspPairId)
      : undefined) ??
    netLabelTextByGlobalConnNetId.get(label.globalConnNetId) ??
    getInlineNetLabelPlaceholder(label)

  return {
    getTraceNetName,
    getNetLabelNetName,
    getNetLabelText,
    getInlineNetLabelNetName,
    getInlineNetLabelText,
  }
}

const getJunctionsByTraceIndex = (
  traces: SnapshotTrace[],
  getTraceNetName: (trace: SnapshotTrace) => string | undefined,
) => {
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
  const {
    getTraceNetName,
    getNetLabelNetName,
    getNetLabelText,
    getInlineNetLabelNetName,
    getInlineNetLabelText,
  } = getNetNameResolvers(
    inputProblem,
    traces,
    snapshotData.netLabelPlacements,
    snapshotData.inlineNetLabelPlacements,
  )
  const circuitJson: AnyCircuitElement[] = []
  const sourcePortIdByPinId = new Map<string, string>()
  const schematicPortIdByPinId = new Map<string, string>()
  const sourcePortIdsByPoint = new Map<string, string[]>()
  const schematicPortIdsByPoint = new Map<string, string[]>()

  for (const [chipIndex, chip] of inputProblem.chips.entries()) {
    const sourceComponentId = `source_component_${chipIndex}`
    const schematicComponentId = `schematic_component_${chipIndex}`
    const refdes = getRefdes(chip)
    const symbolGeometry = getSnapshotSymbolGeometry(chip, refdes)
    const symbolName = symbolGeometry?.symbolName
    const symbolOffset = symbolGeometry?.circuitToSvgOffset ?? { x: 0, y: 0 }
    const componentCenter = symbolGeometry?.center ?? chip.center
    const componentSize = symbolGeometry?.size ?? getGenericBoxSize(chip)

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
      center: {
        x: componentCenter.x + symbolOffset.x,
        y: componentCenter.y + symbolOffset.y,
      },
      size: componentSize,
      is_box_with_pins: true,
      symbol_name: symbolName,
    } satisfies SchematicComponent)

    if (!symbolName && refdes) {
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
      const pinDisplayName = getPinDisplayName(pin)
      const pinNumber = getPinNumber(pin)
      const displayPinLabel =
        pin.displayName !== undefined
          ? pin.displayName && !/^\d+$/.test(pin.displayName)
            ? pin.displayName
            : undefined
          : pinNumber === undefined
            ? pinDisplayName
            : undefined
      const distanceFromComponentEdge = symbolName
        ? Math.min(
            0.2,
            (sideOfComponent === "left" || sideOfComponent === "right"
              ? componentSize.width
              : componentSize.height) / 3,
          )
        : getGenericBoxPortStemLength({
            pin,
            chip,
            componentSize,
            sideOfComponent,
          })

      circuitJson.push({
        type: "source_port",
        source_port_id: sourcePortId,
        source_component_id: sourceComponentId,
        name: pinDisplayName ?? "",
        pin_number: pinNumber,
      } satisfies SourcePort)

      circuitJson.push({
        type: "schematic_port",
        schematic_port_id: schematicPortId,
        source_port_id: sourcePortId,
        schematic_component_id: schematicComponentId,
        center: {
          x: pin.x + symbolOffset.x,
          y: pin.y + symbolOffset.y,
        },
        facing_direction: facingDirectionToCircuitJson(facingDirection),
        side_of_component: sideOfComponent,
        distance_from_component_edge: distanceFromComponentEdge,
        display_pin_label: displayPinLabel,
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
    netNames.add(getNetLabelNetName(label))
  }
  for (const label of snapshotData.inlineNetLabelPlacements) {
    netNames.add(getInlineNetLabelNetName(label))
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

  const junctionsByTraceIndex = getJunctionsByTraceIndex(
    traces,
    getTraceNetName,
  )
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
    const netName = getNetLabelNetName(label)
    circuitJson.push({
      type: "schematic_net_label",
      schematic_net_label_id: `schematic_net_label_${labelIndex}`,
      source_net_id: sourceNetIdByName.get(netName)!,
      center: label.center,
      anchor_position: label.anchorPoint,
      anchor_side: orientationToAnchorSide(label.orientation),
      text: getNetLabelText(label),
    } satisfies SchematicNetLabel)
  }

  for (const [
    labelIndex,
    label,
  ] of snapshotData.inlineNetLabelPlacements.entries()) {
    circuitJson.push({
      type: "schematic_text",
      schematic_text_id: `schematic_inline_net_label_${labelIndex}`,
      text: getInlineNetLabelText(label),
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
