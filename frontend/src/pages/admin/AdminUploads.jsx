import { useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Upload, FileText, AlertCircle, X, Edit2, Trash2, Save, XCircle, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminUploads = () => {
  const [uploading, setUploading] = useState({
    exam: false,
    classroom: false,
    faculty: false
  })
  const [previewData, setPreviewData] = useState({
    exam: null,
    classroom: null,
    faculty: null
  })
  const [editingRow, setEditingRow] = useState(null) // { type: 'exam', index: 0 }
  const [uploadErrors, setUploadErrors] = useState(null)

  const handleFileSelect = async (type, file) => {
    if (!file) return

    try {
      // Use backend preview endpoint
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = `/api/upload/${type === 'exam' ? 'exam-timetable' : type === 'classroom' ? 'classrooms' : 'faculty'}/preview`

      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.data.success && response.data.data) {
        // Convert preview data to editable format
        const editableData = response.data.data.previewData?.map((item, index) => {
          // Use parsedData if available, otherwise use rawData
          const row = item.parsedData || item.rawData || {}
          // Flatten the row object for easier editing
          const flatRow = {}
          Object.keys(row).forEach(key => {
            if (typeof row[key] === 'object' && row[key] !== null && !Array.isArray(row[key])) {
              // Flatten nested objects
              Object.keys(row[key]).forEach(nestedKey => {
                flatRow[nestedKey] = row[key][nestedKey]
              })
            } else {
              flatRow[key] = row[key]
            }
          })
          return {
            ...flatRow,
            _rowIndex: index,
            _isValid: item.isValid !== false,
            _errors: item.errors || [],
            _warnings: item.warnings || []
          }
        }) || []

        setPreviewData(prev => ({
          ...prev,
          [type]: {
            file,
            data: editableData,
            originalData: JSON.parse(JSON.stringify(editableData))
          }
        }))
        toast.success(`Preview: ${response.data.data.validRows || editableData.length} valid, ${response.data.data.invalidRows || 0} invalid rows`)
      } else {
        toast.error('Failed to parse file')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error parsing file')
      console.error('Preview error:', error)
    }
  }

  const handleEdit = (type, index) => {
    setEditingRow({ type, index })
  }

  const handleSaveEdit = (type, index, updatedRow) => {
    setPreviewData(prev => {
      const newData = { ...prev }
      if (newData[type]) {
        const updated = [...newData[type].data]
        updated[index] = { ...updated[index], ...updatedRow }
        newData[type] = { ...newData[type], data: updated }
      }
      return newData
    })
    setEditingRow(null)
    toast.success('Row updated')
  }

  const handleDelete = (type, index) => {
    if (!confirm('Are you sure you want to delete this row?')) return

    setPreviewData(prev => {
      const newData = { ...prev }
      if (newData[type]) {
        const updated = newData[type].data.filter((_, i) => i !== index)
        newData[type] = { ...newData[type], data: updated }
      }
      return newData
    })
    toast.success('Row deleted')
  }

  const handleSave = async (type) => {
    const preview = previewData[type]
    if (!preview || preview.data.length === 0) {
      toast.error('No data to save')
      return
    }

    // Filter out invalid rows
    const validData = preview.data.filter(row => row._isValid !== false)
    if (validData.length === 0) {
      toast.error('No valid rows to save')
      return
    }

    setUploading({ ...uploading, [type]: true })

    try {
      // Send edited data to backend
      // For now, we'll send the original file and let backend handle it
      // In a production system, you'd want to send the edited data as JSON
      const formData = new FormData()
      formData.append('file', preview.file)

      const endpoint = `/api/upload/${type === 'exam' ? 'exam-timetable' : type === 'classroom' ? 'classrooms' : 'faculty'}`
      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      toast.success(response.data.message)
      setPreviewData(prev => ({ ...prev, [type]: null }))
      setEditingRow(null)

      if (response.data.warnings && response.data.warnings.length > 0) {
        setUploadErrors({
          type: type,
          count: response.data.warnings.length,
          errors: response.data.warnings,
          message: response.data.message
        })
      } else {
        setUploadErrors(null)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed')
      console.error('Save error:', error)
    } finally {
      setUploading({ ...uploading, [type]: false })
    }
  }

  const handleCancelPreview = (type) => {
    setPreviewData(prev => ({ ...prev, [type]: null }))
    setEditingRow(null)
  }

  const getTableHeaders = (type) => {
    if (type === 'exam') {
      return ['examId', 'examName', 'courseCode', 'courseName', 'date', 'startTime', 'endTime', 'examType', 'campus', 'department', 'roomNumber']
    } else if (type === 'classroom') {
      return ['roomNumber', 'block', 'floor', 'building', 'campus', 'capacity', 'department']
    } else {
      return ['name', 'email', 'employeeId', 'campus', 'department', 'subject', 'phone']
    }
  }

  const uploadSections = [
    {
      type: 'exam',
      title: 'Upload Exam Timetable',
      description: 'Upload CSV or Excel file containing exam schedule',
      accept: '.csv,.xlsx,.xls',
      endpoint: 'exam-timetable'
    },
    {
      type: 'classroom',
      title: 'Upload Classroom Details',
      description: 'Upload CSV or Excel file containing classroom information',
      accept: '.csv,.xlsx,.xls',
      endpoint: 'classrooms'
    },
    {
      type: 'faculty',
      title: 'Upload Faculty Details',
      description: 'Upload CSV or Excel file containing faculty information',
      accept: '.csv,.xlsx,.xls',
      endpoint: 'faculty'
    }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">File Uploads</h1>

        {/* Error Display */}
        {uploadErrors && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-900">
                  {uploadErrors.message} - {uploadErrors.count} error(s) found
                </h3>
              </div>
              <button
                onClick={() => setUploadErrors(null)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white rounded p-3 max-h-96 overflow-y-auto">
              <ul className="space-y-1 text-sm">
                {uploadErrors.errors.map((error, index) => (
                  <li key={index} className="text-gray-700 font-mono text-xs">
                    <span className="text-yellow-600 font-semibold">•</span> {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {uploadSections.map((section) => {
            const preview = previewData[section.type]
            const isEditing = editingRow?.type === section.type

            return (
              <div key={section.type} className="card">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <FileText className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                    <p className="text-sm text-gray-600">{section.description}</p>
                  </div>
                </div>

                {!preview ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept={section.accept}
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) handleFileSelect(section.type, file)
                        e.target.value = '' // Reset input
                      }}
                      className="hidden"
                      id={`upload-${section.type}`}
                      disabled={uploading[section.type]}
                    />
                    <label
                      htmlFor={`upload-${section.type}`}
                      className={`btn-primary w-full flex items-center justify-center space-x-2 cursor-pointer ${uploading[section.type] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>Choose File</span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span className="text-sm font-medium text-blue-900">
                        {preview.data.length} row(s) ready
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleCancelPreview(section.type)}
                          className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSave(section.type)}
                          disabled={uploading[section.type]}
                          className="text-xs px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
                        >
                          {uploading[section.type] ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 text-xs text-gray-500">
                  <p className="font-medium mb-1">Required Fields:</p>
                  {section.type === 'exam' && (
                    <ul className="list-disc list-inside space-y-1">
                      <li>examId, examName, courseCode, courseName</li>
                      <li>date, startTime, endTime</li>
                      <li>examType (mid-term, semester, or labs)</li>
                      <li>campus, department</li>
                      <li className="text-gray-400 mt-1">Optional: roomNumber (auto-assigned), totalStudents</li>
                    </ul>
                  )}
                  {section.type === 'classroom' && (
                    <ul className="list-disc list-inside space-y-1">
                      <li>roomNumber, block, floor, campus</li>
                      <li>capacity</li>
                    </ul>
                  )}
                  {section.type === 'faculty' && (
                    <ul className="list-disc list-inside space-y-1">
                      <li>name, email, campus</li>
                      <li>subject (required for labs exam allocation)</li>
                      <li className="text-gray-400 mt-1">Optional: employeeId, department</li>
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Preview Tables */}
        {Object.entries(previewData).map(([type, preview]) => {
          if (!preview) return null

          const headers = getTableHeaders(type)
          const isEditing = editingRow?.type === type

          return (
            <div key={type} className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Preview: {uploadSections.find(s => s.type === type)?.title}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleCancelPreview(type)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(type)}
                    disabled={uploading[type]}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {uploading[type] ? 'Saving...' : 'Save All'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      {headers.map(header => (
                        <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.data.map((row, index) => {
                      const isRowEditing = isEditing && editingRow.index === index

                      return (
                        <tr key={index} className={isRowEditing ? 'bg-blue-50' : ''}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {isRowEditing ? (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => {
                                    const updated = {}
                                    headers.forEach(header => {
                                      const input = document.getElementById(`${type}-${index}-${header}`)
                                      if (input) updated[header] = input.value
                                    })
                                    handleSaveEdit(type, index, updated)
                                  }}
                                  className="text-green-600 hover:text-green-800"
                                  title="Save"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingRow(null)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Cancel"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEdit(type, index)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(type, index)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                          {headers.map(header => {
                            const value = row[header]
                            const displayValue = value !== null && value !== undefined ? String(value) : '-'
                            return (
                              <td key={header} className="px-3 py-2 text-sm text-gray-900">
                                {isRowEditing ? (
                                  <input
                                    id={`${type}-${index}-${header}`}
                                    type="text"
                                    defaultValue={displayValue}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                  />
                                ) : (
                                  <span className={`text-xs ${row._isValid === false ? 'text-red-600' : ''}`}>
                                    {displayValue}
                                    {row._errors && row._errors.length > 0 && (
                                      <span className="ml-1 text-red-500" title={row._errors.join(', ')}>⚠</span>
                                    )}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}

export default AdminUploads
