#!/usr/bin/env node
// Direct player sync script for GitHub Actions.
// Fetches squad from football-data.org and per-player season totals from
// Sofascore (RapidAPI), then upserts directly into Supabase — bypasses
// Vercel IP blocking.

'use strict'

const { createClient } = require('@supabase/supabase-js')

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4'
const SOFASCORE_BASE = 'https://sofascore.p.rapidapi.com'
const SOFASCORE_HOST = 'sofascore.p.rapidapi.com'

const FCB_TEAM_ID_FD = 81
const FCB_TEAM_ID_SOFA = 2817
const LA_LIGA_TOURNAMENT_ID = 8
const CHAMPIONS_LEAGUE_TOURNAMENT_ID = 7

// Sofascore season-id mapping per FIFA-style start-year.
// To add a new season: GET /teams/get-statistics-seasons?teamId=2817 and
// append the LaLiga + UEFA Champions League IDs here.
const SOFASCORE_SEASON_IDS = {
  2023: { laLiga: 52376, championsLeague: 52162 },
  2024: { laLiga: 61643, championsLeague: 61644 },
  2025: { laLiga: 77559, championsLeague: 76953 },
}

const {
  FOOTBALL_DATA_API_KEY,
  SOFASCORE_RAPIDAPI_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

if (!FOOTBALL_DATA_API_KEY) { console.error('Missing FOOTBALL_DATA_API_KEY'); process.exit(1) }
if (!SOFASCORE_RAPIDAPI_KEY) { console.error('Missing SOFASCORE_RAPIDAPI_KEY'); process.exit(1) }
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

function sofascoreHeaders() {
  return {
    'x-rapidapi-host': SOFASCORE_HOST,
    'x-rapidapi-key': SOFASCORE_RAPIDAPI_KEY,
    Accept: 'application/json',
  }
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

async function fetchSofascoreSquad() {
  const res = await fetch(
    `${SOFASCORE_BASE}/teams/get-squad?teamId=${FCB_TEAM_ID_SOFA}`,
    { headers: sofascoreHeaders() }
  )
  if (!res.ok) throw new Error(`Sofascore /teams/get-squad HTTP ${res.status}`)
  const data = await res.json()
  const out = []
  for (const entry of (data.players ?? [])) {
    const id = entry.player?.id
    const name = (entry.player?.name ?? '').trim()
    if (typeof id === 'number' && isFinite(id) && name) out.push({ id, name })
  }
  return out
}

// Returns the numeric `statistics` block, or `null` when the upstream returns
// its 404 envelope (player has no stats for that tournament/season).
async function fetchSofascorePlayerStats(playerId, tournamentId, seasonId) {
  const url =
    `${SOFASCORE_BASE}/players/get-statistics` +
    `?playerId=${playerId}&tournamentId=${tournamentId}` +
    `&seasonId=${seasonId}&type=overall`

  const res = await fetch(url, { headers: sofascoreHeaders() })
  if (!res.ok) {
    throw new Error(`Sofascore /players/get-statistics HTTP ${res.status}`)
  }
  const data = await res.json()
  if (data && data.error && typeof data.error === 'object') return null
  if (!data || typeof data.statistics !== 'object' || data.statistics === null) {
    return null
  }
  return data.statistics
}

async function getPlayerStats(season) {
  const seasonIds = SOFASCORE_SEASON_IDS[season]
  if (!seasonIds) {
    throw new Error(
      `Sofascore season-id mapping missing for season ${season}. ` +
        `Update SOFASCORE_SEASON_IDS in scripts/sync-players.js.`
    )
  }

  const squad = await fetchSofascoreSquad()
  const result = new Map()

  const tournaments = [
    { id: LA_LIGA_TOURNAMENT_ID, seasonId: seasonIds.laLiga },
    { id: CHAMPIONS_LEAGUE_TOURNAMENT_ID, seasonId: seasonIds.championsLeague },
  ]

  for (const member of squad) {
    const key = normalizeName(member.name)
    if (!key) continue

    const bucket = result.get(key) ?? {
      goals: 0, assists: 0, appearances: 0,
      games_started: 0, minutes: 0, yellow_cards: 0, red_cards: 0,
    }

    for (const t of tournaments) {
      const stats = await fetchSofascorePlayerStats(member.id, t.id, t.seasonId)
      if (!stats) continue
      bucket.goals         += safeNum(stats.goals)
      bucket.assists       += safeNum(stats.assists)
      bucket.appearances   += safeNum(stats.appearances)
      bucket.games_started += safeNum(stats.matchesStarted)
      bucket.minutes       += safeNum(stats.minutesPlayed)
      bucket.yellow_cards  += safeNum(stats.yellowCards)
      bucket.red_cards     += safeNum(stats.redCards)
    }

    result.set(key, bucket)
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
