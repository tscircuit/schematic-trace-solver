import type {
  InputDirectConnection,
  InputNetConnection,
} from "lib/types/InputProblem"

export const DEFAULT_INLINE_NET_LABEL_HEIGHT = 0.18

/** Estimate the text width when core did not supply it. */
export const estimateInlineNetLabelWidth = (
  text: string,
  fontSize = DEFAULT_INLINE_NET_LABEL_HEIGHT,
) => {
  const fontScale = fontSize / 0.18
  return text.length * 0.12 * fontScale + 0.12 * fontScale
}

export const getInlineNetLabelSize = (
  connection: InputDirectConnection | InputNetConnection,
) => {
  const height =
    connection.inlineNetLabelHeight ?? DEFAULT_INLINE_NET_LABEL_HEIGHT
  const netLabelText = connection.netLabelText?.trim() || undefined
  const width =
    connection.inlineNetLabelWidth ??
    connection.netLabelWidth ??
    estimateInlineNetLabelWidth(netLabelText ?? connection.netId ?? "", height)
  return { height, netLabelText, width }
}
