import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, Clock, Award } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

const FacultyAnalytics = () => {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    fetchAnalytics()
  }, [filters])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await axios.get(`/api/faculty/analytics?${params}`)
      setAnalytics(response.data)
    } catch (error) {
      toast.error('Error fetching analytics')
      console.error('Error:', error)
    } finally {
      setLoading(false)
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

  if (!analytics) return null

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Analytics</h1>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input min-h-[44px]"
              placeholder="Start Date"
            />

            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input min-h-[44px]"
              placeholder="End Date"
            />
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Duties</p>
                <p className="text-2xl font-bold">{analytics.overview?.totalDuties || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold">{analytics.overview?.totalHours || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Hours/Duty</p>
                <p className="text-2xl font-bold">{analytics.overview?.averageHoursPerDuty || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold">{analytics.overview?.upcomingDuties || 0}</p>
              </div>
              <Award className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Comparison */}
        {analytics.comparison && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Workload Comparison</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Your Duties</div>
                <div className="text-2xl font-bold">{analytics.comparison.personalDuties || 0}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">Department Average</div>
                <div className="text-2xl font-bold">{analytics.comparison.departmentAverage?.toFixed(1) || 0}</div>
              </div>
              <div className={`p-4 rounded-lg ${analytics.comparison.difference >= 0 ? 'bg-yellow-50' : 'bg-purple-50'}`}>
                <div className="text-sm text-gray-600">Difference</div>
                <div className="text-2xl font-bold">
                  {analytics.comparison.difference >= 0 ? '+' : ''}{analytics.comparison.difference?.toFixed(1) || 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Breakdown */}
        {analytics.monthlyBreakdown && analytics.monthlyBreakdown.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Monthly Duties Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3B82F6" name="Duties" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Department & Campus Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analytics.departmentBreakdown && analytics.departmentBreakdown.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Department Breakdown</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.departmentBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ department, count }) => `${department}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.departmentBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {analytics.campusBreakdown && analytics.campusBreakdown.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Campus Breakdown</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.campusBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ campus, count }) => `${campus}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.campusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Exam Type & Time Slot Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analytics.examTypeBreakdown && analytics.examTypeBreakdown.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Exam Type Distribution</h2>
              <div className="space-y-3">
                {analytics.examTypeBreakdown.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium capitalize">{item.examType}</span>
                    <span className="text-lg font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analytics.timeSlotBreakdown && analytics.timeSlotBreakdown.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Time Slot Distribution</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.timeSlotBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeSlot" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#10B981" name="Duties" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default FacultyAnalytics

