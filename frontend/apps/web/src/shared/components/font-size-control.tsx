"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function FontSizeControl() {
  const [fontSize, setFontSize] = useState(100)
  const [showPercentage, setShowPercentage] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)

  useEffect(() => {
    if (showPercentage) {
      const timer = setTimeout(() => {
        setShowPercentage(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [showPercentage])

  const increaseFontSize = () => {
    if (fontSize < 150) {
      const newSize = fontSize + 10
      setFontSize(newSize)
      document.documentElement.style.fontSize = `${newSize}%`
      setShowPercentage(true)
    }
  }

  const decreaseFontSize = () => {
    if (fontSize > 80) {
      const newSize = fontSize - 10
      setFontSize(newSize)
      document.documentElement.style.fontSize = `${newSize}%`
      setShowPercentage(true)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-1.5">
      {showPercentage && !isCollapsed && (
        <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-right-2 duration-200">
          {fontSize}%
        </div>
      )}

      {!isCollapsed && (
        <div className="bg-background border border-border rounded-lg shadow-lg p-1.5 flex flex-row gap-1 animate-in slide-in-from-right duration-200">
          <button
            suppressHydrationWarning
            onClick={increaseFontSize}
            disabled={fontSize >= 150}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-semibold"
            aria-label="เพิ่มขนาดตัวอักษร"
          >
            ก+
          </button>
          <button
            suppressHydrationWarning
            onClick={decreaseFontSize}
            disabled={fontSize <= 80}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-semibold"
            aria-label="ลดขนาดตัวอักษร"
          >
            ก-
          </button>
        </div>
      )}

      <button
        suppressHydrationWarning
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-6 h-6 flex items-center justify-center rounded-lg bg-background border border-border shadow-lg hover:bg-muted/50 transition-colors"
        aria-label={isCollapsed ? "แสดงปุ่มปรับขนาดตัวอักษร" : "ซ่อนปุ่มปรับขนาดตัวอักษร"}
      >
        {isCollapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </div>
  )
}
