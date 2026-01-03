import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import PrivateRoute from './components/PrivateRoute'
import theme from './theme/theme'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import FacultyDashboard from './pages/faculty/FacultyDashboard'
import AdminSchedule from './pages/admin/AdminSchedule'
import AdminManage from './pages/admin/AdminManage'
import AdminExamTimetable from './pages/admin/AdminExamTimetable'
import AdminCalendar from './pages/admin/AdminCalendar'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminAcknowledgments from './pages/admin/AdminAcknowledgments'
import AdminLiveStatus from './pages/admin/AdminLiveStatus'
import AdminAllocationLogs from './pages/admin/AdminAllocationLogs'
import FacultyDuties from './pages/faculty/FacultyDuties'
import FacultyCalendar from './pages/faculty/FacultyCalendar'
import FacultyAnalytics from './pages/faculty/FacultyAnalytics'
import HodDashboard from './pages/hod/HodDashboard'
import HodSchedule from './pages/hod/HodSchedule'
import HodFaculty from './pages/hod/HodFaculty'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen">
              <Routes>
              <Route path="/login" element={<Login />} />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/schedule"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminSchedule />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/manage"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminManage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/timetable"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminExamTimetable />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/calendar"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminCalendar />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminAnalytics />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/acknowledgments"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminAcknowledgments />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/live-status"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminLiveStatus />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/allocation-logs"
                element={
                  <PrivateRoute allowedRoles={['admin']}>
                    <AdminAllocationLogs />
                  </PrivateRoute>
                }
              />

              {/* HOD Routes */}
              <Route
                path="/hod"
                element={
                  <PrivateRoute allowedRoles={['hod']}>
                    <HodDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/hod/schedule"
                element={
                  <PrivateRoute allowedRoles={['hod']}>
                    <HodSchedule />
                  </PrivateRoute>
                }
              />
              <Route
                path="/hod/faculty"
                element={
                  <PrivateRoute allowedRoles={['hod']}>
                    <HodFaculty />
                  </PrivateRoute>
                }
              />

              {/* Faculty Routes */}
              <Route
                path="/faculty"
                element={
                  <PrivateRoute allowedRoles={['faculty']}>
                    <FacultyDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/faculty/duties"
                element={
                  <PrivateRoute allowedRoles={['faculty']}>
                    <FacultyDuties />
                  </PrivateRoute>
                }
              />
              <Route
                path="/faculty/calendar"
                element={
                  <PrivateRoute allowedRoles={['faculty']}>
                    <FacultyCalendar />
                  </PrivateRoute>
                }
              />
              <Route
                path="/faculty/analytics"
                element={
                  <PrivateRoute allowedRoles={['faculty']}>
                    <FacultyAnalytics />
                  </PrivateRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
              <Toaster position="top-right" />
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

