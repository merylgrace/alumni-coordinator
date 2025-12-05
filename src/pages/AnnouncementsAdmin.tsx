import React from 'react'
import {
  Card, CardContent, Typography, Stack, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, LinearProgress, Alert, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Switch
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { supabase } from '../supabaseClient'

// Announcement shape
export type Ann = {
  id: string
  title: string
  body: string
  audience: string
  published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  image_url?: string | null
  post_url?: string | null
}

function fmt(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return d || '—' }
}

export default function AnnouncementsAdmin() {
  const [rows, setRows] = React.useState<Ann[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Ann | null>(null)
  const [form, setForm] = React.useState({ title: '', body: '', audience: 'all', published: false, image_url: '', post_url: '' })
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', body: '', audience: 'all', published: false, image_url: '', post_url: '' })
    setDlgOpen(true)
  }
  const openEdit = (row: Ann) => {
    setEditing(row)
    setForm({ title: row.title, body: row.body, audience: row.audience, published: row.published, image_url: row.image_url || '', post_url: row.post_url || '' })
    setDlgOpen(true)
  }

  const load = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,body,audience,published,published_at,created_at,updated_at,image_url,post_url')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setRows((data ?? []) as Ann[])
    } catch (e: any) {
      setError(e.message || 'Failed to load announcements')
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  const onPickFile = () => fileInputRef.current?.click()
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id || 'anon'
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^\w.\-]/g, '')
      const path = `${uid}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('announcements').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('announcements').getPublicUrl(path)
      setForm(s => ({ ...s, image_url: pub.publicUrl }))
    } catch (e: any) {
      setError(e.message || 'Image upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  const clearImage = () => setForm(s => ({ ...s, image_url: '' }))

  const save = async () => {
    setLoading(true); setError(null)
    try {
      const maybeUrl = form.post_url?.trim()
      if (maybeUrl && !/^https?:\/\//i.test(maybeUrl)) {
        setError('Please enter a valid URL starting with http:// or https://')
        setLoading(false)
        return
      }
      const uid = (await supabase.auth.getUser()).data.user?.id || null
      const payload: any = {
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience || 'all',
        published: !!form.published,
        published_at: form.published ? new Date().toISOString() : null,
        created_by: uid,
        image_url: form.image_url || null,
        post_url: form.post_url?.trim() ? form.post_url.trim() : null,
      }
      if (editing) {
        const next = { ...payload }
        if (editing.published && form.published && editing.published_at) next.published_at = editing.published_at
        const { error } = await supabase.from('announcements').update(next).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('announcements').insert(payload)
        if (error) throw error
      }
      setDlgOpen(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to save announcement')
    } finally { setLoading(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    setLoading(true); setError(null)
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to delete')
    } finally { setLoading(false) }
  }

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q) || r.audience.toLowerCase().includes(q)
  })

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" fontWeight={700}>Announcement Panel</Typography>
          <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="primary" onClick={load} startIcon={<RefreshIcon />} disabled={loading}>Reload</Button>
              <Button onClick={openCreate} variant="contained" color="primary" startIcon={<AddIcon />}>New</Button>
            </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={2}>
          <TextField
            fullWidth size="small" placeholder="Search title/body/audience…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading && <LinearProgress sx={{ mb: 1 }} />}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Audience</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Published</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Image</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{r.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.body.slice(0, 120)}{r.body.length > 120 ? '…' : ''}</Typography>
                    {r.post_url && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                        <a href={r.post_url} target="_blank" rel="noopener noreferrer">View post ↗</a>
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{r.audience}</TableCell>
                  <TableCell>
                    {r.published ? <Chip size="small" color="success" label="Published" /> : <Chip size="small" color="warning" label="Draft" />}
                  </TableCell>
                  <TableCell>{fmt(r.published_at)}</TableCell>
                  <TableCell>{fmt(r.updated_at)}</TableCell>
                  <TableCell>
                    {r.image_url ? (
                      <img src={r.image_url} alt="" style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    ) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => del(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>{loading ? 'Loading…' : 'No announcements'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{editing ? 'Edit announcement' : 'New announcement'}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField label="Title" value={form.title} onChange={e => setForm(s => ({ ...s, title: e.target.value }))} fullWidth />
              <TextField label="Body" value={form.body} onChange={e => setForm(s => ({ ...s, body: e.target.value }))} fullWidth multiline minRows={4} />
              <TextField label="Audience" value={form.audience} onChange={e => setForm(s => ({ ...s, audience: e.target.value }))} fullWidth />
              <TextField
                label="External Post URL (optional)"
                value={form.post_url}
                onChange={e => setForm(s => ({ ...s, post_url: e.target.value }))}
                fullWidth
                placeholder="https://example.com/post/123"
                type="url"
              />

              <Stack direction="row" alignItems="center" spacing={1}>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileChange} />
                <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={onPickFile} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload Image'}
                </Button>
                {form.image_url && (
                  <>
                    <img src={form.image_url} alt="" style={{ width: 96, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                    <Button color="error" onClick={clearImage}>Remove</Button>
                  </>
                )}
              </Stack>

              <Stack direction="row" alignItems="center" spacing={1}>
                <Switch checked={form.published} onChange={e => setForm(s => ({ ...s, published: e.target.checked }))} />
                <Typography>Published</Typography>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={save} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  )
}