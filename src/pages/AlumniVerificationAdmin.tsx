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
            <Tooltip title="Reload">
              <IconButton onClick={load} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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