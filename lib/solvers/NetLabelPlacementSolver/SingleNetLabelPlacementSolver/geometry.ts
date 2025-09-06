import type { FacingDirection } from "lib/utils/dir"
import { estimateTextWidth } from "lib/utils/estimate-text-width"
import { getSchMmFontSize } from "lib/utils/get-sch-font-size"

export const NET_LABEL_HORIZONTAL_HEIGHT = 0.2
// Constants matching the net label implementation
export const ARROW_POINT_WIDTH_FSR = 0.1
export const END_PADDING_FSR = 0.05
export const END_PADDING_EXTRA_PER_CHARACTER_FSR = 0.01

export function getDimsForOrientation(
  orientation: FacingDirection,
  text?: string,
) {
  const fontSizeMm = getSchMmFontSize()
  const textWidthFSR = text ? estimateTextWidth(text) : 2.5 // fallback for typical 3-4 char labels

  // Calculate full width exactly like the net label implementation
  const fullWidthFsr =
    textWidthFSR +
    ARROW_POINT_WIDTH_FSR * 2 +
    END_PADDING_EXTRA_PER_CHARACTER_FSR * (text?.length || 0) +
    END_PADDING_FSR

  // The net label uses 0.6 as the half-height in font-relative coordinates
  // So full height FSR is 1.2, scaled by font size
  const fullHeightFsr = 1.2

  // Apply font size scaling to get real dimensions
  const realWidth = fullWidthFsr * fontSizeMm
  const realHeight = fullHeightFsr * fontSizeMm

  if (orientation === "y+" || orientation === "y-") {
    return {
      width: realHeight,
      height: realWidth,
    }
  }
  return {
    width: realWidth,
    height: realHeight,
  }
}

export function getCenterFromAnchor(
  anchor: { x: number; y: number },
  orientation: FacingDirection,
  width: number,
  height: number,
) {
  switch (orientation) {
    case "x+":
      return { x: anchor.x + width / 2, y: anchor.y }
    case "x-":
      return { x: anchor.x - width / 2, y: anchor.y }
    case "y+":
      return { x: anchor.x, y: anchor.y + height / 2 }
    case "y-":
      return { x: anchor.x, y: anchor.y - height / 2 }
  }
}

export function getRectBounds(
  center: { x: number; y: number },
  w: number,
  h: number,
) {
  return {
    minX: center.x - w / 2,
    minY: center.y - h / 2,
    maxX: center.x + w / 2,
    maxY: center.y + h / 2,
  }
}
