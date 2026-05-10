#!/usr/bin/env node
// Direct player sync script for GitHub Actions.
// Fetches squad from football-data.org and stats from api-football.com,
// then upserts directly into Supabase — bypasses Vercel IP blocking.

'use strict'

const { createClient } = require('@supabase/supabase-js')

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4'
const API_FOOTBALL_BASE = 'https://v3.api-football.com'
const FCB_TEAM_ID_FD = 81
const FCB_TEAM_ID_AF = 529
const LA_LIGA = 140
const CHAMPIONS_LEAGUE = 2
const MAX_PAGES = 10

const {
  FOOTBALL_DATA_API_KEY,
  API_FOOTBALL_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

if (!FOOTBALL_DATA_API_KEY) { console.error('Missing FOOTBALL_DATA_API_KEY'); process.exit(1) }
if (!API_FOOTBALL_KEY)      { console.error('Missing API_FOOTBALL_KEY');      process.exit(1) }
if (!SUPABASE_URL)          { console.error('Missing SUPABASE_URL');          process.exit(1) }
if (!SUPABASE_SERVICE_ROLE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

function currentSeasonYear() {
  const now = new Date()
  const month = now.getUTCMonth() + 1
  return month >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePosition(pos) {
  if (!pos) return null
  const p = pos.toLowerCase()
  if (p.includes('goalkeeper') || p === 'keeper') return 'Goalkeeper'
  if (p.includes('defence') || p.includes('defender') || p.includes('back')) return 'Defender'
  if (p.includes('midfield')) return 'Midfielder'
  if (p.includes('offence') || p.includes('forward') || p.includes('attacker') || p.includes('winger') || p.includes('striker')) return 'Attacker'
  return null
}

function safeNum(n) {
  return typeof n === 'number' && isFinite(n) ? n : 0
}

async function getSquad() {
  const res = await fetch(`${FOOTBALL_DATA_BASE}/teams/${FCB_TEAM_ID_FD}`, {
    headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY },
  })
  if (!res.ok) throw new Error(`football-data.org HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data.squad)) return []
  return data.squad.map(m => ({
    id: m.id,
    name: m.name,
    position: normalizePosition(m.position),
    shirtNumber: m.shirtNumber ?? null,
  }))
}

async function getPlayerStats(season) {
  const result = new Map()
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= MAX_PAGES) {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/players?team=${FCB_TEAM_ID_AF}&season=${season}&page=${page}`,
      { headers: { 'x-apisports-key': API_FOOTBALL_KEY, Accept: 'application/json' } }
    )
    if (!res.ok) throw new Error(`api-football.com HTTP ${res.status}`)
    const data = await res.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(`api-football.com error: ${JSON.stringify(data.errors)}`)
    }

    for (const entry of (data.response ?? [])) {
      const info = entry.player ?? {}
      const first = (info.firstname ?? '').trim()
      const last  = (info.lastname  ?? '').trim()
      const fullName = [first, last].filter(Boolean).join(' ') || (info.name ?? '').trim()
      if (!fullName) continue
      const key = normalizeName(fullName)
      if (!key) continue

      const bucket = result.get(key) ?? {
        goals: 0, assists: 0, appearances: 0,
        games_started: 0, minutes: 0, yellow_cards: 0, red_cards: 0,
      }

      for (const line of (entry.statistics ?? [])) {
        const leagueId  = line.league?.id   ?? null
        const lineSeason = line.league?.season ?? null
        const teamId    = line.team?.id     ?? null
        if (lineSeason !== null && lineSeason !== season) continue
        if (teamId     !== null && teamId    !== FCB_TEAM_ID_AF) continue
        if (leagueId !== LA_LIGA && leagueId !== CHAMPIONS_LEAGUE) continue

        bucket.goals        += safeNum(line.goals?.total)
        bucket.assists      += safeNum(line.goals?.assists)
        bucket.appearances  += safeNum(line.games?.appearences) // sic — upstream typo
        bucket.games_started += safeNum(line.games?.lineups)
        bucket.minutes      += safeNum(line.games?.minutes)
        bucket.yellow_cards += safeNum(line.cards?.yellow)
        bucket.red_cards    += safeNum(line.cards?.red)
      }
      result.set(key, bucket)
    }

    if (typeof data.paging?.total === 'number' && data.paging.total > 0) {
      totalPages = data.paging.total
    }
    page++
  }

  return result
}

async function main() {
  const season = currentSeasonYear()
  console.log(`[sync-players] season=${season}`)

  const squad = await getSquad()
  console.log(`[sync-players] squad fetched: ${squad.length} players`)

  const statsByName = await getPlayerStats(season)
  console.log(`[sync-players] stats fetched: ${statsByName.size} entries`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: existing } = await supabase
    .from('players')
    .select('api_football_id')
    .in('api_football_id', squad.map(p => p.id))

  const existingIds = new Set((existing ?? []).map(r => r.api_football_id).filter(Boolean))

  let synced = 0
  const errors = []

  for (const member of squad) {
    const key = normalizeName(member.name)
    const raw = statsByName.get(key) ?? {}
    const stats = {
      goals:        safeNum(raw.goals),
      assists:      safeNum(raw.assists),
      appearances:  safeNum(raw.appearances),
      games_started: safeNum(raw.games_started),
      minutes:      safeNum(raw.minutes),
      yellow_cards: safeNum(raw.yellow_cards),
      red_cards:    safeNum(raw.red_cards),
    }

    const isExisting = existingIds.has(member.id)
    const payload = {
      api_football_id: member.id,
      name:     member.name,
      position: member.position,
      number:   member.shirtNumber,
      stats,
      season,
      updated_at: new Date().toISOString(),
      ...(!isExisting ? { image_url: null, bio: null } : {}),
    }

    const { error } = await supabase
      .from('players')
      .upsert(payload, { onConflict: 'api_football_id', ignoreDuplicates: false })

    if (error) {
      errors.push(`${member.name}: ${error.message}`)
      console.error(`[sync-players] ERROR ${member.name}: ${error.message}`)
    } else {
      synced++
    }
  }

  console.log(`[sync-players] done: synced=${synced}, errors=${errors.length}`)
  process.exit(errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[sync-players] fatal:', err)
  process.exit(1)
})
