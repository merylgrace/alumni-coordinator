import { useEffect, useMemo, useState } from 'react';
import { Typography, TextField, LinearProgress, Alert, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, InputAdornment, IconButton } from '@mui/material';
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { supabase } from '../supabaseClient';

// Table name constant (adjusted to actual table name)
// Table name constant (adjusted to actual table name)
const TABLE_NAME = 'user_profile_questions';

const coursesList = [
  'BSIT',
  'BSEd - English',
  'BSEd - Math',
  'BEEd',
  'BECEd',
  'BSBA - Financial Management',
  'BSBA - Marketing Management',
  'BSBA - Operations Management',
];

const currentYear = new Date().getFullYear();

type CreateUserFormState = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  graduationYear: number | '';
  course: string;
  phoneNumber: string;
};

type CreateUserFormErrors = Partial<Record<keyof CreateUserFormState, string>>;

export type UserProfileRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  region: string | null;
  province: string | null;
  skills: string | null;
  employment_status: string | null;
  employment_type: string | null;
  contract_type: string | null;
  job_related_course: boolean | null;
  received_award: boolean | null;
  award_details: string | null;
  created_at: string | null;
};

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
    cols.map((c) => {
      const raw = r[c.field as keyof typeof r];
      return escapeCsvCell(raw);
    }).join(',')
  );
  return '\uFEFF' + [headers, ...lines].join('\n');
}

const columns: GridColDef[] = [
  { field: 'first_name', headerName: 'First Name', width: 140 },
  { field: 'last_name', headerName: 'Last Name', width: 140 },
  { field: 'name', headerName: 'Full Name', width: 180 },
  { field: 'country', headerName: 'Country', width: 140 },
  { field: 'region', headerName: 'Region', width: 140 },
  { field: 'province', headerName: 'Province', width: 140 },
  { field: 'skills', headerName: 'Skills', width: 200 },
  { field: 'employment_status', headerName: 'Employment Status', width: 170 },
  { field: 'employment_type', headerName: 'Employment Type', width: 160 },
  { field: 'contract_type', headerName: 'Contract Type', width: 150 },
  {
    field: 'job_related_course',
    headerName: 'Job Related to Course',
    width: 180,
    valueFormatter: (params) => (params == null ? '' : params ? 'Yes' : 'No'),
  },
  {
    field: 'received_award',
    headerName: 'Received Award',
    width: 150,
    valueFormatter: (params) => (params == null ? '' : params ? 'Yes' : 'No'),
  },
  { field: 'award_details', headerName: 'Award Details', width: 220 },
  {
    field: 'created_at',
    headerName: 'Created At',
    width: 180,
    valueFormatter: (v) => (v ? new Date(v as string).toLocaleString() : ''),
  },
];

export default function UserProfileTable() {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ pageSize: 10, page: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create User Modal state
  const [openCreateUserModal, setOpenCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserFormState>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    graduationYear: currentYear,
    course: '',
    phoneNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [createUserErrors, setCreateUserErrors] = useState<CreateUserFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValidEmail = (e: string) => /\S+@\S+\.\S+/.test(e);

  const validateCreateUserForm = (): boolean => {
    const e: CreateUserFormErrors = {};
    if (!createUserForm.firstName) e.firstName = 'First name is required';
    if (!createUserForm.lastName) e.lastName = 'Last name is required';

    if (!createUserForm.email) e.email = 'Email is required';
    else if (!isValidEmail(createUserForm.email)) e.email = 'Invalid email address';

    if (!createUserForm.password) e.password = 'Password is required';
    else if (createUserForm.password.length < 6) e.password = 'Minimum 6 characters';

    if (!createUserForm.confirmPassword) e.confirmPassword = 'Please confirm password';
    else if (createUserForm.password !== createUserForm.confirmPassword) e.confirmPassword = 'Passwords do not match';

    if (!createUserForm.course) e.course = 'Course is required';

    if (createUserForm.graduationYear === '' || Number.isNaN(Number(createUserForm.graduationYear))) {
      e.graduationYear = 'Graduation year is required';
    } else if (Number(createUserForm.graduationYear) < 1980 || Number(createUserForm.graduationYear) > currentYear + 5) {
      e.graduationYear = `Year must be between 1980 and ${currentYear + 5}`;
    }

    setCreateUserErrors(e);
    return Object.keys(e).length === 0;
  };

  const onCreateUserChange = (name: keyof CreateUserFormState, value: any) => {
    setCreateUserForm((prev) => ({ ...prev, [name]: value }));
    if (createUserErrors[name]) setCreateUserErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const fullNameCreateUser = useMemo(
    () => [createUserForm.firstName, createUserForm.lastName].filter(Boolean).join(' '),
    [createUserForm.firstName, createUserForm.lastName]
  );

  const handleCreateUserSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    if (!validateCreateUserForm()) return;

    setSubmitting(true);
    try {
      // 1) Create the auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: createUserForm.email,
        password: createUserForm.password,
      });
      if (signUpError || !signUpData.user) {
        throw new Error(signUpError?.message || 'Failed to create auth user');
      }
      const newUser = signUpData.user;

      // 2) Insert/update the profile row
      const profile = {
        id: newUser.id,
        first_name: createUserForm.firstName,
        last_name: createUserForm.lastName,
        full_name: fullNameCreateUser || null,
        graduation_year: Number(createUserForm.graduationYear),
        course: createUserForm.course,
        phone_number: createUserForm.phoneNumber || null,
        role: 'alumni' as const,
        email: createUserForm.email.toLowerCase(),
      };

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profile, { onConflict: 'id' });

      if (upsertError) {
        if (/duplicate key/i.test(upsertError.message) || (upsertError as any)?.code === '23505') {
          setSuccessMsg(`User ${fullNameCreateUser || createUserForm.email} already exists. Profile kept/updated.`);
        } else {
          throw new Error(upsertError.message);
        }
      } else {
        setSuccessMsg(`User ${fullNameCreateUser || createUserForm.email} was created successfully.`);
      }

      setCreateUserForm({
        email: '', password: '', confirmPassword: '', firstName: '', lastName: '',
        graduationYear: currentYear, course: '', phoneNumber: '',
      });

      // Reload user profiles after creation
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      const msg = err?.message || 'Failed to create user';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseCreateUserModal = () => {
    setOpenCreateUserModal(false);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from(TABLE_NAME)
        // Select base columns plus related profile names via foreign key (assumes FK user_profile_questions.user_id -> profiles.id)
        .select('id,user_id,country,region,province,skills,employment_status,employment_type,contract_type,job_related_course,received_award,award_details,created_at,profiles(full_name,first_name,last_name)')
        .order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) {
        console.warn('Join select failed; will try two-step fetch. Error:', error.message);
        // Fallback path: fetch questions, then fetch profiles and merge
        const { data: base, error: e1 } = await supabase
          .from(TABLE_NAME)
          .select('id,user_id,country,region,province,skills,employment_status,employment_type,contract_type,job_related_course,received_award,award_details,created_at')
          .order('created_at', { ascending: false });
        if (e1) {
          console.error('Fallback base fetch error:', e1);
          setError(e1.message);
        } else {
          const userIds = Array.from(new Set((base ?? []).map((b: any) => b.user_id).filter(Boolean)));
          let profilesMap = new Map<string, { full_name: string | null; first_name: string | null; last_name: string | null }>();
          if (userIds.length > 0) {
            const { data: profs, error: e2 } = await supabase
              .from('profiles')
              .select('id, full_name, first_name, last_name')
              .in('id', userIds);
            if (e2) {
              console.error('Fallback profile fetch error:', e2);
              // don't hard fail; continue with empty names
            } else {
              (profs ?? []).forEach((p: any) => {
                profilesMap.set(p.id, { full_name: p.full_name ?? null, first_name: p.first_name ?? null, last_name: p.last_name ?? null });
              });
            }
          }
          const normalized: UserProfileRow[] = (base ?? []).map((r: any) => {
            const prof = profilesMap.get(r.user_id) || { full_name: null, first_name: null, last_name: null };
            const first_name = prof.first_name;
            const last_name = prof.last_name;
            const full_name = prof.full_name || [first_name, last_name].filter(Boolean).join(' ') || null;
            return { ...r, first_name, last_name, name: full_name } as UserProfileRow;
          });
          setRows(normalized);
        }
      } else {
        const rowsFetched = (data ?? []) as any[];
        console.info('UserProfileTable rows fetched (join):', rowsFetched.length);
        const normalized: UserProfileRow[] = rowsFetched.map((r) => {
          const profile = (r as any).profiles || {};
          const first_name: string | null = profile.first_name ?? null;
          const last_name: string | null = profile.last_name ?? null;
          const full_name: string | null = profile.full_name || [first_name, last_name].filter(Boolean).join(' ') || null;
          return {
            ...r,
            first_name,
            last_name,
            name: full_name,
          } as UserProfileRow;
        });
        setRows(normalized);
      }
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rows.filter((r) =>
      [
  r.first_name,
  r.last_name,
  r.name,
        r.country,
        r.region,
        r.province,
        r.skills,
        r.employment_status,
        r.employment_type,
        r.contract_type,
        r.job_related_course != null ? (r.job_related_course ? 'yes' : 'no') : '',
        r.received_award != null ? (r.received_award ? 'yes' : 'no') : '',
        r.award_details,
        r.created_at,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  const handleExportCsv = () => {
    const csv = buildCsv(filteredRows, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `user-profile-data-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ flexShrink: 0, pb: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
          User Profile Data
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={0}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button variant="contained" color="success" startIcon={<PersonAddAlt1Icon />} onClick={() => setOpenCreateUserModal(true)}>
            Create User
          </Button>
          <Button variant="contained" color="primary" startIcon={<FileDownloadIcon />} onClick={handleExportCsv}>
            download CSV
          </Button>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2, minHeight: 0 }}>
        <div style={{ width: '100%', height: '100%' }}>
          {loading && <LinearProgress />}
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          {!loading && !error && filteredRows.length === 0 && (
            <Alert severity="info" sx={{ mb: 1 }}>
              No rows to display. If you expect data, check Row Level Security (RLS) policies for
              the table <strong>{TABLE_NAME}</strong>. The current user may not be permitted to read
              other users' rows.
            </Alert>
          )}
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(r) => (r as UserProfileRow).id ?? (r as any).user_id}
            pagination
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[5, 10, 25, 50]}
          />
        </div>
      </Box>

      {/* Create User Modal */}
      <Dialog open={openCreateUserModal} onClose={handleCloseCreateUserModal} maxWidth="sm" fullWidth>
          <DialogTitle>Create User Account</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>
                {errorMsg}
              </Alert>
            )}
            {successMsg && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {successMsg}
              </Alert>
            )}
            <Box component="form" noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="First Name"
                value={createUserForm.firstName}
                onChange={(e) => onCreateUserChange('firstName', e.target.value)}
                error={Boolean(createUserErrors.firstName)}
                helperText={createUserErrors.firstName}
                required
                size="small"
              />
              <TextField
                fullWidth
                label="Last Name"
                value={createUserForm.lastName}
                onChange={(e) => onCreateUserChange('lastName', e.target.value)}
                error={Boolean(createUserErrors.lastName)}
                helperText={createUserErrors.lastName}
                required
                size="small"
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={createUserForm.email}
                onChange={(e) => onCreateUserChange('email', e.target.value)}
                error={Boolean(createUserErrors.email)}
                helperText={createUserErrors.email}
                required
                size="small"
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={createUserForm.password}
                onChange={(e) => onCreateUserChange('password', e.target.value)}
                error={Boolean(createUserErrors.password)}
                helperText={createUserErrors.password}
                required
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                value={createUserForm.confirmPassword}
                onChange={(e) => onCreateUserChange('confirmPassword', e.target.value)}
                error={Boolean(createUserErrors.confirmPassword)}
                helperText={createUserErrors.confirmPassword}
                required
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowConfirm((s) => !s)} edge="end" size="small">
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <FormControl fullWidth size="small" error={Boolean(createUserErrors.course)}>
                <InputLabel id="course-label">Course/Program</InputLabel>
                <Select
                  labelId="course-label"
                  label="Course/Program"
                  value={createUserForm.course}
                  onChange={(e) => onCreateUserChange('course', e.target.value)}
                  required
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {coursesList.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
                {createUserErrors.course && <FormHelperText>{createUserErrors.course}</FormHelperText>}
              </FormControl>
              <TextField
                fullWidth
                label="Year Graduated"
                type="number"
                value={createUserForm.graduationYear}
                onChange={(e) => onCreateUserChange('graduationYear', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                inputProps={{ min: 1980, max: currentYear + 5 }}
                error={Boolean(createUserErrors.graduationYear)}
                helperText={createUserErrors.graduationYear as any}
                required
                size="small"
              />
              <TextField
                fullWidth
                label="Phone Number (optional)"
                value={createUserForm.phoneNumber}
                onChange={(e) => onCreateUserChange('phoneNumber', e.target.value)}
                size="small"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateUserModal} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreateUserSubmit} variant="contained" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
}
