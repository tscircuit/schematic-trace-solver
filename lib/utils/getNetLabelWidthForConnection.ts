import type {
  InputDirectConnection,
  InputNetConnection,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"

type ConnectionWithLabelWidth = InputDirectConnection | InputNetConnection

const getConfiguredWidth = (
  connections: Array<ConnectionWithLabelWidth | undefined>,
  includeFallbackNetLabelWidth: boolean,
) => {
  const explicitWidth = connections.find(
    (connection) => connection?.netLabelWidth !== undefined,
  )?.netLabelWidth
  if (explicitWidth !== undefined) return explicitWidth
  if (!includeFallbackNetLabelWidth) return undefined

  return connections.find(
    (connection) => connection?.fallbackNetLabelWidth !== undefined,
  )?.fallbackNetLabelWidth
}

export const getNetLabelWidthForConnection = ({
  inputProblem,
  netId,
  pinIds,
  includeFallbackNetLabelWidth = true,
}: {
  inputProblem: InputProblem
  netId?: string
  pinIds: readonly PinId[]
  includeFallbackNetLabelWidth?: boolean
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
      includeFallbackNetLabelWidth,
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
    includeFallbackNetLabelWidth,
  )
}
