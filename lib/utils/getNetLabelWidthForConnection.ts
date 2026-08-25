import type {
  InputDirectConnection,
  InputNetConnection,
  InputProblem,
  NetId,
  PinId,
} from "lib/types/InputProblem"

type ConnectionWithLabelWidth = InputDirectConnection | InputNetConnection

const getConfiguredWidth = (
  connections: Array<ConnectionWithLabelWidth | undefined>,
  labelType: "inline" | "anchored",
) => {
  const width = connections.find(
    (connection) => connection?.netLabelWidth !== undefined,
  )?.netLabelWidth
  if (width !== undefined || labelType === "inline") return width

  return connections.find(
    (connection) => connection?.anchoredNetLabelWidth !== undefined,
  )?.anchoredNetLabelWidth
}

export const getNetLabelWidthForConnection = ({
  inputProblem,
  netId,
  pinIds,
  labelType,
}: {
  inputProblem: InputProblem
  netId?: NetId
  pinIds: readonly PinId[]
  labelType: "inline" | "anchored"
}): number | undefined => {
  if (netId) {
    const widthByNetId = getConfiguredWidth(
      [
        inputProblem.netConnections.find(
          (connection) => connection.netId === netId,
        ),
        inputProblem.directConnections.find(
          (connection) => connection.netId === netId,
        ),
      ],
      labelType,
    )
    if (widthByNetId !== undefined) return widthByNetId
  }

  return getConfiguredWidth(
    [
      inputProblem.directConnections.find((connection) =>
        connection.pinIds.some((pinId) => pinIds.includes(pinId)),
      ),
      inputProblem.netConnections.find((connection) =>
        connection.pinIds.some((pinId) => pinIds.includes(pinId)),
      ),
    ],
    labelType,
  )
}
