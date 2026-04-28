import React, { useEffect } from "react"

export const TailwindDecorator = ({
  children,
}: {
  children: React.ReactNode
}) => {
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://cdn.tailwindcss.com"
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return <>{children}</>
}

export default TailwindDecorator
