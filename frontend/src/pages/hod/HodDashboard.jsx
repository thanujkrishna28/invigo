import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Calendar, Users, FileText, AlertTriangle, Clock, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

const HodDashboard = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const response = await axios.get('/api/hod/dashboard')
      setStats(response.data.data)
    } catch (error) {
      toast.error('Error fetching dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoAllocate = async () => {
    try {
      const response = await axios.post('/api/hod/allocate', {})
      toast.success(response.data.message || 'Allocation completed')
      fetchDashboard()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Allocation failed')
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

  const statCards = [
    {
      title: 'Total Exams',
      value: stats?.statistics?.totalExams || 0,
      icon: FileText,
      color: 'bg-blue-500',
      link: '/hod/schedule'
    },
    {
      title: 'Scheduled',
      value: stats?.statistics?.scheduledExams || 0,
      icon: Calendar,
      color: 'bg-yellow-500',
      link: '/hod/schedule'
    },
    {
      title: 'Allocated',
      value: stats?.statistics?.allocatedExams || 0,
      icon: Clock,
      color: 'bg-green-500',
      link: '/hod/schedule'
    },
    {
      title: 'Department Faculty',
      value: stats?.statistics?.totalFaculty || 0,
      icon: Users,
      color: 'bg-purple-500',
      link: '/hod/faculty'
    },
    {
      title: 'Active Conflicts',
      value: stats?.statistics?.activeConflicts || 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      link: '/hod/schedule'
    }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">HOD Dashboard</h1>
            <p className="text-gray-600 mt-1">Department: {stats?.department || 'N/A'}</p>
          </div>
          <button onClick={handleAutoAllocate} className="btn-primary flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Auto Allocate</span>
          </button>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {statCards.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Allocations */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Allocations</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats?.recentAllocations?.map((allocation) => (
                  <tr key={allocation._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(allocation.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {allocation.startTime} - {allocation.endTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {allocation.faculty?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {allocation.exam?.examName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default HodDashboard

