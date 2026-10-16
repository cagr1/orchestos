import { motion, useReducedMotion } from 'motion/react'

interface ThreadEmptyProps {
  title: string
  subtitle: string
}

export function ThreadEmpty({ title, subtitle }: ThreadEmptyProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      data-thread-empty
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="max-w-3xl lg:max-w-4xl mx-auto pt-16 text-left space-y-1"
    >
      <h1 className="text-lg font-bold text-app tracking-tight">{title}</h1>
      <p className="text-sm text-app-muted">{subtitle}</p>
    </motion.div>
  )
}
