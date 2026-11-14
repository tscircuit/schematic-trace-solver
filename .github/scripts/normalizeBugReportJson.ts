import type {
  InputChip,
  InputDirectConnection,
  InputNetConnection,
  InputPin,
  InputProblem,
  TextBoxes,
} from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

const VALID_DIRECTIONS = new Set<FacingDirection>(["x+", "x-", "y+", "y-"])
const MULTI_SHEET_MARGIN_MM = 24
const DEFAULT_SHEET_SIZE_MM = 100
const DEFAULT_MULTI_SHEET_MAX_MSP_DISTANCE_MM = 60

type CircuitJsonRecord = Record<string, unknown>

export function normalizeBugReportInputProblem(
  rawValue: unknown,
): InputProblem {
  if (Array.isArray(rawValue)) {
    const problem = convertCircuitJsonElementsToInputProblem(rawValue)
    assertInputProblem(problem)
    return problem
  }

  if (isRecord(rawValue)) {
    for (const wrapperKey of ["inputProblem", "solverParams", "problem"]) {
      const candidate = rawValue[wrapperKey]
      if (isRecord(candidate) && Array.isArray(candidate["chips"])) {
        assertInputProblem(candidate)
        return candidate as unknown as InputProblem
      }
    }

    for (const circuitJsonKey of ["circuitJson", "elements"]) {
      const candidate = rawValue[circuitJsonKey]
      if (Array.isArray(candidate)) {
        const problem = convertCircuitJsonElementsToInputProblem(candidate)
        assertInputProblem(problem)
        return problem
      }
    }
  }

  assertInputProblem(rawValue)
  return rawValue as InputProblem
}

function convertCircuitJsonElementsToInputProblem(
  elements: unknown[],
): InputProblem {
  const typedElements = elements.filter(
    (el): el is CircuitJsonRecord & { type: string } =>
      isRecord(el) && typeof el["type"] === "string",
  )

  if (typedElements.length === 0) {
    throw new Error(
      "input problem must be an object or a Circuit JSON element array",
    )
  }

  const schematicComponents = typedElements.filter(
    (el) =>
      el.type === "schematic_component" &&
      typeof el["schematic_component_id"] === "string" &&
      isPoint(el["center"]) &&
      isSize(el["size"]),
  )

  if (schematicComponents.length === 0) {
    throw new Error(
      "Circuit JSON attachment does not contain any schematic_component elements with valid center and size",
    )
  }

  const componentById = new Map<string, CircuitJsonRecord>()
  for (const component of schematicComponents) {
    componentById.set(String(component["schematic_component_id"]), component)
  }

  const schematicPorts = typedElements.filter(
    (el) =>
      el.type === "schematic_port" &&
      typeof el["schematic_port_id"] === "string" &&
      typeof el["schematic_component_id"] === "string" &&
      componentById.has(String(el["schematic_component_id"])) &&
      isPoint(el["center"]),
  )

  const getSheetIdForComponent = (componentId: string): string => {
    const comp = componentById.get(componentId)
    return typeof comp?.["schematic_sheet_id"] === "string"
      ? comp["schematic_sheet_id"]
      : "default"
  }

  const sheetOffsets = computeSheetOffsets(
    typedElements,
    schematicComponents,
    schematicPorts,
    getSheetIdForComponent,
  )
  const isMultiSheet = sheetOffsets.size > 1

  const getOffsetForSheet = (sheetId: string | undefined) =>
    sheetOffsets.get(sheetId ?? "default") ?? { x: 0, y: 0 }

  const sourcePortsById = new Map<string, CircuitJsonRecord>()
  for (const el of typedElements) {
    if (el.type === "source_port" && typeof el["source_port_id"] === "string") {
      sourcePortsById.set(el["source_port_id"], el)
    }
  }

  const sourceNetsById = new Map<string, CircuitJsonRecord>()
  const sourceNetsByConnKey = new Map<string, CircuitJsonRecord>()
  for (const el of typedElements) {
    if (el.type === "source_net" && typeof el["source_net_id"] === "string") {
      sourceNetsById.set(el["source_net_id"], el)
      if (typeof el["subcircuit_connectivity_map_key"] === "string") {
        sourceNetsByConnKey.set(el["subcircuit_connectivity_map_key"], el)
      }
    }
  }

  const portsByComponentId = new Map<string, CircuitJsonRecord[]>()
  const schematicPortsBySourcePortId = new Map<string, CircuitJsonRecord[]>()
  const portSheetById = new Map<string, string>()

  for (const port of schematicPorts) {
    const compId = String(port["schematic_component_id"])
    const portId = String(port["schematic_port_id"])
    const sheetId =
      typeof port["schematic_sheet_id"] === "string"
        ? port["schematic_sheet_id"]
        : getSheetIdForComponent(compId)
    portSheetById.set(portId, sheetId)

    const compList = portsByComponentId.get(compId) ?? []
    compList.push(port)
    portsByComponentId.set(compId, compList)

    if (typeof port["source_port_id"] === "string") {
      const spList =
        schematicPortsBySourcePortId.get(port["source_port_id"]) ?? []
      spList.push(port)
      schematicPortsBySourcePortId.set(port["source_port_id"], spList)
    }
  }

  const chips: InputChip[] = schematicComponents.map((comp) => {
    const chipId = String(comp["schematic_component_id"])
    const sheetId = getSheetIdForComponent(chipId)
    const offset = getOffsetForSheet(sheetId)
    const center = comp["center"] as { x: number; y: number }
    const size = comp["size"] as { width: number; height: number }
    const portLabels = isRecord(comp["port_labels"])
      ? comp["port_labels"]
      : undefined

    const pins: InputPin[] = (portsByComponentId.get(chipId) ?? []).map(
      (port) => {
        const pinId = String(port["schematic_port_id"])
        const portCenter = port["center"] as { x: number; y: number }
        const sourcePort =
          typeof port["source_port_id"] === "string"
            ? sourcePortsById.get(port["source_port_id"])
            : undefined
        const displayName = resolvePinDisplayName(port, sourcePort, portLabels)
        const facingDirection = mapFacingDirection(port["facing_direction"])

        return {
          pinId,
          ...(displayName ? { displayName } : {}),
          x: portCenter.x + offset.x,
          y: portCenter.y + offset.y,
          ...(facingDirection ? { _facingDirection: facingDirection } : {}),
        }
      },
    )

    const sectionId =
      typeof comp["schematic_sheet_id"] === "string"
        ? comp["schematic_sheet_id"]
        : typeof comp["schematic_group_id"] === "string"
          ? comp["schematic_group_id"]
          : undefined

    return {
      chipId,
      ...(typeof comp["symbol_name"] === "string"
        ? { symbolName: comp["symbol_name"] }
        : {}),
      center: {
        x: center.x + offset.x,
        y: center.y + offset.y,
      },
      width: size.width,
      height: size.height,
      pins,
      ...(sectionId ? { sectionId } : {}),
    }
  })

  const textBoxes: TextBoxes[] = typedElements
    .filter(
      (el) =>
        el.type === "schematic_text" &&
        typeof el["text"] === "string" &&
        el["text"].trim().length > 0 &&
        isPoint(el["position"]),
    )
    .map((textEl) => {
      const text = String(textEl["text"])
      const chipId =
        typeof textEl["schematic_component_id"] === "string" &&
        componentById.has(textEl["schematic_component_id"])
          ? textEl["schematic_component_id"]
          : undefined
      const sheetId =
        typeof textEl["schematic_sheet_id"] === "string"
          ? textEl["schematic_sheet_id"]
          : chipId
            ? getSheetIdForComponent(chipId)
            : "default"
      const offset = getOffsetForSheet(sheetId)
      const position = textEl["position"] as { x: number; y: number }
      const fontSize =
        typeof textEl["font_size"] === "number" &&
        Number.isFinite(textEl["font_size"]) &&
        textEl["font_size"] > 0
          ? textEl["font_size"]
          : 0.18
      const rawWidth = Math.max(fontSize, text.length * fontSize * 0.65)
      const rawHeight = fontSize
      const rotationDeg =
        typeof textEl["rotation"] === "number" &&
        Number.isFinite(textEl["rotation"])
          ? textEl["rotation"]
          : 0
      const rad = (rotationDeg * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const width = Math.abs(rawWidth * cos) + Math.abs(rawHeight * sin)
      const height = Math.abs(rawWidth * sin) + Math.abs(rawHeight * cos)
      const anchor =
        typeof textEl["anchor"] === "string" ? textEl["anchor"] : "center"

      let localDx = 0
      let localDy = 0
      if (anchor.includes("left")) localDx = rawWidth / 2
      else if (anchor.includes("right")) localDx = -rawWidth / 2
      if (anchor.includes("top")) localDy = -rawHeight / 2
      else if (anchor.includes("bottom")) localDy = rawHeight / 2

      const centerX = position.x + offset.x + localDx * cos - localDy * sin
      const centerY = position.y + offset.y + localDx * sin + localDy * cos

      return {
        ...(chipId ? { chipId } : {}),
        center: { x: centerX, y: centerY },
        width,
        height,
        text,
      }
    })

  const netGroups = new Map<
    string,
    {
      sourceNetId: string
      labelText: string
      isGround: boolean
      isPower: boolean
      sheetId: string
      pinIds: Set<string>
    }
  >()
  const directConnections: InputDirectConnection[] = []
  const seenDirectPairs = new Set<string>()

  const addPortToNetGroup = (
    sourceNetId: string,
    labelText: string,
    isGround: boolean,
    isPower: boolean,
    portId: string,
  ) => {
    const sheetId = portSheetById.get(portId) ?? "default"
    const groupKey = isMultiSheet ? `${sheetId}::${sourceNetId}` : sourceNetId
    let group = netGroups.get(groupKey)
    if (!group) {
      group = {
        sourceNetId,
        labelText,
        isGround,
        isPower,
        sheetId,
        pinIds: new Set<string>(),
      }
      netGroups.set(groupKey, group)
    }
    group.pinIds.add(portId)
  }

  for (const el of typedElements) {
    if (el.type !== "source_trace") continue
    const sourcePortIds = Array.isArray(el["connected_source_port_ids"])
      ? el["connected_source_port_ids"].filter(
          (id): id is string => typeof id === "string",
        )
      : []
    const resolvedPorts = sourcePortIds.flatMap(
      (spId) => schematicPortsBySourcePortId.get(spId) ?? [],
    )
    const connectedSourceNetIds = Array.isArray(el["connected_source_net_ids"])
      ? el["connected_source_net_ids"].filter(
          (id): id is string => typeof id === "string",
        )
      : []
    const inferredNetIds = new Set<string>(connectedSourceNetIds)
    if (inferredNetIds.size === 0) {
      const traceConnKey = el["subcircuit_connectivity_map_key"]
      if (typeof traceConnKey === "string" && traceConnKey) {
        const sn = sourceNetsByConnKey.get(traceConnKey)
        if (typeof sn?.["source_net_id"] === "string") {
          inferredNetIds.add(sn["source_net_id"])
        }
      }
      for (const spId of sourcePortIds) {
        const sp = sourcePortsById.get(spId)
        const connKey = sp?.["subcircuit_connectivity_map_key"]
        if (typeof connKey === "string" && connKey) {
          const sn = sourceNetsByConnKey.get(connKey)
          if (typeof sn?.["source_net_id"] === "string") {
            inferredNetIds.add(sn["source_net_id"])
          }
        }
      }
    }

    if (inferredNetIds.size > 0) {
      for (const snId of inferredNetIds) {
        const sn = sourceNetsById.get(snId)
        const labelText =
          typeof sn?.["name"] === "string" && sn["name"].trim().length > 0
            ? sn["name"]
            : snId
        const isGround =
          Boolean(sn?.["is_ground"]) || isGroundLabelName(labelText)
        const isPower = Boolean(
          sn?.["is_power"] || sn?.["is_positive_voltage_source"],
        )
        for (const port of resolvedPorts) {
          addPortToNetGroup(
            snId,
            labelText,
            isGround,
            isPower,
            String(port["schematic_port_id"]),
          )
        }
      }
      continue
    }

    if (resolvedPorts.length < 2) continue

    const portsBySheet = new Map<string, string[]>()
    for (const port of resolvedPorts) {
      const portId = String(port["schematic_port_id"])
      const sheetId = portSheetById.get(portId) ?? "default"
      const list = portsBySheet.get(sheetId) ?? []
      if (!list.includes(portId)) list.push(portId)
      portsBySheet.set(sheetId, list)
    }

    const traceLabel =
      typeof el["display_name"] === "string" &&
      el["display_name"].trim().length > 0
        ? el["display_name"]
        : typeof el["source_trace_id"] === "string"
          ? el["source_trace_id"]
          : "trace"

    if (portsBySheet.size > 1) {
      const syntheticNetId =
        typeof el["source_trace_id"] === "string"
          ? el["source_trace_id"]
          : traceLabel
      for (const port of resolvedPorts) {
        addPortToNetGroup(
          syntheticNetId,
          traceLabel,
          false,
          false,
          String(port["schematic_port_id"]),
        )
      }
    } else {
      const sameSheetPinIds = [...portsBySheet.values()][0] ?? []
      for (let i = 0; i < sameSheetPinIds.length - 1; i++) {
        const pinA = sameSheetPinIds[i]!
        const pinB = sameSheetPinIds[i + 1]!
        if (pinA === pinB) continue
        const pairKey = pinA < pinB ? `${pinA}::${pinB}` : `${pinB}::${pinA}`
        if (seenDirectPairs.has(pairKey)) continue
        seenDirectPairs.add(pairKey)
        directConnections.push({
          pinIds: [pinA, pinB],
          netId: traceLabel,
        })
      }
    }
  }

  // Also capture ports linked to source_nets via subcircuit_connectivity_map_key
  for (const [sourcePortId, sourcePort] of sourcePortsById.entries()) {
    const connKey = sourcePort["subcircuit_connectivity_map_key"]
    if (typeof connKey !== "string" || !connKey) continue
    const sn = sourceNetsByConnKey.get(connKey)
    if (!sn || typeof sn["source_net_id"] !== "string") continue
    const snId = sn["source_net_id"]
    const labelText =
      typeof sn["name"] === "string" && sn["name"].trim().length > 0
        ? sn["name"]
        : snId
    const isGround = Boolean(sn["is_ground"]) || isGroundLabelName(labelText)
    const isPower = Boolean(sn["is_power"] || sn["is_positive_voltage_source"])
    for (const port of schematicPortsBySourcePortId.get(sourcePortId) ?? []) {
      addPortToNetGroup(
        snId,
        labelText,
        isGround,
        isPower,
        String(port["schematic_port_id"]),
      )
    }
  }

  const availableNetLabelOrientations: Record<string, FacingDirection[]> = {}
  const netConnections: InputNetConnection[] = []
  const usedNetIds = new Set<string>()

  for (const group of netGroups.values()) {
    if (group.pinIds.size === 0) continue
    const baseNetId = isMultiSheet
      ? `${group.sheetId}:${group.labelText}`
      : group.labelText
    let netId = baseNetId
    if (usedNetIds.has(netId)) {
      netId = `${baseNetId} (${group.sourceNetId})`
    }
    usedNetIds.add(netId)

    const orientations: FacingDirection[] = group.isGround
      ? ["y-"]
      : group.isPower
        ? ["y+"]
        : ["x-", "x+"]
    availableNetLabelOrientations[netId] = orientations

    netConnections.push({
      netId,
      netLabelText: group.labelText,
      isGround: group.isGround,
      netLabelWidth: Number(
        Math.max(0.36, group.labelText.length * 0.12 + 0.18).toFixed(3),
      ),
      pinIds: [...group.pinIds],
    })
  }

  return {
    chips,
    directConnections,
    netConnections,
    ...(textBoxes.length > 0 ? { textBoxes } : {}),
    availableNetLabelOrientations,
    ...(isMultiSheet
      ? { maxMspPairDistance: DEFAULT_MULTI_SHEET_MAX_MSP_DISTANCE_MM }
      : {}),
  }
}

function computeSheetOffsets(
  typedElements: Array<CircuitJsonRecord & { type: string }>,
  schematicComponents: CircuitJsonRecord[],
  schematicPorts: CircuitJsonRecord[],
  getSheetIdForComponent: (componentId: string) => string,
): Map<string, { x: number; y: number }> {
  const sheetMetaById = new Map<
    string,
    { sheetIndex: number; width: number; height: number }
  >()
  for (const el of typedElements) {
    if (
      el.type === "schematic_sheet" &&
      typeof el["schematic_sheet_id"] === "string"
    ) {
      sheetMetaById.set(el["schematic_sheet_id"], {
        sheetIndex:
          typeof el["sheet_index"] === "number" &&
          Number.isFinite(el["sheet_index"])
            ? el["sheet_index"]
            : sheetMetaById.size,
        width:
          typeof el["sheet_width"] === "number" &&
          Number.isFinite(el["sheet_width"]) &&
          el["sheet_width"] > 0
            ? el["sheet_width"]
            : DEFAULT_SHEET_SIZE_MM,
        height:
          typeof el["sheet_height"] === "number" &&
          Number.isFinite(el["sheet_height"]) &&
          el["sheet_height"] > 0
            ? el["sheet_height"]
            : DEFAULT_SHEET_SIZE_MM,
      })
    }
  }

  const boundsBySheet = new Map<
    string,
    { minX: number; maxX: number; minY: number; maxY: number }
  >()
  const expandSheetBounds = (
    sheetId: string,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ) => {
    const existing = boundsBySheet.get(sheetId)
    if (!existing) {
      boundsBySheet.set(sheetId, { minX, maxX, minY, maxY })
      return
    }
    existing.minX = Math.min(existing.minX, minX)
    existing.maxX = Math.max(existing.maxX, maxX)
    existing.minY = Math.min(existing.minY, minY)
    existing.maxY = Math.max(existing.maxY, maxY)
  }

  for (const comp of schematicComponents) {
    const sheetId =
      typeof comp["schematic_sheet_id"] === "string"
        ? comp["schematic_sheet_id"]
        : "default"
    const center = comp["center"] as { x: number; y: number }
    const size = comp["size"] as { width: number; height: number }
    expandSheetBounds(
      sheetId,
      center.x - size.width / 2,
      center.x + size.width / 2,
      center.y - size.height / 2,
      center.y + size.height / 2,
    )
  }

  for (const port of schematicPorts) {
    const compId = String(port["schematic_component_id"])
    const sheetId =
      typeof port["schematic_sheet_id"] === "string"
        ? port["schematic_sheet_id"]
        : getSheetIdForComponent(compId)
    const center = port["center"] as { x: number; y: number }
    expandSheetBounds(sheetId, center.x, center.x, center.y, center.y)
  }

  const orderedSheetIds = [...boundsBySheet.keys()].sort((a, b) => {
    const indexA = sheetMetaById.get(a)?.sheetIndex ?? Number.MAX_SAFE_INTEGER
    const indexB = sheetMetaById.get(b)?.sheetIndex ?? Number.MAX_SAFE_INTEGER
    return indexA - indexB || a.localeCompare(b)
  })

  const offsets = new Map<string, { x: number; y: number }>()
  if (orderedSheetIds.length <= 1) {
    for (const sheetId of orderedSheetIds) {
      offsets.set(sheetId, { x: 0, y: 0 })
    }
    return offsets
  }

  let cellWidth = DEFAULT_SHEET_SIZE_MM
  let cellHeight = DEFAULT_SHEET_SIZE_MM
  for (const sheetId of orderedSheetIds) {
    const bounds = boundsBySheet.get(sheetId)!
    const meta = sheetMetaById.get(sheetId)
    cellWidth = Math.max(
      cellWidth,
      meta?.width ?? 0,
      bounds.maxX - bounds.minX + MULTI_SHEET_MARGIN_MM,
    )
    cellHeight = Math.max(
      cellHeight,
      meta?.height ?? 0,
      bounds.maxY - bounds.minY + MULTI_SHEET_MARGIN_MM,
    )
  }

  const pitchX = cellWidth + MULTI_SHEET_MARGIN_MM
  const pitchY = cellHeight + MULTI_SHEET_MARGIN_MM
  const columns = Math.max(1, Math.ceil(Math.sqrt(orderedSheetIds.length)))

  orderedSheetIds.forEach((sheetId, index) => {
    const bounds = boundsBySheet.get(sheetId)!
    const localCenterX = (bounds.minX + bounds.maxX) / 2
    const localCenterY = (bounds.minY + bounds.maxY) / 2
    const col = index % columns
    const row = Math.floor(index / columns)
    offsets.set(sheetId, {
      x: col * pitchX - localCenterX,
      y: -row * pitchY - localCenterY,
    })
  })

  return offsets
}

function resolvePinDisplayName(
  port: CircuitJsonRecord,
  sourcePort: CircuitJsonRecord | undefined,
  portLabels: CircuitJsonRecord | undefined,
): string | undefined {
  if (portLabels && Array.isArray(sourcePort?.["port_hints"])) {
    for (const hint of sourcePort["port_hints"]) {
      if (typeof hint === "string" && typeof portLabels[hint] === "string") {
        return portLabels[hint] as string
      }
    }
  }
  if (
    typeof sourcePort?.["name"] === "string" &&
    sourcePort["name"].trim().length > 0
  ) {
    return sourcePort["name"]
  }
  if (
    typeof port["pin_number"] === "number" &&
    Number.isFinite(port["pin_number"])
  ) {
    return String(port["pin_number"])
  }
  return undefined
}

function mapFacingDirection(direction: unknown): FacingDirection | undefined {
  if (direction === "right" || direction === "x+") return "x+"
  if (direction === "left" || direction === "x-") return "x-"
  if (direction === "up" || direction === "y+") return "y+"
  if (direction === "down" || direction === "y-") return "y-"
  return undefined
}

function isGroundLabelName(name: string): boolean {
  return /^(gnd|agnd|dgnd|pgnd|sgnd|vss)$/i.test(name.trim())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value["x"] === "number" &&
    Number.isFinite(value["x"]) &&
    typeof value["y"] === "number" &&
    Number.isFinite(value["y"])
  )
}

function isSize(value: unknown): value is { width: number; height: number } {
  return (
    isRecord(value) &&
    typeof value["width"] === "number" &&
    Number.isFinite(value["width"]) &&
    typeof value["height"] === "number" &&
    Number.isFinite(value["height"])
  )
}

export function assertInputProblem(value: unknown) {
  assertRecord(value, "input problem")
  assertArray(value["chips"], "chips")
  assertArray(value["directConnections"], "directConnections")
  assertArray(value["netConnections"], "netConnections")
  assertRecord(
    value["availableNetLabelOrientations"],
    "availableNetLabelOrientations",
  )

  for (let index = 0; index < value["chips"].length; index++) {
    assertChip(value["chips"][index], `chips[${index}]`)
  }

  for (let index = 0; index < value["directConnections"].length; index++) {
    assertDirectConnection(
      value["directConnections"][index],
      `directConnections[${index}]`,
    )
  }

  for (let index = 0; index < value["netConnections"].length; index++) {
    assertNetConnection(
      value["netConnections"][index],
      `netConnections[${index}]`,
    )
  }

  for (const [netId, orientations] of Object.entries(
    value["availableNetLabelOrientations"],
  )) {
    const pathName = `availableNetLabelOrientations.${netId}`
    assertArray(orientations, pathName)

    for (let index = 0; index < orientations.length; index++) {
      const orientation = orientations[index]

      if (
        typeof orientation !== "string" ||
        !VALID_DIRECTIONS.has(orientation as FacingDirection)
      ) {
        throw new Error(
          `${pathName}[${index}] must be one of x+, x-, y+, or y-`,
        )
      }
    }
  }

  if ("textBoxes" in value && value["textBoxes"] !== undefined) {
    assertArray(value["textBoxes"], "textBoxes")

    for (let index = 0; index < value["textBoxes"].length; index++) {
      assertTextBox(value["textBoxes"][index], `textBoxes[${index}]`)
    }
  }

  if (
    "maxMspPairDistance" in value &&
    value["maxMspPairDistance"] !== undefined
  ) {
    assertFiniteNumber(value["maxMspPairDistance"], "maxMspPairDistance")
  }
}

function assertChip(value: unknown, pathName: string) {
  assertRecord(value, pathName)
  assertString(value["chipId"], `${pathName}.chipId`)
  assertPoint(value["center"], `${pathName}.center`)
  assertFiniteNumber(value["width"], `${pathName}.width`)
  assertFiniteNumber(value["height"], `${pathName}.height`)
  assertArray(value["pins"], `${pathName}.pins`)

  for (let index = 0; index < value["pins"].length; index++) {
    assertPin(value["pins"][index], `${pathName}.pins[${index}]`)
  }

  if ("sectionId" in value && value["sectionId"] !== undefined) {
    assertString(value["sectionId"], `${pathName}.sectionId`)
  }
}

function assertPin(value: unknown, pathName: string) {
  assertRecord(value, pathName)
  assertString(value["pinId"], `${pathName}.pinId`)
  assertFiniteNumber(value["x"], `${pathName}.x`)
  assertFiniteNumber(value["y"], `${pathName}.y`)

  if ("_facingDirection" in value && value["_facingDirection"] !== undefined) {
    const direction = value["_facingDirection"]

    if (
      typeof direction !== "string" ||
      !VALID_DIRECTIONS.has(direction as FacingDirection)
    ) {
      throw new Error(
        `${pathName}._facingDirection must be one of x+, x-, y+, or y-`,
      )
    }
  }
}

function assertDirectConnection(value: unknown, pathName: string) {
  assertRecord(value, pathName)
  assertArray(value["pinIds"], `${pathName}.pinIds`)

  if (value["pinIds"].length !== 2) {
    throw new Error(`${pathName}.pinIds must contain exactly 2 pin ids`)
  }

  assertString(value["pinIds"][0], `${pathName}.pinIds[0]`)
  assertString(value["pinIds"][1], `${pathName}.pinIds[1]`)

  if ("netId" in value && value["netId"] !== undefined) {
    assertString(value["netId"], `${pathName}.netId`)
  }

  if ("netLabelWidth" in value && value["netLabelWidth"] !== undefined) {
    assertFiniteNumber(value["netLabelWidth"], `${pathName}.netLabelWidth`)
  }
}

function assertNetConnection(value: unknown, pathName: string) {
  assertRecord(value, pathName)
  assertString(value["netId"], `${pathName}.netId`)
  assertArray(value["pinIds"], `${pathName}.pinIds`)

  for (let index = 0; index < value["pinIds"].length; index++) {
    assertString(value["pinIds"][index], `${pathName}.pinIds[${index}]`)
  }

  if ("netLabelWidth" in value && value["netLabelWidth"] !== undefined) {
    assertFiniteNumber(value["netLabelWidth"], `${pathName}.netLabelWidth`)
  }

  if ("netLabelHeight" in value && value["netLabelHeight"] !== undefined) {
    assertFiniteNumber(value["netLabelHeight"], `${pathName}.netLabelHeight`)
  }
}

function assertTextBox(value: unknown, pathName: string) {
  assertRecord(value, pathName)
  assertPoint(value["center"], `${pathName}.center`)
  assertFiniteNumber(value["width"], `${pathName}.width`)
  assertFiniteNumber(value["height"], `${pathName}.height`)

  if ("chipId" in value && value["chipId"] !== undefined) {
    assertString(value["chipId"], `${pathName}.chipId`)
  }

  if ("text" in value && value["text"] !== undefined) {
    assertString(value["text"], `${pathName}.text`)
  }
}

function assertPoint(value: unknown, pathName: string) {
  assertRecord(value, pathName)
  assertFiniteNumber(value["x"], `${pathName}.x`)
  assertFiniteNumber(value["y"], `${pathName}.y`)
}

function assertRecord(
  value: unknown,
  pathName: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${pathName} must be an object`)
  }
}

function assertArray(
  value: unknown,
  pathName: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${pathName} must be an array`)
  }
}

function assertString(value: unknown, pathName: string) {
  if (typeof value !== "string") {
    throw new Error(`${pathName} must be a string`)
  }
}

function assertFiniteNumber(value: unknown, pathName: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${pathName} must be a finite number`)
  }
}
