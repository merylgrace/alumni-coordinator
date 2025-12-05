import { useState, useMemo, useEffect } from 'react';
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import { Card, CardContent, Typography, TextField, LinearProgress, Alert, Button, Stack } from '@mui/material';
import AdminVerifyToggle from '../components/AdminVerifyToggle';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { supabase } from '../supabaseClient';
type Profile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_verified?: boolean | null;
  graduation_year: number | null;
  course: string | null;
  current_job: string | null;
  company: string | null;
  location: string | null;
  phone_number: string | null;
  role: 'alumni' | 'admin';
  created_at: string;
};

type Row = Profile & { display_full_name: string };

// CSV helpers
function escapeCsvCell(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  const needsQuotes = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function buildCsv<RowT>(rows: RowT[], cols: GridColDef[]): string {
  const headers = cols.map((c) => c.headerName ?? c.field).join(',');
  const lines = (rows as any[]).map((r) =>
    cols.map((c) => escapeCsvCell(r[c.field as keyof typeof r])).join(',')
  );
  // Add UTF-8 BOM for Excel compatibility
  return '\uFEFF' + [headers, ...lines].join('\n');
}

const columns: GridColDef[] = [
  // ID column removed from visible table
  { field: 'display_full_name', headerName: 'Full Name', width: 180 },
  { field: 'course', headerName: 'Course', width: 140 },
  {
    field: 'graduation_year',
    headerName: 'Year Graduated',
    width: 110,
    type: 'number',
    valueFormatter: (value: number | null | undefined) => (value == null ? '' : String(value)),
  },
  { field: 'current_job', headerName: 'Current Job', width: 160 },
  { field: 'company', headerName: 'Company', width: 160 },
  { field: 'location', headerName: 'Location', width: 160 },
  { field: 'phone_number', headerName: 'Phone', width: 140 },
  {
    field: 'is_verified',
    headerName: 'Verified',
    width: 140,
    renderCell: (p) => (
      <AdminVerifyToggle
        userId={(p.row as any).id}
        isVerified={Boolean((p.row as any).is_verified)}
        onChange={(next) => {
          p.api.updateRows([{ id: (p.row as any).id, is_verified: next }])
        }}
      />
    ),
    sortable: false,
    filterable: false,
  },
  { field: 'role', headerName: 'Role', width: 110 },
  { field: 'created_at', headerName: 'Created At', width: 180 },
];

const DataTables = () => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    pageSize: 5,
    page: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from('profiles')
  .select('id, full_name, first_name, last_name, is_verified, graduation_year, course, current_job, company, location, phone_number, role, created_at')
        .order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) setError(error.message);
      else {
        const mapped: Row[] = (data ?? []).map((p: any) => ({
          ...(p as Profile),
          display_full_name:
            (p.full_name && String(p.full_name).trim()) ||
            [p.first_name, p.last_name].filter(Boolean).join(' '),
        }));
        setRows(mapped);
      }
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rows.filter((row) =>
      [
        // row.id removed from search keys
        row.full_name,
        row.first_name,
        row.last_name,
        row.course,
        row.current_job,
        row.company,
        row.location,
        row.phone_number,
        row.role,
        row.graduation_year?.toString(),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  // Single-button export: export current filtered view
  const handleExportCsv = () => {
    const rowsToExport = filteredRows;
    const csv = buildCsv(rowsToExport, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `alumni-data-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} mb={2}>
          <Typography variant="h5" fontWeight={700}>User Records</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              color="primary"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCsv}
            >
              download alumni data (CSV)
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={2}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Stack>

        <div style={{ height: 500, width: '100%' }}>
          {loading && <LinearProgress />}
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(r) => r.id}
            pagination
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[5, 10]}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DataTables;
