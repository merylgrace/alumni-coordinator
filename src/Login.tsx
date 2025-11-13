import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router-dom';
import { saveToken } from './auth';
import { supabase } from './supabaseClient';
import { signInWithPasswordLog } from './activityLog';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // 1) Sign in with logging
    const res = await signInWithPasswordLog(supabase, { email, password });
    const data = res.data;
    if (res.error || !data?.session || !data?.user) {
      setError('Invalid credentials');
      return;
    }

    // 2) Check admin role in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      await supabase.auth.signOut();
      setError('Account is not an admin');
      return;
    }

  // 3) Persist token using your existing helper for route guards
    saveToken(data.session.access_token, rememberMe);
    navigate('/home/dashboard');
  };

  const toggleShowPassword = () => setShowPassword((s) => !s);
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={3} alignItems="center">
          <Box sx={{ width: '100%', textAlign: 'center', mb: 1 }}>
            <img 
              src="https://alumnitracers.vercel.app/logo.jpeg" 
              alt="Alumni Tracer Logo" 
              style={{ maxWidth: '120px', height: 'auto', borderRadius: '8px' }}
            />
          </Box>

          <Box textAlign="center">
            <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to access the Alumni Coordinator Dashboard
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleLogin} sx={{ width: '100%' }} autoComplete="off">
            {/* Hidden dummy fields to suppress browser autofill */}
            <input type="text" name="fakeusernameremembered" style={{ display: 'none' }} />
            <input type="password" name="fakepasswordremembered" style={{ display: 'none' }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Email Address
            </Typography>
            <TextField
              placeholder="Enter your email"
              type="email"
              name="user_email"
              autoComplete="off"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Password
            </Typography>
            <TextField
              placeholder="Enter your password"
              type={showPassword ? 'text' : 'password'}
              name="user_pass"
              autoComplete="new-password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={toggleShowPassword} edge="end" aria-label="toggle password visibility">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <FormControlLabel
              control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
              label="Remember me"
            />

            <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 1.5, py: 1.5 }}>
              Sign In
            </Button>

            {error && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}

            <Stack direction="column" alignItems="center" spacing={1} sx={{ mt: 2 }}>
              <MuiLink component="button" variant="body2" onClick={() => { /* TODO: forgot password */ }}>
                Forgot your password?
              </MuiLink>

              <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                For Alumni Coordinator use only
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default Login;
