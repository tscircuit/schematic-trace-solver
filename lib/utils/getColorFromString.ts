export const getColorFromString = (string: string, alpha = 1) => {
  // pseudo random number from string
  let hash = 0
  let useModuloHash = false
  for (let i = 0; i < string.length; i++) {
    // Preserve the existing hash until the next multiplication could overflow.
    // From that point onward, reducing modulo 360 keeps the eventual hue
    // equivalent while allowing every remaining character to contribute.
    if (hash >= Number.MAX_VALUE / 31) useModuloHash = true
    if (useModuloHash) hash %= 360
    hash = hash * 31 + string.charCodeAt(i)
  }
  return `hsl(${hash % 360}, 100%, 50%, ${alpha})`
}
