"use client"

import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import LoginPage from "./pages/LoginPage"
import AdminDashboard from "./pages/admin/Dashboard"
import AdminAssignTask from "./pages/admin/AssignTask"
// import AllTasks from "./pages/admin/AllTasks"
import DataPage from "./pages/admin/DataPage"
import AdminDataPage from "./pages/admin/admin-data-page"
import AccountDataPage from "./pages/delegation"
import "./index.css"
import QuickTask from "./pages/QuickTask"
import PendingReport from "./pages/admin/PendingReport"

import TrainingVideo from "./pages/TrainingVideo"
import MaintenancePage from "./pages/MaintenancePage"
import AdminSettings from "./pages/admin/AdminSettings"
import WhatsappSmsSettings from "./pages/admin/WhatsappSmsSettings"

// System-wide maintenance switch: when true, every logged-in route shows the
// maintenance page instead of its normal content. Login still works. Flip
// this back to false to restore normal access.
const MAINTENANCE_MODE = false

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const username = sessionStorage.getItem("username")
  const userRole = sessionStorage.getItem("role")

  if (!username) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard/admin" replace />
  }

  if (MAINTENANCE_MODE) {
    return <MaintenancePage />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Login route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Dashboard redirect */}
      <Route path="/dashboard" element={<Navigate to="/dashboard/admin" replace />} />

      {/* Admin & User Dashboard route */}
      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/quick-task"
        element={
          <ProtectedRoute allowedRoles={["admin", "user"]}>
            <QuickTask />
          </ProtectedRoute>
        }
      />
      {/* Assign Task route - only for admin */}
      <Route
        path="/dashboard/assign-task"
        element={
          <ProtectedRoute allowedRoles={["admin", "user"]}>
            <AdminAssignTask />
          </ProtectedRoute>
        }
      />

      {/* Pending Report route */}
      <Route
        path="/dashboard/pending-report"
        element={
          <ProtectedRoute allowedRoles={["admin", "user"]}>
            <PendingReport />
          </ProtectedRoute>
        }
      />

      {/* Delegation route for user */}
      <Route
        path="/dashboard/delegation"
        element={
          <ProtectedRoute>
            <AccountDataPage />
          </ProtectedRoute>
        }
      />

      {/* Data routes */}
      <Route
        path="/dashboard/data/:category"
        element={
          <ProtectedRoute>
            <DataPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/traning-video"
        element={
          <ProtectedRoute>
            <TrainingVideo />
          </ProtectedRoute>
        }
      />

      {/* Admin Settings & Task Automation Triggers */}
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSettings />
          </ProtectedRoute>
        }
      />

      {/* WhatsApp SMS Settings & Logs Sub-Component */}
      <Route
        path="/dashboard/settings/whatsapp-sms"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <WhatsappSmsSettings />
          </ProtectedRoute>
        }
      />

      {/* Specific route for Admin Data Page */}
      <Route
        path="/dashboard/data/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDataPage />
          </ProtectedRoute>
        }
      />

      {/* Backward compatibility redirects */}
      <Route path="/admin/*" element={<Navigate to="/dashboard/admin" replace />} />
      <Route path="/admin/dashboard" element={<Navigate to="/dashboard/admin" replace />} />
      <Route parh="/admin/quick-task" element={<Navigate to="/dashboard/quick-task" replace />} />
      <Route path="/admin/assign-task" element={<Navigate to="/dashboard/assign-task" replace />} />
      <Route path="/admin/data/:category" element={<Navigate to="/dashboard/data/:category" replace />} />

      <Route path="/admin/traning-video" element={<Navigate to="/dashboard/traning-video" replace />} />
      <Route path="/user/*" element={<Navigate to="/dashboard/admin" replace />} />
      
      {/* Catch-all route to redirect unknown URLs to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard/admin" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  )
}

export default App
