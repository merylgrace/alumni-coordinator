import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../supabaseClient';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import './Reports.css';

type TimeFilter = 'day' | 'week' | 'month' | 'year';

interface RegistrationData {
  period: string;
  count: number;
}

interface FilterOptions {
  course: string;
  yearGraduated: string;
}

const Reports: React.FC = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [filters, setFilters] = useState<FilterOptions>({
    course: 'all',
    yearGraduated: 'all',
  });
  const [registrationData, setRegistrationData] = useState<RegistrationData[]>([]);
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [courses, setCourses] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Standard course categories
  const STANDARD_COURSES = [
    'BSIT',
    'BSEd English',
    'BSEd Math',
    'BEEd',
    'BECEd',
    'BSBA - Financial Management',
    'BSBA - Marketing Management',
    'BSBA - Operations Management',
  ];

  // Normalize course names to standardized categories
  const normalizeCourse = (course: string): string => {
    if (!course) return 'Unclassified';

    const normalized = course.trim().toUpperCase();

    // BSIT
    if (
      normalized.includes('BSIT') ||
      normalized.includes('INFORMATION TECHNOLOGY') ||
      normalized.includes('BS IN INFORMATION TECHNOLOGY') ||
      normalized.includes('BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY') ||
      normalized.includes('IT')
    ) {
      return 'BSIT';
    }

    // BSEd English
    if (
      normalized.includes('BSED') &&
      normalized.includes('ENGLISH')
    ) {
      return 'BSEd English';
    }

    // BSEd Math
    if (
      normalized.includes('BSED') &&
      (normalized.includes('MATH') || normalized.includes('MATHEMATICS'))
    ) {
      return 'BSEd Math';
    }

    // BEEd
    if (
      normalized.includes('BEED') ||
      normalized.includes('TEACHER EDUCATION') ||
      normalized.includes('TEACHERS EDUCATION') ||
      normalized.includes('BACHELOR OF ELEMENTARY EDUCATION')
    ) {
      return 'BEEd';
    }

    // BECEd
    if (
      normalized.includes('BECED') ||
      normalized.includes('BACHELOR OF EARLY CHILDHOOD EDUCATION')
    ) {
      return 'BECEd';
    }

    // BSBA – Financial Management
    if (
      (normalized.includes('BSBA') &&
        (normalized.includes('FINANCIAL') || normalized.includes('FINANCE'))) ||
      normalized === 'FINANCE'
    ) {
      return 'BSBA - Financial Management';
    }

    // BSBA – Marketing Management
    if (
      (normalized.includes('BSBA') &&
        normalized.includes('MARKETING')) ||
      normalized === 'BUSINESS ADMINISTRATION'
    ) {
      return 'BSBA - Marketing Management';
    }

    // BSBA – Operations Management
    if (
      normalized.includes('BSBA') &&
      normalized.includes('OPERATIONS')
    ) {
      return 'BSBA - Operations Management';
    }

    return 'Unclassified';
  };

  useEffect(() => {
    fetchCourses();
    fetchYears();
  }, []);

  useEffect(() => {
    fetchRegistrationData();
  }, [timeFilter, filters]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('course')
        .not('course', 'is', null);

      if (error) throw error;

      const unclassified: string[] = [];
      const normalizedCourses = data
        .map((item) => {
          const normalized = normalizeCourse(item.course);
          if (normalized === 'Unclassified') {
            unclassified.push(item.course);
          }
          return normalized;
        })
        .filter(Boolean);
      
      // Log unclassified courses for debugging
      const uniqueUnclassified = Array.from(new Set(unclassified));
      if (uniqueUnclassified.length > 0) {
        console.log('Unclassified courses found:', uniqueUnclassified);
      }
      
      const uniqueCourses = Array.from(new Set(normalizedCourses)) as string[];
      // Combine with standard courses and remove duplicates, then sort
      const allCourses = Array.from(
        new Set([...STANDARD_COURSES, ...uniqueCourses])
      ).sort();
      setCourses(allCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
      // Set standard courses as fallback
      setCourses(STANDARD_COURSES.sort());
    }
  };

  const fetchYears = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('graduation_year')
        .not('graduation_year', 'is', null);

      if (error) throw error;

      const uniqueYears = Array.from(
        new Set(data.map((item) => String(item.graduation_year)).filter(Boolean))
      ) as string[];
      setYears(uniqueYears.sort((a, b) => parseInt(b) - parseInt(a)));
    } catch (error) {
      console.error('Error fetching years:', error);
    }
  };

  const fetchRegistrationData = async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('created_at, course, graduation_year, role');

      // Apply year filter if selected
      if (filters.yearGraduated !== 'all') {
        query = query.eq('graduation_year', Number(filters.yearGraduated));
      }

      // Only count alumni registrations
      query = query.eq('role', 'alumni');

      const { data, error } = await query;

      if (error) throw error;

      // Apply course filter by normalizing each course and checking
      let filteredData = data || [];
      if (filters.course !== 'all') {
        filteredData = filteredData.filter(item => normalizeCourse(item.course) === filters.course);
      }

      setTotalAlumni(filteredData.length);

      // Group data by time period
      const groupedData = groupDataByTimePeriod(filteredData, timeFilter);
      setRegistrationData(groupedData);
    } catch (error) {
      console.error('Error fetching registration data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupDataByTimePeriod = (
    data: any[],
    period: TimeFilter
  ): RegistrationData[] => {
    const grouped: { [key: string]: number } = {};

    data.forEach((item) => {
      if (!item.created_at) return;

      const date = new Date(item.created_at);
      let key: string;

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period));
  };

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case 'day':
        return 'Daily Registrations';
      case 'week':
        return 'Weekly Registrations';
      case 'month':
        return 'Monthly Registrations';
      case 'year':
        return 'Yearly Registrations';
    }
  };

  const formatPeriodLabel = (period: string) => {
    switch (timeFilter) {
      case 'day':
        return new Date(period).toLocaleDateString();
      case 'week':
        return `Week of ${new Date(period).toLocaleDateString()}`;
      case 'month':
        const [year, month] = period.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('default', {
          year: 'numeric',
          month: 'long',
        });
      case 'year':
        return period;
      default:
        return period;
    }
  };

  const downloadFilteredRegistrations = async () => {
    try {
      // Fetch all alumni with their details
      let query = supabase.from('profiles').select('id, full_name, first_name, last_name, course, graduation_year, created_at, role');

      // Apply year filter if selected
      if (filters.yearGraduated !== 'all') {
        query = query.eq('graduation_year', Number(filters.yearGraduated));
      }

      // Only alumni
      query = query.eq('role', 'alumni');

      const { data: profilesData, error: profilesError } = await query;

      if (profilesError) throw profilesError;

      // Apply course filter by normalizing
      let filteredData = profilesData || [];
      if (filters.course !== 'all') {
        filteredData = filteredData.filter(item => normalizeCourse(item.course) === filters.course);
      }

      if (filteredData.length === 0) {
        alert('No data to download with current filters');
        return;
      }

      // Helper function to get full name
      const getFullName = (item: any): string => {
        if (item.full_name && item.full_name.trim()) return item.full_name;
        const firstName = item.first_name || '';
        const lastName = item.last_name || '';
        const combined = `${firstName} ${lastName}`.trim();
        return combined || 'N/A';
      };

      // Convert to CSV format
      const rows = [
        ['Full Name', 'Course', 'Original Course', 'Graduation Year', 'Registration Date'],
        ...filteredData.map(item => [
          getFullName(item),
          normalizeCourse(item.course),
          item.course || 'N/A',
          item.graduation_year || 'N/A',
          item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'
        ])
      ];

      const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      let filename = 'alumni_registrations';
      if (filters.course !== 'all') filename += `_${filters.course.replace(/\s+/g, '_')}`;
      if (filters.yearGraduated !== 'all') filename += `_${filters.yearGraduated}`;
      filename += `_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading filtered registrations:', error);
      alert('Error downloading report. Check console for details.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box className="report-header">
        <Typography className="report-title">
          Alumni Registration Reports
        </Typography>
        <Button
          className="report-download-btn"
          startIcon={<FileDownloadIcon />}
          onClick={downloadFilteredRegistrations}
        >
          Download Registration Data
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={timeFilter}
                label="Time Period"
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              >
                <MenuItem value="day">Daily</MenuItem>
                <MenuItem value="week">Weekly</MenuItem>
                <MenuItem value="month">Monthly</MenuItem>
                <MenuItem value="year">Yearly</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Course</InputLabel>
              <Select
                value={filters.course}
                label="Course"
                onChange={(e) => setFilters({ ...filters, course: e.target.value })}
              >
                <MenuItem value="all">All Courses</MenuItem>
                {courses.map((course) => (
                  <MenuItem key={course} value={course}>
                    {course}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Year Graduated</InputLabel>
              <Select
                value={filters.yearGraduated}
                label="Year Graduated"
                onChange={(e) =>
                  setFilters({ ...filters, yearGraduated: e.target.value })
                }
              >
                <MenuItem value="all">All Years</MenuItem>
                {years.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Cards (reports gradient style) */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card className="report-card-purple">
            <CardContent>
              <Box className="report-card-content">
                <PeopleIcon className="report-card-icon" />
                <Box className="report-card-stats">
                  <Typography className="report-card-value">
                    {totalAlumni}
                  </Typography>
                  <Typography className="report-card-label">Total Alumni</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card className="report-card-pink">
            <CardContent>
              <Box className="report-card-content">
                <CalendarTodayIcon className="report-card-icon" />
                <Box className="report-card-stats">
                  <Typography className="report-card-value">
                    {registrationData.length}
                  </Typography>
                  <Typography className="report-card-label">Time Periods</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card className="report-card-blue">
            <CardContent>
              <Box className="report-card-content">
                <TrendingUpIcon className="report-card-icon" />
                <Box className="report-card-stats">
                  <Typography className="report-card-value">
                    {registrationData.length > 0
                      ? Math.max(...registrationData.map((d) => d.count))
                      : 0}
                  </Typography>
                  <Typography className="report-card-label">Peak Registration</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      {loading ? (
        <Box className="report-loading">
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Paper className="report-chart-container">
              <Typography className="report-chart-title">
                {getTimeFilterLabel()} - Bar Chart
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={registrationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={formatPeriodLabel}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip labelFormatter={formatPeriodLabel} />
                  <Legend />
                  <Bar dataKey="count" fill="#667eea" name="Registrations" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Paper className="report-chart-container">
              <Typography className="report-chart-title">
                {getTimeFilterLabel()} - Line Chart
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={registrationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={formatPeriodLabel}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip labelFormatter={formatPeriodLabel} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#f5576c"
                    strokeWidth={2}
                    name="Registrations"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Reports;