export const getColorFromString = (string: string, alpha = 1) => {
  // pseudo random number from string
  const hash = string.split("").reduce((acc, char) => {
    const next = acc * 31 + char.charCodeAt(0)
    return Number.isFinite(next) ? next : (acc % 360) * 31 + char.charCodeAt(0)
  }, 0)
  const hue = Number.isFinite(hash) ? Math.abs(hash) % 360 : 0
  return `hsl(${hue}, 100%, 50%, ${alpha})`
}
