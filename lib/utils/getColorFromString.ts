export const getColorFromString = (string: string, alpha = 1) => {
  // pseudo random number from string
  const hash = string.split("").reduce((acc, char) => {
    return acc * 31 + char.charCodeAt(0)
  }, 0)
  const rawHue = hash % 360
  const hue = Number.isNaN(rawHue) ? 0 : rawHue
  return `hsl(${hue}, 100%, 50%, ${alpha})`
}
