import * as React from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { styled, useTheme } from '@mui/material/styles';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import { Box, Drawer, CssBaseline, Toolbar, List, Typography, Divider, IconButton, Menu, MenuItem, ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar, Stack } from '@mui/material';
import { Menu as MenuIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, AccountCircle } from '@mui/icons-material';
import { clearToken } from './auth';
import { supabase } from './supabaseClient';
import { signOutWithLog } from './activityLog';
import { DashboardCustomizeOutlined, Logout, TableChart } from '@mui/icons-material';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import Dashboard from './pages/Dashboard';
import DataTables from './pages/DataTables';
import UserProfileTable from './pages/UserProfileTable';
import SchoolIcon from '@mui/icons-material/School';
import CampaignIcon from '@mui/icons-material/Campaign';
import AlumniVerificationAdmin from './pages/AlumniVerificationAdmin';
import AnnouncementsAdmin from './pages/AnnouncementsAdmin';


const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{ open?: boolean }>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: open ? 0 : `-${drawerWidth}px`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
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
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null); // State for the menu anchor
  const navigate = useNavigate();

  const handleDrawerOpen = () => setOpen(true);
  const handleDrawerClose = () => setOpen(false);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget); // Open the menu
  };

  const handleMenuClose = () => {
    setAnchorEl(null); // Close the menu
  };

  const handleProfile = () => {
    // Navigate to profile page or handle profile action
    console.log('Go to Profile');
    handleMenuClose();
  };

  const handleSettings = () => {
    // Navigate to settings page or handle settings action
    console.log('Go to Settings');
    handleMenuClose();
  };

  const handleLogout = async () => {
    // Log and sign out from Supabase, then clear any local token and redirect
    await signOutWithLog(supabase);
    clearToken();
    navigate('/login', { replace: true });
    handleMenuClose();
  };

  const drawerItems = [
    { text: 'Dashboard', path: '/home/dashboard', icon: <DashboardCustomizeOutlined/> },
    { text: 'Data Tables', path: '/home/datatables', icon: <TableChart /> },
  { text: 'User Profiles', path: '/home/user-profile-table', icon: <PeopleAltIcon /> },
    // { text: 'Create User', path: '/home/create-user', icon: <PersonAddAlt1Icon /> },
    // { text: 'Activity Logs', path: '/home/activity-logs', icon: <HistoryIcon /> },
    { text: 'Alumni Verification', path: '/home/alumni-verification', icon: <SchoolIcon /> },
    // { text: 'Announcements', path: '/home/announcements', icon: <HistoryIcon /> },
    { text: 'Announcement Panel', path: '/home/admin/announcements', icon: <CampaignIcon /> },
    // { text: 'Deletion Requests', path: '/home/deletion-requests', icon: <HistoryIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton color="inherit" onClick={handleDrawerOpen} edge="start" sx={{ mr: 2, ...(open && { display: 'none' }) }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap>Dashboard</Typography>

          {/* Profile Icon Button on AppBar */}
          <IconButton color="inherit" onClick={handleMenuClick} sx={{ ml: 'auto' }}>
            <AccountCircle /> {/* Profile icon */}
          </IconButton>

          {/* Menu for Profile, Settings, and Logout */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleProfile}>Profile</MenuItem>
            <MenuItem onClick={handleSettings}>Settings</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
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
