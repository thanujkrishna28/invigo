import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminConflicts = () => {
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConflicts()
  }, [])

  const fetchConflicts = async () => {
    try {
      const response = await axios.get('/api/conflicts')
      setConflicts(response.data.data)
    } catch (error) {
      toast.error('Error fetching conflicts')
    } finally {
      setLoading(false)
    }
  }

  const handleDetect = async () => {
    try {
      const response = await axios.post('/api/conflicts/detect')
      toast.success(response.data.message)
      fetchConflicts()
    } catch (error) {
      toast.error('Error detecting conflicts')
    }
  }

  const handleResolve = async (conflictId) => {
    try {
      await axios.patch(`/api/conflicts/${conflictId}/resolve`)
      toast.success('Conflict marked as resolved')
      fetchConflicts()
    } catch (error) {
      toast.error('Error resolving conflict')
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Conflicts</h1>
          <button onClick={handleDetect} className="btn-primary flex items-center space-x-2">
            <RefreshCw className="w-4 h-4" />
            <span>Detect Conflicts</span>
          </button>
        </div>

        <div className="card">
          <div className="space-y-4">
            {conflicts.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No conflicts detected</p>
              </div>
            ) : (
              conflicts.map((conflict) => (
                <div
                  key={conflict._id}
                  className={`border-l-4 p-4 rounded ${conflict.severity === 'high'
                      ? 'border-red-500 bg-red-50'
                      : conflict.severity === 'medium'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-blue-500 bg-blue-50'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${conflict.severity === 'high'
                              ? 'bg-red-100 text-red-800'
                              : conflict.severity === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                        >
                          {conflict.severity.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-600">{conflict.type}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {conflict.faculty?.name}
                      </p>
                      <p className="text-sm text-gray-700">{conflict.description}</p>
                      {conflict.resolution?.suggestedActions && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            Suggested Actions:
                          </p>
                          <ul className="list-disc list-inside text-xs text-gray-600">
                            {conflict.resolution.suggestedActions.map((action, idx) => (
                              <li key={idx}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {conflict.status === 'detected' && (
                      <button
                        onClick={() => handleResolve(conflict._id)}
                        className="btn-secondary text-xs py-1 px-3 ml-4"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default AdminConflicts

