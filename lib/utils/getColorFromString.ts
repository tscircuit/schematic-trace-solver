export const getColorFromString = (string: string, alpha = 1) => {
  // pseudo random number from string
  const hash = string.split("").reduce((acc, char) => {
    return (acc * 31 + char.charCodeAt(0)) | 0
  }, 0)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 100%, 50%, ${alpha})`
}

