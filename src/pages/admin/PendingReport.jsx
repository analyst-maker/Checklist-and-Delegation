"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  FileText,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  AlertTriangle,
  Clock,
  Users,
  ListTodo,
} from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import AdminLayout from "../../components/layout/AdminLayout.jsx"
import { supabase } from "../../lib/supabaseClient"

// Parse DD/MM/YYYY (also tolerates DD-MM-YYYY, YYYY-MM-DD and a trailing time).
const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null
  const clean = dateStr.trim()
  const datePart = clean.includes(" ")
    ? clean.split(" ")[0]
    : clean.includes("T")
      ? clean.split("T")[0]
      : clean
  const delimiter = datePart.includes("-") ? "-" : "/"
  const parts = datePart.split(delimiter)
  if (parts.length !== 3) return null

  let d
  if (parts[0].length === 4) {
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
  } else {
    d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
  }
  return isNaN(d.getTime()) ? null : d
}

const formatDDMMYYYY = (date) => {
  if (!date || isNaN(date.getTime())) return ""
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  return `${day}/${month}/${date.getFullYear()}`
}

const isEmpty = (value) =>
  value === null || value === undefined || String(value).trim() === ""

const getWorkTypeColor = (workType) => {
  switch (String(workType || "").toLowerCase()) {
    case "meeting":
      return "bg-violet-100 text-violet-700 border border-violet-200"
    case "report":
      return "bg-cyan-100 text-cyan-700 border border-cyan-200"
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200"
  }
}

export default function PendingReport() {
  const [source, setSource] = useState("checklist") // 'checklist' | 'delegation'
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [workTypeFilter, setWorkTypeFilter] = useState("")
  const [expandedDoer, setExpandedDoer] = useState(null)

  const userRole = sessionStorage.getItem("role") || "user"
  const username = sessionStorage.getItem("username") || ""

  const fetchPendingTasks = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const table = source === "delegation" ? "Delegation" : "Checklist"

      // Pending == "Actual" is blank. Covers both NULL and an empty string so a
      // row written as '' is not silently dropped.
      let query = supabase.from(table).select("*").or("Actual.is.null,Actual.eq.")
      if (userRole !== "admin" && username) {
        query = query.ilike("Name", username.trim())
      }

      const { data, error: sbError } = await query
        .order("Task ID", { ascending: false })
        .limit(5000)
      if (sbError) throw sbError

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const mapped = (data || [])
        .map((r) => {
          // Pending == "Actual" is blank. Nothing else disqualifies a row.
          if (!isEmpty(r["Actual"])) return null

          const name = (r["Name"] || "").trim()
          if (!name) return null

          const startDateStr = r["Task Start Date"] || r["Task Start date"] || ""
          const startDate = parseDate(String(startDateStr))
          const isOverdue = startDate ? startDate.getTime() < today.getTime() : false

          return {
            id: String(r["Task ID"] ?? ""),
            name,
            department: r["Department"] || r["Firm"] || "",
            givenBy: r["Given By"] || r["Give By"] || "",
            description:
              r["Tast Descriptions"] || r["Task Description"] || "Untitled Task",
            workType: r["Work Type"] || "Task",
            startDateStr: String(startDateStr).split(" ")[0] || "",
            startDate,
            frequency: r["Freq"] || r["Frequency"] || "",
            isOverdue,
          }
        })
        .filter(Boolean)

      setTasks(mapped)
    } catch (err) {
      console.error("Error loading pending tasks:", err)
      setError(err.message || "Failed to load pending tasks")
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [source, userRole, username])

  useEffect(() => {
    fetchPendingTasks()
  }, [fetchPendingTasks])

  // Group the pending tasks by doer, newest-overdue first.
  const doers = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (workTypeFilter && (t.workType || "Task") !== workTypeFilter) return false
      if (!searchTerm) return true
      const q = searchTerm.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      )
    })

    const map = new Map()
    filtered.forEach((t) => {
      if (!map.has(t.name)) {
        map.set(t.name, { name: t.name, tasks: [], overdue: 0 })
      }
      const entry = map.get(t.name)
      entry.tasks.push(t)
      if (t.isOverdue) entry.overdue += 1
    })

    return Array.from(map.values())
      .map((d) => ({
        ...d,
        tasks: d.tasks.sort((a, b) => {
          if (!a.startDate) return 1
          if (!b.startDate) return -1
          return a.startDate - b.startDate
        }),
      }))
      .sort((a, b) => b.tasks.length - a.tasks.length || a.name.localeCompare(b.name))
  }, [tasks, searchTerm, workTypeFilter])

  const totals = useMemo(
    () => ({
      doers: doers.length,
      pending: doers.reduce((sum, d) => sum + d.tasks.length, 0),
      overdue: doers.reduce((sum, d) => sum + d.overdue, 0),
    }),
    [doers]
  )

  const sourceLabel = source === "delegation" ? "Delegation" : "Checklist"

  // ---- PDF ----------------------------------------------------------------
  const buildPdfHeader = (doc, title, subtitle) => {
    doc.setFillColor(47, 53, 80)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.text(title, 14, 12)
    doc.setFontSize(9)
    doc.text(subtitle, 14, 19)
    doc.setTextColor(0, 0, 0)
  }

  const downloadDoerPdf = (doer) => {
    const doc = new jsPDF()
    buildPdfHeader(
      doc,
      `Pending Report - ${doer.name}`,
      `${sourceLabel} | Pending: ${doer.tasks.length} | Overdue: ${doer.overdue} | Generated: ${formatDDMMYYYY(new Date())}`
    )

    autoTable(doc, {
      startY: 32,
      head: [["Task ID", "Task Description", "Work Type", "Start Date", "Freq", "Status"]],
      body: doer.tasks.map((t) => [
        t.id,
        t.description,
        t.workType || "Task",
        t.startDateStr || "-",
        t.frequency || "-",
        t.isOverdue ? "Overdue" : "Pending",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 252] },
      columnStyles: { 1: { cellWidth: 70 } },
    })

    doc.save(`Pending-${sourceLabel}-${doer.name.replace(/\s+/g, "_")}.pdf`)
  }

  const downloadAllPdf = () => {
    const doc = new jsPDF()
    buildPdfHeader(
      doc,
      "Pending Report - All Doers",
      `${sourceLabel} | Doers: ${totals.doers} | Pending: ${totals.pending} | Overdue: ${totals.overdue} | Generated: ${formatDDMMYYYY(new Date())}`
    )

    autoTable(doc, {
      startY: 32,
      head: [["Doer", "Pending", "Overdue"]],
      body: doers.map((d) => [d.name, String(d.tasks.length), String(d.overdue)]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 252] },
    })

    // One detail table per doer, each starting on its own page.
    doers.forEach((d) => {
      doc.addPage()
      buildPdfHeader(
        doc,
        d.name,
        `${sourceLabel} | Pending: ${d.tasks.length} | Overdue: ${d.overdue}`
      )
      autoTable(doc, {
        startY: 32,
        head: [["Task ID", "Task Description", "Work Type", "Start Date", "Freq", "Status"]],
        body: d.tasks.map((t) => [
          t.id,
          t.description,
          t.workType || "Task",
          t.startDateStr || "-",
          t.frequency || "-",
          t.isOverdue ? "Overdue" : "Pending",
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 252] },
        columnStyles: { 1: { cellWidth: 70 } },
      })
    })

    doc.save(`Pending-${sourceLabel}-All-Doers.pdf`)
  }

  // ---- UI -----------------------------------------------------------------
  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-purple-700">
              Pending Report
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Doer-wise pending tasks. Click a name to see the task list, or download it as PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">
              {["checklist", "delegation"].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setSource(key)
                    setExpandedDoer(null)
                  }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${source === key
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white/70"
                    }`}
                >
                  {key === "checklist" ? "Checklist" : "Delegation"}
                </button>
              ))}
            </div>

            <button
              onClick={fetchPendingTasks}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-purple-200 text-purple-700 text-sm font-semibold hover:bg-purple-50 disabled:opacity-50 transition-all shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={downloadAllPdf}
              disabled={loading || doers.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Download className="h-4 w-4" />
              Download All (PDF)
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Doers with Pending",
              value: totals.doers,
              hint: "Staff having at least one open task",
              Icon: Users,
              theme: "card-3d-purple",
              orb: "crystal-orb-purple",
              text: "text-purple-600",
            },
            {
              label: "Total Pending",
              value: totals.pending,
              hint: `Open ${sourceLabel.toLowerCase()} tasks (Actual blank)`,
              Icon: ListTodo,
              theme: "card-3d-amber",
              orb: "crystal-orb-amber",
              text: "text-amber-600",
            },
            {
              label: "Overdue",
              value: totals.overdue,
              hint: "Past due date, still not submitted",
              Icon: AlertTriangle,
              theme: "card-3d-rose",
              orb: "crystal-orb-rose",
              text: "text-rose-600",
            },
          ].map(({ label, value, hint, Icon, theme, orb, text }) => (
            <div key={label} className={`card-3d-wrapper ${theme}`}>
              <div className="flex flex-row items-center justify-between pb-2">
                <h3 className={`text-xs font-bold tracking-wider uppercase ${text}`}>
                  {label}
                </h3>
                <div className={`crystal-orb-3d ${orb}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="pt-1">
                <div className="text-3xl font-extrabold text-slate-800 number-3d-text">
                  {loading ? (
                    <span className="text-base font-semibold text-slate-400 animate-pulse">
                      Loading…
                    </span>
                  ) : (
                    value
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">{hint}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search doer, task ID or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>

          {source === "checklist" && (
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="rounded-xl bg-white border-2 border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 min-w-[160px] focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 cursor-pointer transition-all"
            >
              <option value="">All Work Types</option>
              <option value="Task">Task</option>
              <option value="Meeting">Meeting</option>
              <option value="Report">Report</option>
            </select>
          )}
        </div>

        {/* Doer list */}
        {loading ? (
          <div className="rounded-2xl bg-white/70 border border-white/80 shadow-sm p-14 text-center text-slate-400 text-sm backdrop-blur">
            Loading pending tasks...
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-14 text-center text-rose-600 text-sm">
            {error}
          </div>
        ) : doers.length === 0 ? (
          <div className="rounded-2xl bg-white/70 border border-white/80 shadow-sm p-14 text-center backdrop-blur">
            <div className="h-14 w-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#ecfdf5,#d1fae5)" }}>
              <Clock className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-slate-700 font-bold">No pending tasks found</p>
            <p className="text-slate-400 text-sm mt-1">
              {searchTerm || workTypeFilter
                ? "Try clearing the filters."
                : `Every ${sourceLabel.toLowerCase()} task is submitted.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {doers.map((doer, index) => {
              const isOpen = expandedDoer === doer.name
              const total = doer.tasks.length
              const overduePct = total > 0 ? Math.round((doer.overdue / total) * 100) : 0

              // Accent follows how bad the backlog is, so the worst doers read first.
              const accent =
                doer.overdue === 0
                  ? { bar: "linear-gradient(180deg,#10b981,#34d399)", ring: "rgba(16,185,129,0.35)", fill: "linear-gradient(90deg,#059669,#34d399)" }
                  : overduePct >= 60
                    ? { bar: "linear-gradient(180deg,#e11d48,#fb7185)", ring: "rgba(225,29,72,0.35)", fill: "linear-gradient(90deg,#e11d48,#fb7185)" }
                    : { bar: "linear-gradient(180deg,#d97706,#fbbf24)", ring: "rgba(217,119,6,0.35)", fill: "linear-gradient(90deg,#d97706,#fbbf24)" }

              return (
                <div
                  key={doer.name}
                  className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${isOpen ? "border-purple-200 shadow-lg" : "border-white/80 shadow-sm hover:shadow-md hover:-translate-y-0.5"}`}
                  style={{
                    background: isOpen
                      ? "linear-gradient(135deg,rgba(255,255,255,0.95),rgba(250,247,255,0.9))"
                      : "linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                  }}
                >
                  {/* severity rail */}
                  <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent.bar }} />

                  <div className="flex items-center gap-3 pl-5 pr-4 py-4">
                    <button
                      onClick={() => setExpandedDoer(isOpen ? null : doer.name)}
                      className="flex flex-1 items-center gap-4 text-left min-w-0"
                    >
                      <div className="relative shrink-0">
                        <div
                          className="h-12 w-12 rounded-2xl flex items-center justify-center font-extrabold text-lg uppercase text-white"
                          style={{
                            background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                            boxShadow: "0 8px 18px -6px " + accent.ring + ", inset 0 1px 2px rgba(255,255,255,0.45)",
                          }}
                        >
                          {doer.name.charAt(0)}
                        </div>
                        <span className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-white text-[10px] font-extrabold text-slate-500 flex items-center justify-center shadow-sm border border-slate-200">
                          {index + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[15px] font-extrabold text-slate-800 truncate">
                            {doer.name}
                          </p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                            {total} Pending
                          </span>
                          {doer.overdue > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                              <AlertTriangle className="h-3 w-3" />
                              {doer.overdue} Overdue
                            </span>
                          )}
                        </div>

                        {/* overdue share */}
                        <div className="mt-2 flex items-center gap-2.5 max-w-sm">
                          <div
                            className="h-1.5 flex-1 rounded-full overflow-hidden"
                            style={{ background: "rgba(15,23,42,0.08)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.max(overduePct, doer.overdue > 0 ? 4 : 0)}%`,
                                background: accent.fill,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                            {doer.overdue > 0 ? `${overduePct}% overdue` : "On track"}
                          </span>
                        </div>
                      </div>

                      <span className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-colors ${isOpen ? "text-purple-600" : "text-slate-400"}`}>
                        {isOpen ? "Hide" : "View"} tasks
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>

                    <button
                      onClick={() => downloadDoerPdf(doer)}
                      title={`Download ${doer.name} pending report`}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold shrink-0 transition-all hover:brightness-110 active:scale-95"
                      style={{
                        background: "linear-gradient(135deg,#7c3aed,#6366f1)",
                        boxShadow: "0 6px 14px -5px rgba(124,58,237,0.55)",
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      PDF
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-200/70 px-5 py-4 overflow-x-auto" style={{ background: "rgba(248,250,252,0.75)" }}>
                      <table className="min-w-full">
                        <thead>
                          <tr className="text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                            <th className="pb-2.5 pr-4">Task ID</th>
                            <th className="pb-2.5 pr-4">Task Description</th>
                            {source === "checklist" && <th className="pb-2.5 pr-4">Work Type</th>}
                            <th className="pb-2.5 pr-4">Start Date</th>
                            <th className="pb-2.5 pr-4">Freq</th>
                            <th className="pb-2.5 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {doer.tasks.map((task) => (
                            <tr
                              key={`${task.id}-${task.startDateStr}`}
                              className="text-sm border-t border-slate-200/60 hover:bg-white/80 transition-colors"
                            >
                              <td className="py-3 pr-4 font-bold text-slate-700 whitespace-nowrap">
                                #{task.id}
                              </td>
                              <td className="py-3 pr-4 text-slate-700 max-w-[320px] font-medium">
                                {task.description}
                              </td>
                              {source === "checklist" && (
                                <td className="py-3 pr-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${getWorkTypeColor(task.workType)}`}
                                  >
                                    {task.workType || "Task"}
                                  </span>
                                </td>
                              )}
                              <td className="py-3 pr-4 text-slate-500 whitespace-nowrap font-medium">
                                {task.startDateStr || "—"}
                              </td>
                              <td className="py-3 pr-4 text-slate-500 whitespace-nowrap capitalize">
                                {task.frequency || "—"}
                              </td>
                              <td className="py-3 pr-4 whitespace-nowrap">
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                                  style={{
                                    background: task.isOverdue
                                      ? "linear-gradient(135deg,#e11d48,#fb7185)"
                                      : "linear-gradient(135deg,#d97706,#fbbf24)",
                                  }}
                                >
                                  {task.isOverdue && <AlertTriangle className="h-3 w-3" />}
                                  {task.isOverdue ? "Overdue" : "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
