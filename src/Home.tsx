import * as React from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { styled, useTheme } from '@mui/material/styles';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import { Box, Drawer, CssBaseline, Toolbar, List, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar, Stack } from '@mui/material';
import { Menu as MenuIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { clearToken } from './auth';
import { supabase } from './supabaseClient';
import { signOutWithLog } from './activityLog';
import { DashboardCustomizeOutlined, Logout, TableChart } from '@mui/icons-material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SchoolIcon from '@mui/icons-material/School';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CampaignIcon from '@mui/icons-material/Campaign';
import Dashboard from './pages/Dashboard';
import DataTables from './pages/DataTables';
import UserProfileTable from './pages/UserProfileTable';
import Reports from './pages/Reports';
import AlumniVerificationAdmin from './pages/AlumniVerificationAdmin';
import AnnouncementsAdmin from './pages/AnnouncementsAdmin';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{ open?: boolean }>(({ theme, open }) => ({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
  boxSizing: 'border-box',
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: open ? 0 : `-${drawerWidth}px`,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, { shouldForwardProp: (prop) => prop !== 'open' })<AppBarProps>(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  width: open ? `calc(100% - ${drawerWidth}px)` : '100%',
  marginLeft: open ? `${drawerWidth}px` : 0,
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

export default function HomeLayout() {
  const theme = useTheme();
  const [open, setOpen] = React.useState(true); // Set to true to open the drawer by default
  const navigate = useNavigate();

  const handleDrawerOpen = () => setOpen(true);
  const handleDrawerClose = () => setOpen(false);

  const handleLogout = async () => {
    // Log and sign out from Supabase, then clear any local token and redirect
    await signOutWithLog(supabase);
    clearToken();
    navigate('/login', { replace: true });
  };

  const drawerItems = [
    { text: 'Dashboard', path: '/home/dashboard', icon: <DashboardCustomizeOutlined/> },
    { text: 'Reports', path: '/home/reports', icon: <AssessmentIcon /> },
    { text: 'Data Tables', path: '/home/datatables', icon: <TableChart /> },
    { text: 'User Profiles', path: '/home/user-profile-table', icon: <PeopleAltIcon /> },
    { text: 'Alumni Verification', path: '/home/alumni-verification', icon: <SchoolIcon /> },
    { text: 'Announcement Panel', path: '/home/admin/announcements', icon: <CampaignIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton color="inherit" onClick={handleDrawerOpen} edge="start" sx={{ mr: 2, ...(open && { display: 'none' }) }}>
            <MenuIcon />
          </IconButton>

          {/* Logout Button */}
          <IconButton color="inherit" onClick={handleLogout} sx={{ ml: 'auto' }}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </DrawerHeader>
        <Stack 
            direction="column" 
            spacing={2} 
            sx={{ 
              justifyContent: 'center', 
              alignItems: 'center', 
              width: '100%', 
            }}
          >
            <Avatar 
              alt="Remy Sharp" 
              src="/static/images/avatar/5.jpg" 
              sx={{ 
                width: 100, 
                height: 100, 
              }} 
            />
            <h3>Hello User!</h3>
          </Stack>
        <Divider />
        <List>
          {drawerItems.map(({ text, path, icon }) => (
            <ListItem key={text} disablePadding>
              <ListItemButton component={Link} to={path}>
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText primary={text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider />
        {/* Separate Logout item */}
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon><Logout /></ListItemIcon> {/* You can use a different icon for logout if you prefer */}
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </List>
        <Divider />
      </Drawer>
      <Main open={open}>
        <DrawerHeader />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/datatables" element={<DataTables />} />
          <Route path="/user-profile-table" element={<UserProfileTable />} />
          <Route path="/alumni-verification" element={<AlumniVerificationAdmin />} />
          <Route path="/admin/announcements" element={<AnnouncementsAdmin />} />
          <Route path="/" element={<Navigate to="/home/dashboard" replace />} />
        </Routes>
      </Main>
    </Box>
  );
}