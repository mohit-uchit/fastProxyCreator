"use client"

import { useRef, useEffect } from "react"

interface TerminalProps {
  output: string[]
  isRunning: boolean
}

export default function Terminal({ output, isRunning }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [output])

  return (
    <div
      ref={terminalRef}
      className="bg-black text-green-400 p-4 rounded-md h-[500px] overflow-y-auto font-mono text-sm"
    >
      {output.map((line, index) => {
        // Add different styles based on line content
        let className = "mb-1 whitespace-pre-wrap"
        
        // Only style lines that don't start with a separator
        if (!line.startsWith('--------------------------------------------------')) {
          if (line.includes('⚠️') || line.includes('Warning')) {
            className += " text-yellow-400"
          } else if (line.includes('❌') || line.includes('Error')) {
            className += " text-red-400"
          } else if (line.includes('✅') || line.includes('Success')) {
            className += " text-green-400"
          } else if (line.includes('📦') || line.includes('Installing')) {
            className += " text-blue-400"
          } else if (line.includes('🔄') || line.includes('Starting')) {
            className += " text-purple-400"
          } else if (line.includes('🔑') || line.includes('Authentication')) {
            className += " text-cyan-400"
          } else if (line.includes('⚙️') || line.includes('Configuring')) {
            className += " text-yellow-400"
          } else if (line.includes('📡') || line.includes('Updating')) {
            className += " text-blue-400"
          } else if (line.includes('▶')) {
            className += " text-blue-400 font-bold"
          } else if (line.includes('👉')) {
            className += " text-gray-400"
          }
        } else {
          className += " text-gray-500"
        }

        return (
          <div key={index} className={className}>
            {line}
          </div>
        )
      })}
      {isRunning && (
        <div className="animate-pulse text-green-400">
          <span className="inline-block w-2 h-4 bg-green-400 align-middle"></span>
        </div>
      )}
    </div>
  )
}
