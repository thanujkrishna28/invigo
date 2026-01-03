import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const SocketContext = createContext()

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      const newSocket = io('http://localhost:5000', {
        transports: ['websocket']
      })

      newSocket.on('connect', () => {
        console.log('Socket connected')
        newSocket.emit('join-room', user.id)
      })

      newSocket.on('allocation-complete', (data) => {
        if (user.role === 'admin' || user.role === 'hod') {
          toast.success('New allocations have been generated')
        }
      })

      newSocket.on('new-allocation', (data) => {
        if (user.role === 'faculty') {
          toast.success(`New invigilation duty: ${data.examName}`, {
            duration: 5000
          })
          // Trigger a custom event for components to listen to
          window.dispatchEvent(new CustomEvent('newAllocationReceived', { detail: data }))
        }
      })

      newSocket.on('allocation-updated', (data) => {
        toast.info('Your allocation has been updated')
      })

      newSocket.on('change-request-submitted', (data) => {
        if (user.role === 'admin') {
          toast.info('A new change request has been submitted')
        }
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
      }
    }
  }, [user])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

