import React from 'react'
import {
  Card, CardContent, Typography, Stack, TextField, LinearProgress, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, IconButton, Tooltip, Button, TableContainer
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { supabase } from '../supabaseClient'
import { logActivity } from '../activityLog'
import './Reports.css'

type Row = {
  id: string
  first_name: string | null
  last_name: string | null
  course: string | null
  graduation_year: number | null
  is_verified: boolean | null
  verified_at: string | null
  verified_by: string | null
}

type CsvAlumniRecord = {
  fullName: string
  year: number
}

function normalizeNameParts(firstOrFull?: string | null, last?: string | null) {
  const f = (firstOrFull || '').trim().toLowerCase()
  const l = (last || '').trim().toLowerCase()
  const joined = [f, l].filter(Boolean).join(' ')
  return joined.replace(/\s+/g, ' ')
}

function parseVerificationCsv(text: string): CsvAlumniRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length < 2) return []

  const headerLine = lines[0]
  let delimiter = ','
  if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';'
  else if (headerLine.includes('\t') && !headerLine.includes(',')) delimiter = '\t'

  const splitLine = (line: string) =>
    line
      .split(delimiter)
      .map(p => p.trim().replace(/^"|"$/g, ''))

  const headers = splitLine(headerLine).map(h => h.toLowerCase())

  const findIndex = (candidates: string[]) =>
    headers.findIndex(h => candidates.includes(h))

  const idxFirst = findIndex(['first name', 'first_name', 'firstname', 'given name', 'given_name'])
  const idxLast = findIndex(['last name', 'last_name', 'lastname', 'surname', 'family name', 'family_name'])
  const idxFull = findIndex(['full name', 'fullname', 'full_name', 'name', 'display_full_name'])
  const idxYear = findIndex([
    'year graduated',
    'year_graduated',
    'yeargraduated',
    'graduation_year',
    'year of graduation',
    'yearofgraduation',
    'grad year',
    'grad_year',
    'batch',
    'batch year',
    'batch_year',
    'year',
  ])

  if (idxYear === -1) return []
  if (idxFull === -1 && (idxFirst === -1 || idxLast === -1)) return []

  const candidateIdxs = [idxYear, idxFull, idxFirst, idxLast].filter(i => i >= 0)
  const maxIdx = Math.max(...candidateIdxs)
  const records: CsvAlumniRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i])
    if (parts.length <= maxIdx) continue

    const yearStr = parts[idxYear]?.trim()
    const year = parseInt(yearStr, 10)

    let fullName = ''
    if (idxFull !== -1) {
      fullName = parts[idxFull]?.trim() || ''
    }
    if (!fullName && idxFirst !== -1 && idxLast !== -1) {
      const first = parts[idxFirst]?.trim() || ''
      const last = parts[idxLast]?.trim() || ''
      fullName = `${first} ${last}`.trim()
    }

    if (!fullName || !Number.isFinite(year)) continue

    records.push({ fullName, year })
  }

  return records
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return d || '—' }
}

export default function AlumniVerificationAdmin() {
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [csvProcessing, setCsvProcessing] = React.useState(false)
  const [csvMessage, setCsvMessage] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,first_name,last_name,course,graduation_year,is_verified,verified_at,verified_by')
        .order('last_name', { ascending: true })
        .limit(1000)
      if (error) throw error
      setRows((data ?? []) as Row[])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  const handleCsvUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setCsvMessage(null)
    setCsvProcessing(true)

    try {
      const text = await file.text()
      const parsed = parseVerificationCsv(text)

      if (!parsed.length) {
        setError('CSV is empty or missing required columns (First Name, Last Name, Year Graduated).')
        return
      }

      const map = new Map<string, Row>()
      rows.forEach(r => {
        if (!r.first_name || !r.last_name || !r.graduation_year) return
        const nameKey = normalizeNameParts(`${r.first_name} ${r.last_name}`)
        const key = `${nameKey}|${r.graduation_year}`
        map.set(key, r)
      })

      const toVerify: Row[] = []
      let alreadyVerified = 0

      parsed.forEach(rec => {
        const csvNameKey = normalizeNameParts(rec.fullName)
        const key = `${csvNameKey}|${rec.year}`
        const row = map.get(key)
        if (!row) return
        if (row.is_verified) {
          alreadyVerified++
          return
        }
        toVerify.push(row)
      })

      if (toVerify.length === 0) {
        setCsvMessage(`No matching pending alumni found to verify. Already verified: ${alreadyVerified}.`)
        return
      }

      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const adminId = userRes.user?.id || null

      const nowIso = new Date().toISOString()
      const payload: Partial<Row> = {
        is_verified: true,
        verified_at: nowIso,
        verified_by: adminId,
      }

      const ids = toVerify.map(r => r.id)

      const { error: updErr } = await supabase
        .from('profiles')
        .update(payload)
        .in('id', ids)
      if (updErr) throw updErr

      await logActivity(
        supabase,
        'Bulk Verify Alumni (CSV)',
        `verified_count=${ids.length}; already_verified=${alreadyVerified}; file_name=${file.name}`
      )

      setRows(prev => prev.map(r => (
        ids.includes(r.id)
          ? { ...r, ...payload }
          : r
      )))

      setCsvMessage(`Successfully verified ${ids.length} alumni from CSV. Already verified: ${alreadyVerified}.`)
    } catch (e: any) {
      setError(e?.message || 'Failed to process CSV for verification.')
    } finally {
      setCsvProcessing(false)
      event.target.value = ''
    }
  }

  const toggleVerify = async (r: Row) => {
    const nextVerified = !r.is_verified
    setSavingId(r.id)
    // optimistic UI
    setRows(prev => prev.map(x => x.id === r.id
      ? { ...x, is_verified: nextVerified, verified_at: nextVerified ? new Date().toISOString() : null }
      : x
    ))
    try {
      const { data: u } = await supabase.auth.getUser()
      const adminId = u.user?.id || null
      const payload: Partial<Row> = {
        is_verified: nextVerified,
        verified_at: nextVerified ? new Date().toISOString() : null,
        verified_by: nextVerified ? adminId : null
      }
      const { error } = await supabase.from('profiles').update(payload).eq('id', r.id)
      if (error) throw error
      await logActivity(
        supabase,
        nextVerified ? 'Verify Alumni' : 'Unverify Alumni',
        `alumni_id=${r.id}; name=${(r.last_name || '')}, ${(r.first_name || '')}`,
        r.id
      )
    } catch (e: any) {
      setError(e.message || 'Update failed')
      // revert
      setRows(prev => prev.map(x => x.id === r.id ? r : x))
    } finally {
      setSavingId(null)
    }
  }

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const name = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase()
    const status = r.is_verified ? 'verified' : 'pending'
    return (
      name.includes(q) ||
      (r.course || '').toLowerCase().includes(q) ||
      String(r.graduation_year || '').includes(q) ||
      status.includes(q)
    )
  })

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} mb={2}>
          <Typography variant="h5" fontWeight={700}>Alumni Verification</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              placeholder="Search name / course / year / status"
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ minWidth: 280 }}
            />
            <Tooltip title="Upload official alumni list from Registrar/Alumni Office (CSV)">
              <span>
                <Button
                  component="label"
                  size="small"
                  className="gradient-btn-pink"
                  disabled={loading || csvProcessing}
                >
                  {csvProcessing ? 'Processing CSV…' : 'Upload Official Alumni List'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    onChange={handleCsvUpload}
                  />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Reload">
              <IconButton onClick={load} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {csvMessage && !error && (
          <Alert severity="success" sx={{ mb: 2 }}>{csvMessage}</Alert>
        )}
        {loading && <LinearProgress sx={{ mb: 1 }} />}

        <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Course</TableCell>
                <TableCell>Year Graduated</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Verified At</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(r => {
                const name = `${r.last_name || ''}, ${r.first_name || ''}`.trim().replace(/^,|,$/g, '')
                const isVerified = !!r.is_verified
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>{name || '—'}</TableCell>
                    <TableCell>{r.course || '—'}</TableCell>
                    <TableCell>{r.graduation_year ?? '—'}</TableCell>
                    <TableCell>
                      {isVerified
                        ? <Chip size="small" color="success" label="Verified" />
                        : <Chip size="small" color="warning" label="Pending" />}
                    </TableCell>
                    <TableCell>{fmtDate(r.verified_at)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        className={isVerified ? 'gradient-btn-blue' : 'gradient-btn-pink'}
                        onClick={() => toggleVerify(r)}
                        disabled={savingId === r.id}
                      >
                        {isVerified ? 'Mark Pending' : 'Mark Verified'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}