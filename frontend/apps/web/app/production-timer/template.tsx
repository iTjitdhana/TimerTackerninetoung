"use client"

import type React from "react"
import { useEffect } from "react"
import { motion } from "framer-motion"

export default function ProductionTimerTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        duration: 0.4,
      }}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  )
}
