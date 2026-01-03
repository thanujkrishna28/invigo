import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Calendar, Clock, AlertCircle, Download, Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

const FacultyDashboard = () => {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
    
    // Listen for new allocation events
    const handleNewAllocation = (event) => {
      // Refresh dashboard when new allocation is received
      fetchDashboard()
    }
    
    window.addEventListener('newAllocationReceived', handleNewAllocation)
    
    return () => {
      window.removeEventListener('newAllocationReceived', handleNewAllocation)
    }
  }, [])

  const fetchDashboard = async () => {
    try {
      const response = await axios.get('/api/faculty/dashboard')
      setDashboard(response.data.data)
    } catch (error) {
      toast.error('Error fetching dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadDutyLetter = async (allocationId) => {
    try {
      const response = await axios.get(`/api/reports/duty-letter/${allocationId}`, {
        responseType: 'blob'
      })
      // Create blob with proper MIME type
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `duty-letter-${allocationId}.pdf`)
      document.body.appendChild(link)
      link.click()
      // Clean up
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Duty letter downloaded')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Download failed')
    }
  }

  const handleDownloadICal = async (allocationId) => {
    try {
      const response = await axios.get(`/api/reports/ical/${allocationId}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `duty-${allocationId}.ics`)
      document.body.appendChild(link)
      link.click()
      toast.success('Calendar file downloaded')
    } catch (error) {
      toast.error('Download failed')
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  const stats = [
    {
      title: 'Total Duties',
      value: dashboard?.statistics?.totalDuties || 0,
      icon: Calendar,
      color: 'bg-blue-500'
    },
    {
      title: 'Total Hours',
      value: dashboard?.statistics?.totalHours || 0,
      icon: Clock,
      color: 'bg-green-500'
    },
    {
      title: 'Pending Notifications',
      value: dashboard?.statistics?.pendingNotifications || 0,
      icon: Bell,
      color: 'bg-yellow-500',
      highlight: (dashboard?.statistics?.pendingNotifications || 0) > 0
    },
    {
      title: "Today's Duties",
      value: dashboard?.statistics?.todayDuties || 0,
      icon: Calendar,
      color: 'bg-purple-500'
    }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Faculty Dashboard</h1>

        {/* Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{stat.title}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-2 sm:p-3 rounded-lg flex-shrink-0 ml-2`}>
                  <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pending Notifications */}
        {dashboard?.pendingNotifications && dashboard.pendingNotifications.length > 0 && (
          <div className="card border-2 border-yellow-300 bg-yellow-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-600" />
                Pending Notifications ({dashboard.pendingNotifications.length})
              </h2>
              <Link to="/faculty/duties?showNotifications=true" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {dashboard.pendingNotifications.map((duty) => (
                <div
                  key={duty._id}
                  className="flex items-center justify-between p-4 bg-white border border-yellow-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{duty.exam?.examName}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(duty.date).toLocaleDateString()} | {duty.startTime} - {duty.endTime}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{duty.campus}</p>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <button
                      onClick={async () => {
                        try {
                          await axios.post(`/api/faculty/acknowledge/${duty._id}`, { action: 'acknowledge' })
                          toast.success('Duty acknowledged successfully')
                          fetchDashboard()
                        } catch (error) {
                          toast.error(error.response?.data?.message || 'Failed to acknowledge')
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Duties */}
        {dashboard?.todayDuties && dashboard.todayDuties.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Duties</h2>
            <div className="space-y-3">
              {dashboard.todayDuties.map((duty) => (
                <div
                  key={duty._id}
                  className="flex items-center justify-between p-4 bg-primary-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{duty.exam?.examName}</p>
                    <p className="text-sm text-gray-600">
                      {duty.startTime} - {duty.endTime} | {duty.campus}
                    </p>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownloadDutyLetter(duty._id)}
                      className="p-2 sm:p-2.5 text-primary-600 hover:bg-primary-100 active:bg-primary-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Download Duty Letter"
                    >
                      <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button
                      onClick={() => handleDownloadICal(duty._id)}
                      className="p-2 sm:p-2.5 text-primary-600 hover:bg-primary-100 active:bg-primary-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Add to Calendar"
                    >
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Duties */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Upcoming Duties</h2>
            <Link to="/faculty/duties" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard?.upcomingDuties && dashboard.upcomingDuties.length > 0 ? (
              dashboard.upcomingDuties.map((duty) => (
                <div
                  key={duty._id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{duty.exam?.examName}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(duty.date).toLocaleDateString()} | {duty.startTime} - {duty.endTime}
                    </p>
                    <p className="text-xs text-gray-500">{duty.campus}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownloadDutyLetter(duty._id)}
                      className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No upcoming duties</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default FacultyDashboard

