import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, Users, Calendar, AlertTriangle,
  Building2, GraduationCap, BarChart2, PieChart as PieIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/80 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl p-6 transition-all hover:shadow-xl hover:bg-white/90 ${className}`}>
    {children}
  </div>
)

const StatCard = ({ title, value, icon: Icon, color, subValue }) => (
  <GlassCard>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">
          {value}
        </h3>
        {subValue && (
          <p className="text-xs text-gray-400 mt-2 font-medium">{subValue}</p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </GlassCard>
)

const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [campuses, setCampuses] = useState([])
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    fetchCampuses()
    fetchAnalytics()
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [filters])

  const fetchCampuses = async () => {
    try {
      const response = await api.get('/admin/campuses')
      setCampuses(response.data.data || [])
    } catch (error) {
      console.error('Error fetching campuses:', error)
    }
  }

  const fetchDepartments = async () => {
    if (!filters.campus) return
    try {
      const response = await api.get(`/admin/departments?campus=${filters.campus}`)
      setDepartments(response.data.data || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [filters.campus])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await api.get(`/admin/analytics?${params}`)
      setAnalytics(response.data)
    } catch (error) {
      toast.error('Unable to fetch analytics data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-600"></div>
            <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-t-4 border-b-4 border-primary-200 animate-ping opacity-20"></div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!analytics) return null

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">
              Analytics Dashboard
            </h1>
            <p className="text-gray-500 mt-1">Real-time insights and allocation metrics</p>
          </div>
        </div>

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={filters.campus}
              onChange={(e) => setFilters({ ...filters, campus: e.target.value, department: '' })}
              className="input-field bg-gray-50/50"
            >
              <option value="">All Campuses</option>
              {campuses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="input-field bg-gray-50/50"
              disabled={!filters.campus}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input-field bg-gray-50/50"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input-field bg-gray-50/50"
            />
          </div>
        </GlassCard>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Exams"
            value={analytics.overview?.totalExams || 0}
            icon={Calendar}
            color="bg-blue-500"
            subValue="Scheduled in period"
          />
          <StatCard
            title="Allocations"
            value={analytics.overview?.totalAllocations || 0}
            icon={Users}
            color="bg-green-500"
            subValue={`${analytics.overview?.allocationCoverage || 0}% Coverage`}
          />
          <StatCard
            title="Faculty Members"
            value={analytics.overview?.totalFaculty || 0}
            icon={GraduationCap}
            color="bg-purple-500"
            subValue="Active staff"
          />
          <StatCard
            title="Avg Workload"
            value={analytics.overview?.averageDutiesPerFaculty || 0}
            icon={TrendingUp}
            color="bg-orange-500"
            subValue="Duties per faculty"
          />
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart (Span 2) */}
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800">Allocation Trends</h2>
              <div className="flex gap-2 text-sm">
                <span className="flex items-center gap-1 text-primary-600 bg-primary-50 px-2 py-1 rounded-md">
                  <TrendingUp className="w-4 h-4" /> Daily Active
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.timeAnalytics?.dailyTrend || []}>
                <defs>
                  <linearGradient id="colorAlloc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAlloc)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Exam Type Distribution */}
          <GlassCard>
            <h2 className="text-lg font-bold text-gray-800 mb-6">Exam Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.examTypeAnalytics || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="examCount"
                >
                  {(analytics.examTypeAnalytics || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        {/* Secondary Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faculty Workload */}
          <GlassCard>
            <h2 className="text-lg font-bold text-gray-800 mb-6">Top Faculty Workload</h2>
            <div className="space-y-4">
              {analytics.facultyWorkload?.topFaculty?.slice(0, 5).map((faculty, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-yellow-500 shadow-yellow-200' : 'bg-gray-200 text-gray-600'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{faculty.facultyName}</p>
                    <p className="text-xs text-gray-500">{faculty.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-600">{faculty.totalDuties}</p>
                    <p className="text-xs text-gray-400">Duties</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Department Performance */}
          <GlassCard>
            <h2 className="text-lg font-bold text-gray-800 mb-6">Department Activity</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.departmentAnalytics?.slice(0, 8) || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="department" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="totalAllocations" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>
      </div>
    </Layout>
  )
}

export default AdminAnalytics

