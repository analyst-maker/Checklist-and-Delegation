"use client"

import { useNavigate } from "react-router-dom"

export default function MaintenancePage() {
  const navigate = useNavigate()

  const handleLogout = () => {
    sessionStorage.removeItem("username")
    sessionStorage.removeItem("role")
    sessionStorage.removeItem("department")
    sessionStorage.removeItem("email")
    navigate("/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-purple-100 p-8 text-center">
        {/* Luxury 3D Brand Badge */}
        <div className="flex items-center justify-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl p-[2px] bg-gradient-to-br from-[#F5D061] via-[#E6AF2E] to-[#7C4700] shadow-[0_8px_20px_rgba(124,71,0,0.3)]">
            <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-[#2D1609] via-[#1B0B04] to-[#0E0502] flex items-center justify-center relative overflow-hidden border border-[#F5D061]/30">
              <span 
                className="font-serif font-black text-2xl"
                style={{
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #FCE8A6 35%, #E5B438 75%, #A8710B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'
                }}
              >
                R
              </span>
            </div>
          </div>
          <div className="flex flex-col text-left">
            <span
              className="text-2xl font-black tracking-[0.16em] uppercase leading-tight"
              style={{
                background: 'linear-gradient(180deg, #3A1700 0%, #220B00 60%, #150600 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.9)) drop-shadow(0 2px 4px rgba(45,22,9,0.2))',
              }}
            >
              ROMA
            </span>
            <span
              className="text-[11px] font-black tracking-[0.42em] uppercase"
              style={{
                background: 'linear-gradient(90deg, #B87C24 0%, #E2AB44 50%, #9E6414 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              FOODS
            </span>
          </div>
        </div>

        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-purple-50 border border-purple-100 mb-4">
          <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Under Maintenance</h1>
        <p className="text-sm text-gray-500 mb-1">सिस्टम अभी मेंटेनेंस में है</p>
        <p className="text-sm text-gray-600 mt-4">
          We're currently performing scheduled maintenance on this system. Please check back shortly.
        </p>

        <button
          onClick={handleLogout}
          className="mt-6 w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
