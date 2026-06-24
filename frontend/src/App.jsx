import React, { useEffect, useState } from 'react'

function App() {
  const [message, setMessage] = useState('Cargando...')

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => setMessage('Error al conectar con el backend'))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-blue-600">SmartFill</h1>
        <p className="mt-4 text-gray-700">{message}</p>
        <p className="mt-2 text-sm text-gray-500">Dashboard en construcción...</p>
      </div>
    </div>
  )
}

export default App