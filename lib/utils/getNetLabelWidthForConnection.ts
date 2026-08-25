import type {
  InputDirectConnection,
  InputNetConnection,
  InputProblem,
  NetId,
  PinId,
} from "lib/types/InputProblem"

type ConnectionWithLabelWidth = InputDirectConnection | InputNetConnection

type ConnectionLookup = {
  inputProblem: InputProblem
  netId?: NetId
  pinIds: readonly PinId[]
}

const getNetLabelWidth = (
  connections: Array<ConnectionWithLabelWidth | undefined>,
) =>
  connections.find((connection) => connection?.netLabelWidth !== undefined)
    ?.netLabelWidth

const getAnchoredNetLabelWidth = (
  connections: Array<ConnectionWithLabelWidth | undefined>,
) =>
  getNetLabelWidth(connections) ??
  connections.find(
    (connection) => connection?.anchoredNetLabelWidth !== undefined,
  )?.anchoredNetLabelWidth

const getWidthForConnection = (
  { inputProblem, netId, pinIds }: ConnectionLookup,
  getWidth: (
    connections: Array<ConnectionWithLabelWidth | undefined>,
  ) => number | undefined,
): number | undefined => {
  if (netId) {
    const widthByNetId = getWidth([
      inputProblem.netConnections.find(
        (connection) => connection.netId === netId,
      ),
      inputProblem.directConnections.find(
        (connection) => connection.netId === netId,
      ),
    ])
    if (widthByNetId !== undefined) return widthByNetId
  }

  return getWidth([
    inputProblem.directConnections.find((connection) =>
      connection.pinIds.some((pinId) => pinIds.includes(pinId)),
    ),
    inputProblem.netConnections.find((connection) =>
      connection.pinIds.some((pinId) => pinIds.includes(pinId)),
    ),
  ])
}

export const getNetLabelWidthForConnection = (
  lookup: ConnectionLookup,
): number | undefined => getWidthForConnection(lookup, getNetLabelWidth)

export const getAnchoredNetLabelWidthForConnection = (
  lookup: ConnectionLookup,
): number | undefined => getWidthForConnection(lookup, getAnchoredNetLabelWidth)
