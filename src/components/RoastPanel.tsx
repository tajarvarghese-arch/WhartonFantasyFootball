import { useState } from 'react'
import { useLeagueData } from '../lib/data'
import { roast } from '../lib/roast'
import { play } from '../lib/sfx'
import type { ManagerId } from '../lib/types'
import { Panel } from './ui'

/** The Roast Button. Data-backed burns; reroll for a fresh assembly. */
export default function RoastPanel({ id }: { id: ManagerId }) {
  const data = useLeagueData()
  const [seed, setSeed] = useState<number | null>(null)

  if (seed === null) {
    return (
      <button
        type="button"
        className="btn"
        onClick={() => {
          play('whistle')
          setSeed(1)
        }}
      >
        🔥 Roast
      </button>
    )
  }

  const lines = roast(data, id, seed)
  return (
    <Panel
      title="the roast"
      subtitle="Every line is backed by a number in this site. That's why it hurts."
      action={
        <div className="flex gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => {
              play('trombone')
              setSeed(seed + 1)
            }}
          >
            Again
          </button>
          <button type="button" className="btn" onClick={() => setSeed(null)}>
            Mercy
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-5 py-5">
        {lines.map((line, index) => (
          <p key={index} className="text-[14.5px] leading-relaxed text-arc-ink-soft">
            {line}
          </p>
        ))}
      </div>
    </Panel>
  )
}
