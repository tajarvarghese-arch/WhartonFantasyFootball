import { useState } from 'react'
import { useLeagueData } from '../lib/data'
import { managerColor, managerInitials } from '../lib/identity'
import { achievements } from '../lib/achievements'
import { careerTable, eraOptions, managerSeasons } from '../lib/stats'
import type { ManagerId } from '../lib/types'

/**
 * Renders a manager's card to a canvas and downloads it as a PNG — built for
 * the group chat. All drawing is local; nothing leaves the browser.
 */
export default function TradingCard({ id }: { id: ManagerId }) {
  const data = useLeagueData()
  const [busy, setBusy] = useState(false)

  async function generate() {
    setBusy(true)
    try {
      const manager = data.managers.find((candidate) => candidate.id === id)
      const line = careerTable(data.seasons, eraOptions(data.seasons)[0]).find(
        (row) => row.manager === id,
      )
      if (!manager || !line) return
      const color = managerColor(id)
      const history = managerSeasons(data.seasons, id)
        .slice(0, 14)
        .reverse()
        .map((row) =>
          row.team.wins + row.team.losses ? row.team.wins / (row.team.wins + row.team.losses) : 0,
        )

      // Make sure the pixel faces are actually loaded before drawing with them.
      await Promise.all([
        document.fonts.load('26px "DotGothic16"'),
        document.fonts.load('600 20px "IBM Plex Mono"'),
      ]).catch(() => undefined)

      const W = 640
      const H = 900
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!

      // card stock
      ctx.fillStyle = '#171128'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = color
      ctx.lineWidth = 14
      ctx.strokeRect(7, 7, W - 14, H - 14)
      ctx.strokeStyle = '#04030a'
      ctx.lineWidth = 4
      ctx.strokeRect(18, 18, W - 36, H - 36)

      // header band
      ctx.fillStyle = color
      ctx.fillRect(20, 20, W - 40, 96)
      ctx.fillStyle = '#06040d'
      ctx.font = '34px "DotGothic16", monospace'
      ctx.fillText(manager.displayName.toUpperCase(), 44, 80)
      ctx.font = '16px "DotGothic16", monospace'
      ctx.fillText('WACL · EST. 2004', 44, 104)

      // badge
      ctx.fillStyle = color
      ctx.fillRect(W / 2 - 90, 160, 180, 180)
      ctx.strokeStyle = '#04030a'
      ctx.lineWidth = 6
      ctx.strokeRect(W / 2 - 90, 160, 180, 180)
      ctx.fillStyle = '#06040d'
      ctx.font = '64px "DotGothic16", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(managerInitials(manager, id), W / 2, 262)
      ctx.textAlign = 'left'

      // team name
      ctx.fillStyle = '#a79cc4'
      ctx.font = '600 22px "IBM Plex Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(manager.team ?? 'Former manager', W / 2, 390)
      ctx.textAlign = 'left'

      // stat rows
      const stats: [string, string][] = [
        ['TITLES', '★'.repeat(line.titles) || '—'],
        ['RECORD', `${line.wins}-${line.losses}`],
        ['WIN %', `${(line.winPct * 100).toFixed(1)}%`],
        ['PLAYOFFS', `${line.playoffAppearances}/${line.seasonsPlayed} seasons`],
        ['AVG PTS', line.avgPointsFor ? line.avgPointsFor.toFixed(1) : '—'],
        ['BEST FINISH', line.bestFinish === 1 ? 'CHAMPION' : `#${line.bestFinish}`],
      ]
      let y = 452
      for (const [label, value] of stats) {
        ctx.fillStyle = '#6b6089'
        ctx.font = '15px "DotGothic16", monospace'
        ctx.fillText(label, 60, y)
        ctx.fillStyle = label === 'TITLES' && line.titles ? '#ffd84d' : '#efeafb'
        ctx.font = '600 24px "IBM Plex Mono", monospace'
        ctx.textAlign = 'right'
        ctx.fillText(value, W - 60, y)
        ctx.textAlign = 'left'
        ctx.strokeStyle = '#3a2f5c'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(60, y + 14)
        ctx.lineTo(W - 60, y + 14)
        ctx.stroke()
        y += 52
      }

      // win% sparkline
      ctx.fillStyle = '#6b6089'
      ctx.font = '14px "DotGothic16", monospace'
      ctx.fillText('FORM', 60, y + 8)
      const chartX = 60
      const chartW = W - 120
      const chartY = y + 22
      const chartH = 64
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.beginPath()
      history.forEach((value, index) => {
        const px = chartX + (index / Math.max(history.length - 1, 1)) * chartW
        const py = chartY + (1 - value) * chartH
        if (index === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()

      // badges
      const myBadges = (achievements(data).get(id) ?? []).slice(0, 4)
      if (myBadges.length) {
        ctx.font = '30px serif'
        ctx.textAlign = 'center'
        const spread = 56
        myBadges.forEach((badge, i) => {
          const bx = W / 2 + (i - (myBadges.length - 1) / 2) * spread
          ctx.fillText(badge.emoji, bx, H - 84)
        })
        ctx.textAlign = 'left'
      }

      // footer
      ctx.fillStyle = '#6b6089'
      ctx.font = '13px "DotGothic16", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('WACL ARCADE · COMMISSIONER SERIES', W / 2, H - 44)
      ctx.textAlign = 'left'

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `wacl-card-${id}.png`
            link.click()
            URL.revokeObjectURL(url)
          }
          resolve()
        }, 'image/png')
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="btn" disabled={busy} onClick={() => void generate()}>
      {busy ? 'Printing…' : '↓ Trading card'}
    </button>
  )
}
