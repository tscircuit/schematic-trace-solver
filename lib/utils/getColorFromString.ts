export const getColorFromString = (string: string, alpha = 1) => {
  // pseudo random number from string
  const hash = string.split("").reduce((acc, char) => {
    return acc * 31 + char.charCodeAt(0)
  }, 0)
  // For very long strings the accumulator overflows to Infinity, which makes
  // `hash % 360` NaN and produces an invalid `hsl(NaN, ...)` color. Fall back
  // to a valid hue in that case. Every finite hash is unchanged.
  const hue = Number.isFinite(hash) ? hash % 360 : 0
  return `hsl(${hue}, 100%, 50%, ${alpha})`
}
