import React, { useEffect, useRef, useState } from 'react';
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  useTheme, 
  IconButton, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  SelectChangeEvent,
  LinearProgress,
  Button,
  Box
} from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import './Dashboard.css';
import './Reports.css';
import { supabase } from '../supabaseClient';
// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom colored icons for different colleges
const collegeIcons: Record<string, L.Icon> = {
  IBM: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  ICS: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  ITE: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  Other: new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
};

// Types
interface AlumniData {
  stats: {
    employed: number;
    unemployed: number;
    newAlumni: number;
    totalAlumni: number;
  };
  // Daily profile update activity for the past ~30 days
  activity: Array<{
    date: string; // YYYY-MM-DD
    updates: number;
  }>;
  locations: Array<{
    id: string;
    name: string;
    position: [number, number];
    college: 'IBM' | 'ICS' | 'ITE' | 'Other';
    status: 'active' | 'inactive' | 'new';
  }>;
}

interface StatCardProps {
  title: string;
  value: number | string;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  className?: string;
  icon?: React.ReactNode;
}

// Reset View Component
function ResetViewControl({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  const handleClick = () => {
    map.setView(center, zoom);
    map.closePopup();
  };

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <IconButton 
          onClick={handleClick}
          size="small"
          sx={{
            backgroundColor: 'white',
            '&:hover': { backgroundColor: 'white' },
            padding: '4px',
            margin: '2px'
          }}
        >
          <GpsFixedIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
}

// Stat Card Component
const StatCard = ({ title, value, color, className, icon }: StatCardProps) => {
  const theme = useTheme();

  if (className) {
    return (
      <Card className={className}>
        <CardContent>
          <Box className="report-card-content">
            {/** optional icon on left */}
            {icon ? <Box className="report-card-icon">{icon}</Box> : null}
            <Box className="report-card-stats">
              <Typography className="report-card-value">{value}</Typography>
              <Typography className="report-card-label">{title}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        minHeight: 120,
        backgroundColor: color ? theme.palette[color].main : undefined,
        color: color ? theme.palette[color].contrastText : undefined,
        boxShadow: 3,
      }}
    >
      <CardContent>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="h5" fontWeight="bold">{value}</Typography>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const [alumniData, setAlumniData] = useState<AlumniData | null>(null);
  const [collegeFilter, setCollegeFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mapCenter: [number, number] = [12.988438,121.785126];
  const initialZoom = 5;
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const downloadEmploymentRatePerBatch = async () => {
    try {
      // First get all alumni with their graduation years and IDs
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, graduation_year, role')
        .eq('role', 'alumni');

      if (profilesError) throw profilesError;

      // Then get employment records for those alumni using profile IDs
      const profileIds = profilesData?.map((p) => p.id).filter(Boolean) || [];
      if (profileIds.length === 0) {
        alert('No alumni found');
        return;
      }

      const { data: employmentData, error: employmentError } = await supabase
        .from('user_profile_questions')
        .select('user_id, employment_status')
        .in('user_id', profileIds);

      if (employmentError) throw employmentError;

      // Create a map of profile ID (user_id) to employment status
      const employmentMap: { [key: string]: string } = {};
      employmentData?.forEach((record) => {
        if (record.user_id && record.employment_status) {
          employmentMap[record.user_id] = record.employment_status.toLowerCase();
        }
      });

      // Helper function to determine if employed
      const isEmployed = (statusStr: string): boolean => {
        if (!statusStr) return false;
        const s = statusStr.toLowerCase().trim();
        if (/^(self[-\s]?employed|employed)$/.test(s)) return true;
        if (/(^|\b)(freelance|entrepreneur|business owner|working|full[-\s]?time|part[-\s]?time)(\b|$)/.test(s) && !/unemployed|not\s*employed|jobless|none/.test(s)) return true;
        return false;
      };

      const isUnemployed = (statusStr: string): boolean => {
        if (!statusStr) return false;
        const s = statusStr.toLowerCase().trim();
        return /unemployed|not\s*employed|jobless|none/.test(s);
      };

      // Group by graduation year and calculate employment stats
      const batchStats: { [year: string]: { employed: number; unemployed: number; total: number } } = {};

      profilesData?.forEach((profile) => {
        if (!profile.graduation_year) return;
        const year = profile.graduation_year.toString();

        if (!batchStats[year]) {
          batchStats[year] = { employed: 0, unemployed: 0, total: 0 };
        }

        batchStats[year].total += 1;

        const employmentStatus = employmentMap[profile.id];
        if (employmentStatus && isEmployed(employmentStatus)) {
          batchStats[year].employed += 1;
        } else if (employmentStatus && isUnemployed(employmentStatus)) {
          batchStats[year].unemployed += 1;
        }
      });

      // Convert to CSV format
      const rows = [
        ['Batch (Graduation Year)', 'Total Alumni', 'Employed', 'Unemployed', 'Employment Rate (%)'],
        ...Object.entries(batchStats)
          .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
          .map(([year, stats]) => {
            const employmentRate = stats.total > 0 ? ((stats.employed / stats.total) * 100).toFixed(2) : '0.00';
            return [year, stats.total, stats.employed, stats.unemployed, employmentRate];
          }),
      ];

      const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `employment_rate_per_batch_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading employment rate report:', error);
      alert('Error downloading report. Check console for details.');
    }
  };

  useEffect(() => {

    const loadViaProfiles = async () => {
      // Load alumni profiles then compute stats locally (robust to varying column names)

      // Build activity series from activity_logs (profile_update daily counts, last 30 days)
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: acts, error: actErr } = await supabase
        .from('activity_logs')
        .select('id, created_at, action')
        .eq('action', 'profile_update')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })
        .limit(5000);
      if (actErr) {
        // non-fatal; just show empty series
        console.warn('activity series load failed:', actErr);
      }
      const byDay = new Map<string, number>();
      (acts || []).forEach((r: any) => {
        const day = new Date(r.created_at).toISOString().slice(0,10);
        byDay.set(day, (byDay.get(day) || 0) + 1);
      });
      // Ensure chronological array; optionally include days with zero
      const activity: AlumniData['activity'] = [];
      for (let i = 0; i <= 30; i++) {
        const d = new Date(since.getTime());
        d.setDate(since.getDate() + i);
        const day = d.toISOString().slice(0,10);
        activity.push({ date: day, updates: byDay.get(day) || 0 });
      }

      // Fetch profiles with broad selection to support varied schemas
      let lq = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'alumni')
        .order('id', { ascending: false })
        .limit(5000);
      if (collegeFilter !== 'all') lq = lq.eq('college', collegeFilter);
      const { data: rows, error: locErr } = await lq;
      if (locErr) throw locErr;
      let rowsData: any[] = rows || [];
      // Fallback: if role filter returned 0, try without role constraint (older rows may miss role)
      if (rowsData.length === 0) {
        try {
          const { data: allProf, error: allErr } = await supabase
            .from('profiles')
            .select('*')
            .order('id', { ascending: false })
            .limit(5000);
          if (!allErr && allProf) rowsData = allProf as any[];
        } catch {}
      }

      // Fetch employment_status from user_profile_questions (if available)
      const profileIds: string[] = (rowsData || []).map((r: any) => r.id).filter(Boolean);
      const statusMap = new Map<string, string>();
      if (profileIds.length > 0) {
        try {
          const { data: esRows, error: esErr } = await supabase
            .from('user_profile_questions')
            .select('user_id, employment_status')
            .in('user_id', profileIds);
          if (!esErr && esRows) {
            (esRows as any[]).forEach((r) => {
              if (r.user_id && r.employment_status) {
                statusMap.set(String(r.user_id), String(r.employment_status));
              }
            });
          }
        } catch (e) {
          console.warn('Employment status fetch error:', e);
        }
      }

      // Derive employment counts
  let employed = 0; let unemployed = 0;
      const isYes = (v: any) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'yes';
      const isNo = (v: any) => v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false' || String(v).toLowerCase() === 'no';

      const getEmploymentStatus = (r: any): 'employed' | 'unemployed' | null => {
        // Prefer explicit user_profile_questions.employment_status if present
        const mapVal = statusMap.get(String(r.id));
        if (mapVal) {
          const s = mapVal.toLowerCase().trim();
          if (/^(self[-\s]?employed|employed)$/.test(s)) return 'employed';
          if (/(^|\b)(freelance|entrepreneur|business owner|working|full[-\s]?time|part[-\s]?time)(\b|$)/.test(s) && !/unemployed|not\s*employed|jobless|none/.test(s)) return 'employed';
          if (/unemployed|not\s*employed|jobless|none/.test(s)) return 'unemployed';
        }
        // boolean-like flags
        if (r.is_employed !== undefined) return isYes(r.is_employed) ? 'employed' : isNo(r.is_employed) ? 'unemployed' : null;
        if (r.employed !== undefined) return isYes(r.employed) ? 'employed' : isNo(r.employed) ? 'unemployed' : null;

        // string status fields
        const keys = ['employment_status','employmentStatus','employment','job_status','work_status','status_of_employment'];
        for (const k of keys) {
          if (r[k] != null) {
            const s = String(r[k]).toLowerCase();
            if (/(^|\b)self[-\s]?employed(\b|$)/.test(s)) return 'employed';
            if (/employed/.test(s) && !/unemployed|not\s*employed|jobless|none/.test(s)) return 'employed';
            if (/unemployed|not\s*employed|jobless|none/.test(s)) return 'unemployed';
          }
        }
        return null;
      };

      (rowsData || []).forEach((r: any) => {
        const st = getEmploymentStatus(r);
        if (st === 'employed') employed += 1; else if (st === 'unemployed') unemployed += 1;
      });

      // Total and New alumni (within last 30 days or status 'new')
      const totalAlumni = (rowsData || []).length;
      // Daily new alumni (registrations today)
      const todayISO = new Date().toISOString().slice(0,10); // UTC date portion
      let newAlumni = 0;
      (rowsData || []).forEach((r: any) => {
        if (!r.created_at) return;
        const dStr = String(r.created_at).slice(0,10);
        if (dStr === todayISO) newAlumni += 1;
      });

      // If still zero due to missing join/role mismatches, try counting straight from user_profile_questions table
      if (employed === 0 && unemployed === 0) {
        try {
          const { data: aggRows } = await supabase
            .from('user_profile_questions')
            .select('employment_status');
          let e = 0, u = 0;
          (aggRows || []).forEach((r: any) => {
            const s = String(r.employment_status || '').toLowerCase();
            if (!s) return;
            if (/(^|\b)self[-\s]?employed(\b|$)/.test(s)) e += 1;
            else if (/unemployed|not\s*employed|jobless|none/.test(s)) u += 1;
            else if (/employed/.test(s)) e += 1;
          });
          employed = e; unemployed = u;
        } catch {}
      }

      const stats = { employed, unemployed, newAlumni, totalAlumni };

      // Helper: pick display name
      const getName = (r: any) => r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
      // Helper: determine best text location to geocode
      const getTextKey = (r: any) => {
        const candidates = [r.location, r.address, r.city, r.municipality, r.province, r.region];
        const v = candidates.find((x) => x && String(x).trim() && !/^n\/?a$/i.test(String(x)) && !/^(n\/a|na|none|null|unknown)$/i.test(String(x)));
        return v ? String(v).trim() : '';
      };

      const cacheKey = 'alumni-geocode-cache-v1';
      const cacheRaw = localStorage.getItem(cacheKey);
      const cache: Record<string, { lat: number; lon: number }> = cacheRaw ? JSON.parse(cacheRaw) : {};

      // Build initial markers from existing lat/lng or cache (instant display)
  const initialMarkers: AlumniData['locations'] = [];
      const toGeocode: Array<{ key: string; row: any }> = [];
  (rowsData || []).forEach((r: any) => {
        const college = ['IBM','ICS','ITE'].includes((r.college || '').toUpperCase()) ? (r.college as string) : 'Other';
        const status = (r.status as any) || 'active';
        const name = getName(r);

        const lat = r.lat ?? r.latitude ?? null;
        const lng = r.lng ?? r.longitude ?? null;
        if (typeof lat === 'number' && typeof lng === 'number') {
          initialMarkers.push({ id: String(r.id), name, position: [lat, lng], college: college as any, status });
          return;
        }

        const key = getTextKey(r);
        if (!key) return;
        const k = key.toLowerCase();
        if (cache[k]) {
          initialMarkers.push({ id: String(r.id), name, position: [cache[k].lat, cache[k].lon], college: college as any, status });
        } else {
          toGeocode.push({ key, row: r });
        }
      });

  setAlumniData({ stats, activity, locations: initialMarkers });

      // Geocode remaining entries in the background, then update cache and markers
      const geocodeOne = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=ph&q=${encodeURIComponent(q)}`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const j = await resp.json();
        if (Array.isArray(j) && j[0]) return { lat: Number(j[0].lat), lon: Number(j[0].lon) };
        return null;
      };

      const newlyAdded: AlumniData['locations'] = [];
      for (const item of toGeocode) {
        try {
          const res = await geocodeOne(`${item.key}, Philippines`);
          const k = item.key.toLowerCase();
          if (res) {
            cache[k] = { lat: res.lat, lon: res.lon };
            localStorage.setItem(cacheKey, JSON.stringify(cache));
            const college = ['IBM','ICS','ITE'].includes((item.row.college || '').toUpperCase()) ? (item.row.college as string) : 'Other';
            const status = (item.row.status as any) || 'active';
            newlyAdded.push({ id: String(item.row.id), name: getName(item.row), position: [res.lat, res.lon], college: college as any, status });
          }
        } catch (e) {
          // ignore errors; continue
        }
        await new Promise(r => setTimeout(r, 350));
      }

      if (newlyAdded.length > 0) {
        setAlumniData(prev => prev ? { ...prev, locations: [...prev.locations, ...newlyAdded] } : { stats, activity, locations: newlyAdded });
      }
    };

    const loadDashboard = async () => {
      // Skip RPC entirely (server-side function references deleted table).
      // Always load dashboard data from profiles to avoid server errors.
      setLoading(true);
      setLoadError(null);
      try {
        await loadViaProfiles();
      } catch (e: any) {
        console.error('Failed to load dashboard via profiles:', e);
        setLoadError(e?.message || String(e));
      }
      setLoading(false);
    };

    loadDashboard();

  // Realtime: subscribe to profiles (for counts and map updates)
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        if (reloadTimer.current) clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(loadDashboard, 400);
      })
      .subscribe();

    // Also listen to activity_logs to refresh the chart in near real-time
    const actChannel = supabase
      .channel('dashboard-activity-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        if (reloadTimer.current) clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(loadDashboard, 400);
      })
      .subscribe();

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
      supabase.removeChannel(actChannel);
    };
  }, [collegeFilter]);

  const handleCollegeFilterChange = (event: SelectChangeEvent) => {
    setCollegeFilter(event.target.value as string);
  };

  // locations are already filtered server-side by college_filter
  const filteredLocations = alumniData?.locations || [];

  const stats: StatCardProps[] = [
    { title: 'New Alumni Today', value: alumniData?.stats.newAlumni ?? 0, color: 'primary' },
    { title: 'Employed', value: alumniData?.stats.employed ?? 0, color: 'success' },
    { title: 'Unemployed', value: alumniData?.stats.unemployed ?? 0, color: 'warning' },
    { title: 'Total Alumni', value: alumniData?.stats.totalAlumni ?? 0, color: 'info' },
  ];

  // Custom cluster icon creation function
  const createClusterCustomIcon = (cluster: any) => {
    return L.divIcon({
      html: `<span>${cluster.getChildCount()}</span>`,
      className: 'custom-marker-cluster',
      iconSize: L.point(40, 40, true)
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box className="report-header">
        <Typography className="report-title">Alumni Dashboard</Typography>
        <Button className="report-download-btn" startIcon={<FileDownloadIcon />} onClick={downloadEmploymentRatePerBatch}>
          Download Employment Report
        </Button>
      </Box>

      <Grid container spacing={3}>
        {loadError && (
          <Grid item xs={12}>
            <Typography color="error" variant="body2">{loadError}</Typography>
          </Grid>
        )}
        {loading && (
          <Grid item xs={12}>
            <LinearProgress />
          </Grid>
        )}
        {stats.map((stat, idx) => (
          <Grid item key={stat.title} xs={12} sm={6} md={3}>
            <StatCard
              title={stat.title}
              value={stat.value}
              color={stat.color}
              className={idx === 0 ? 'report-card-purple' : idx === 1 ? 'report-card-pink' : idx === 2 ? 'report-card-blue' : 'report-card-purple'}
              icon={idx === 0 ? <CalendarTodayIcon /> : idx === 1 ? <TrendingUpIcon /> : idx === 2 ? <PeopleIcon /> : <PeopleIcon />}
            />
          </Grid>
        ))}
        
        <Grid container spacing={3} style={{marginTop:'1rem'}}>
          <Grid item xs={12} md={4}>
            <Card className="report-chart-container" sx={{ height: 500 }}>
              <CardContent sx={{ height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Alumni Activity Over Time
                </Typography>
                <ResponsiveContainer width="100%" height="80%">
                  <LineChart data={alumniData?.activity || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    {/* Single series: daily profile updates */}
                    <Legend />
                    <Line
                      type="monotone"
                      name="Profile Updates"
                      dataKey="updates"
                      stroke={theme.palette.primary.main}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card className="report-chart-container" sx={{ height: 'auto' }}>
              <CardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    Alumni Locations
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Filter by College</InputLabel>
                    <Select
                      value={collegeFilter}
                      label="Filter by College"
                      onChange={handleCollegeFilterChange}
                    >
                      <MenuItem value="all">All Colleges</MenuItem>
                      <MenuItem value="IBM">IBM</MenuItem>
                      <MenuItem value="ICS">ICS</MenuItem>
                      <MenuItem value="ITE">ITE</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <div style={{ height: 500, width: '100%', position: 'relative' }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={initialZoom}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MarkerClusterGroup
                      iconCreateFunction={createClusterCustomIcon}
                      showCoverageOnHover={false}
                      spiderfyOnMaxZoom={true}
                    >
                      {filteredLocations.map((location) => (
                        <Marker 
                          key={location.id} 
                          position={location.position}
                          icon={collegeIcons[location.college]}
                        >
                          <Popup>
                            <div>
                              <strong>{location.name}</strong>
                              <div>College: {location.college}</div>
                              <div>Status: {location.status}</div>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MarkerClusterGroup>
                    <ResetViewControl center={mapCenter} zoom={initialZoom} />
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;