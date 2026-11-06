import { motion, useReducedMotion } from 'motion/react'

interface ThreadEmptyProps {
  title: string
}

export function ThreadEmpty({ title }: ThreadEmptyProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      data-thread-empty
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="max-w-3xl lg:max-w-4xl mx-auto pt-16 text-left"
    >
      <h1 className="text-lg font-bold text-app tracking-tight">{title}</h1>
    </motion.div>
  )
}
