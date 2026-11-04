"use client"
import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react"
import { CheckCircle2, Upload, X, Search, History, ArrowLeft, Filter, Edit, Camera, Image as ImageIcon, Clipboard, RefreshCw, Download } from "lucide-react"
import AdminLayout from "../../components/layout/AdminLayout"
import { supabase } from "../../lib/supabaseClient"
import { uploadImageToCloudinary } from "../../lib/cloudinary"
import { jsPDF } from "jspdf"
import "jspdf-autotable"

// Configuration object - Move all configurations here
const CONFIG = {
  // Google Apps Script URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec",
  // Google Drive folder ID for file uploads
  DRIVE_FOLDER_ID: "1txwq9Rhrz5G7348qPtpNX0IGPdGlw6J7",
  // Sheet name to work with
  SHEET_NAME: "Checklist",
  // Page configuration
  PAGE_CONFIG: {
    title: "Checklist Tasks",
    historyTitle: "Checklist Task History",
    description: "Showing both completed and pending tasks for today, tomorrow, and past due dates",
    historyDescription: "Read-only view of completed tasks with submission history (excluding admin-processed items)",
  },
}

// Move this function before any component logic, right after CONFIG
const parseDateFromDDMMYYYY = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null
  const datePart = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr
  const parts = datePart.split("/")
  if (parts.length !== 3) return null
  return new Date(parts[2], parts[1] - 1, parts[0])
}

const isEmpty = (value) => {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "")
}

const getTaskStatus = (
  actualValue,
  adminDoneValue,
  taskStartDate,
  assignedTo
) => {
  // Column K (col10) = Actual value
  if (
    !isEmpty(adminDoneValue) &&
    adminDoneValue.toString().trim() === "Admin Done"
  ) {
    return "Admin Done";
  }

  // Check for "Leave" status from Column Q (passed as argument or need to refactor function signature)
  // Since I can't easily change all call sites of getTaskStatus right now, I will handle "Leave" display directly in the render logic or wrapper.
  // BUT, `filteredHistoryData` uses `getSubmissionStatus` and checks statuses.
  // It might be better to just let "Leave" be a distinct status if I can pass it.

  if (actualValue && actualValue.toString().trim() !== "") {
    return "Done";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = parseDateFromDDMMYYYY(taskStartDate);

  if (taskDate) {
    taskDate.setHours(0, 0, 0, 0);

    // Check if task is strictly in the past
    if (taskDate.getTime() < today.getTime()) {
      return "Overdue";
    }
  }

  return "Pending";
};

// Helper to check if status is "Leave"
const isLeaveStatus = (leaveValue) => {
  return !isEmpty(leaveValue) && leaveValue.toString().trim().toLowerCase() === "leave";
};

const getStatusColor = (status) => {
  if (status === "Leave") return "bg-red-100 text-red-800"; // Red styling for Leave
  switch (status) {
    case "Done":
      return "bg-green-100 text-green-800";
    case "Admin Done":
      return "bg-blue-100 text-blue-800";
    case "Overdue":
      return "bg-red-600 text-white"; // Changed to blood red background with white text
    case "Pending":
      return "bg-orange-100 text-black";
    default:
      return "bg-gray-100 text-gray-800";
  }
};


const getWorkTypeColor = (workType) => {
  switch (String(workType || "").toLowerCase()) {
    case "meeting":
      return "bg-violet-100 text-violet-700 border border-violet-200";
    case "report":
      return "bg-cyan-100 text-cyan-700 border border-cyan-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
};


const getSubmissionStatus = (actualDate, delayColumn, leaveColumn) => {
  if (isLeaveStatus(leaveColumn)) {
    return { status: 'Leave', color: 'red' }
  }

  const actualNotNull = !isEmpty(actualDate)
  const delayNotNull = !isEmpty(delayColumn)

  if (actualNotNull && delayNotNull) {
    return { status: 'Submitted', color: 'green' }
  } else if (actualNotNull && !delayNotNull) {
    return { status: 'On time', color: 'green' }
  } else {
    return { status: '—', color: 'gray' }
  }
}

const MemoizedTaskRow = memo(({
  account,
  isSelected,
  additionalData,
  remarksData,
  onCheckboxClick,
  onAdditionalDataChange,
  onRemarksChange,
  onImageUpload
}) => {
  const isLeave = isLeaveStatus(account["col16"]);
  const taskStatus = isLeave ? "Leave" : getTaskStatus(account["col10"], account["col15"], account["col6"], account["col4"]);
  const isDisabled = taskStatus === "Admin Done" || taskStatus === "Done" || taskStatus === "Leave";
  const isNotToday = taskStatus === "Overdue";

  return (
    <tr
      className={`group ${isSelected ? "bg-purple-50" : ""} ${isNotToday ? "bg-white border-l-4 border-red-600" : "hover:bg-gray-50"} ${isDisabled ? "opacity-90 cursor-not-allowed" : ""}`}
    >
      <td className={`px-3 py-4 w-12 sticky left-0 z-30 ${isSelected ? "bg-purple-50" : isNotToday ? "bg-white" : "bg-white group-hover:bg-gray-50"}`}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          checked={isSelected}
          onChange={(e) => onCheckboxClick(e, account._id)}
          disabled={isDisabled}
        />
      </td>
      <td className={`px-3 py-4 w-20 sticky left-12 z-30 ${isSelected ? "bg-purple-50" : isNotToday ? "bg-white" : "bg-white group-hover:bg-gray-50"}`}>
        <div className={`text-sm break-words font-medium ${isNotToday ? "text-red-600" : "text-gray-900"}`}>
          {account["col1"] || "—"}
        </div>
      </td>
      <td className="px-3 py-4 min-w-[80px]">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(taskStatus)}`}>
          {taskStatus}
        </span>
      </td>
      {/* Keep all other existing td elements with the same text color logic */}

      <td className="px-3 py-4 min-w-[100px]">
        <div className={`text-sm break-words font-medium ${isNotToday ? "text-red-600" : "text-gray-900"}`}>
          {account["col4"] || "—"}
        </div>
      </td>
      <td className={`px-3 py-4 ${isNotToday ? "bg-white border-l-4 border-white" : "hover:bg-gray-50"} min-w-[100px]`}>
        <select
          disabled={!isSelected}
          value={additionalData || ""}
          onChange={(e) => onAdditionalDataChange(account._id, e.target.value)}
          className={`border border-gray-300 rounded-md px-2 py-1 w-full ${isNotToday ? "text-red-600" : "text-black"} disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium ${isDisabled ? "opacity-50" : ""}`}
        >
          <option value="">Select...</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </td>
      <td className={`px-3 py-4 ${isNotToday ? "bg-white border-l-4 border-white" : "hover:bg-gray-50"} min-w-[150px]`}>
        <input
          type="text"
          placeholder="Enter remarks"
          disabled={!isSelected || !additionalData}
          value={remarksData || ""}
          onChange={(e) => onRemarksChange(account._id, e.target.value)}
          className={`border rounded-md px-2 py-1 w-full border-gray-300 ${isNotToday ? "placeholder" : ""} disabled:bg-gray-100 disabled:cursor-not-allowed text-sm break-words font-medium ${isDisabled ? "opacity-50" : ""}`}
        />
      </td>
      <td className="px-3 py-4 min-w-[200px]">
        <div className={`text-sm break-words font-medium ${isNotToday ? "text-red-600" : "text-gray-900"} ${isDisabled ? "opacity-50" : ""}`} title={account["col5"]}>
          {account["col5"] || "—"}
        </div>
      </td>
      <td className={`px-3 py-4 ${isNotToday ? "bg-white border-l-4 border-white" : "hover:bg-gray-50"} min-w-[150px]`}>
        <div className={`text-sm break-words ${isNotToday ? "text-red-600" : "text-gray-900"} ${isDisabled ? "opacity-50" : ""}`}>
          {account["col6"] ? (
            <div>
              <div className="font-medium break-words">
                {account["col6"].includes(" ") ? account["col6"].split(" ")[0] : account["col6"]}
              </div>
              {account["col6"].includes(" ") && (
                <div className={`text-xs font-semibold break-words ${isNotToday ? "text-red-500" : "text-blue-600"}`}>
                  {(() => {
                    const timeStr = account["col6"].split(" ").slice(1).join(" ");
                    // Format time HH:MM:SS to HH:MM AM/PM if possible
                    const timeParts = timeStr.split(":");
                    if (timeParts.length >= 2) {
                      const hours = parseInt(timeParts[0], 10);
                      const minutes = timeParts[1];
                      const ampm = hours >= 12 ? "PM" : "AM";
                      const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                      return `${displayHours}:${minutes} ${ampm}`;
                    }
                    return timeStr;
                  })()}
                </div>
              )}
            </div>
          ) : (
            "—"
          )}
        </div>
      </td>
      <td className={`px-3 py-4 min-w-[110px] ${isDisabled ? "opacity-50" : ""}`}>
        <div className={`text-sm break-words font-medium ${isNotToday ? "text-red-600" : "text-gray-900"}`}>
          {account["col7"] || "—"}
        </div>
        <span className={`mt-1 inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${getWorkTypeColor(account["col17"])}`}>
          {account["col17"] || "Task"}
        </span>
      </td>


      <td className="px-3 py-4 bg-green-50 min-w-[120px]">
        {account.image ? (
          <div className={`flex flex-col gap-2 ${isDisabled ? "opacity-50" : ""}`}>
            {Array.isArray(account.image) ? (
              account.image.map((file, idx) => (
                <div key={idx} className="flex items-center">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Receipt"
                    className="h-8 w-8 object-cover rounded-md mr-2 flex-shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-gray-500 truncate max-w-[80px]" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-xs text-green-600 font-medium">Ready</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center">
                <img
                  src={account.image}
                  alt="Receipt"
                  className="h-10 w-10 object-cover rounded-md mr-2 flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <button
                    className="text-xs text-purple-600 hover:text-purple-800 break-words font-medium text-left"
                    onClick={() => window.open(account.image, "_blank")}
                  >
                    View Full Image
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {account["col9"]?.toUpperCase() === "YES" && (
              <span className="text-xs text-red-600 font-medium break-words">
                Required Upload *
              </span>
            )}
            <div className="flex gap-3">
              {/* Camera Icon */}
              <label
                className={`flex flex-col items-center justify-center cursor-pointer p-2 rounded-md border border-gray-200 bg-gray-50 hover:bg-purple-50 transition-colors ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 border-red-200" : "text-purple-600"} ${isDisabled || !isSelected ? "opacity-50 pointer-events-none" : ""}`}
                title="Take Photo"
              >
                <Camera className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-medium">Camera</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => onImageUpload(account._id, e)}
                  disabled={!isSelected}
                />
              </label>

              {/* Gallery Icon */}
              <label
                className={`flex flex-col items-center justify-center cursor-pointer p-2 rounded-md border border-gray-200 bg-gray-50 hover:bg-purple-50 transition-colors ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 border-red-200" : "text-purple-600"} ${isDisabled || !isSelected ? "opacity-50 pointer-events-none" : ""}`}
                title="Choose from Gallery"
              >
                <ImageIcon className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-medium">Gallery</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  multiple
                  onChange={(e) => onImageUpload(account._id, e)}
                  disabled={!isSelected}
                />
              </label>

              {/* Paste Icon: paste a copied screenshot/image directly from the clipboard */}
              <button
                type="button"
                title="Paste screenshot from clipboard"
                disabled={!isSelected}
                onClick={async () => {
                  try {
                    if (!navigator.clipboard || !navigator.clipboard.read) {
                      alert("Clipboard paste is not supported in this browser. Please use Camera or Gallery.");
                      return;
                    }
                    const clipboardItems = await navigator.clipboard.read();
                    const files = [];
                    for (const clipItem of clipboardItems) {
                      const imageType = clipItem.types.find((t) => t.startsWith("image/"));
                      if (imageType) {
                        const blob = await clipItem.getType(imageType);
                        const ext = imageType.split("/")[1] || "png";
                        files.push(new File([blob], `screenshot_${Date.now()}.${ext}`, { type: imageType }));
                      }
                    }
                    if (files.length === 0) {
                      alert("No image found in clipboard. Take a screenshot first, then tap Paste.");
                      return;
                    }
                    onImageUpload(account._id, { target: { files } });
                  } catch (err) {
                    console.error("Paste failed:", err);
                    alert("Could not paste image. Please allow clipboard access, or use Camera/Gallery.");
                  }
                }}
                className={`flex flex-col items-center justify-center cursor-pointer p-2 rounded-md border border-gray-200 bg-gray-50 hover:bg-purple-50 transition-colors ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 border-red-200" : "text-purple-600"} ${isDisabled || !isSelected ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Clipboard className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-medium">Paste</span>
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
});

function AccountDataPage() {
  const [accountData, setAccountData] = useState([])
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [additionalData, setAdditionalData] = useState({})
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [remarksData, setRemarksData] = useState({})
  // Tracks whether a successful load has ever completed, so a failed
  // background poll (see the 15s auto-refresh effect below) knows whether
  // it's safe to keep showing already-loaded data instead of surfacing an error.
  const hasLoadedOnceRef = useRef(false)
  const [historyData, setHistoryData] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [membersList, setMembersList] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [userRole, setUserRole] = useState("")
  const [username, setUsername] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("") // New filter for status
  const [workTypeFilter, setWorkTypeFilter] = useState("") // Filter for Task / Meeting / Report
  const [attachmentFilter, setAttachmentFilter] = useState("") // New filter for attachment
  const [showFilters, setShowFilters] = useState(false) // Toggle for filter section
  const [nameSearchTerm, setNameSearchTerm] = useState("") // Search term for name dropdown
  const [editingRemarks, setEditingRemarks] = useState({});
  const [tempRemarks, setTempRemarks] = useState({});
  const [displayLimit, setDisplayLimit] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [historyDisplayLimit, setHistoryDisplayLimit] = useState(500)
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false)


  // Admin history selection states
  const [selectedHistoryItems, setSelectedHistoryItems] = useState([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [markingAsDone, setMarkingAsDone] = useState(false)
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    itemCount: 0,
  })
  const [showExportModal, setShowExportModal] = useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  // Function to determine submission status
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.relative')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);


  const handleEditRemarks = async (id, currentRemarks, historyItem) => {
    try {
      const newRemarks = tempRemarks[id] || currentRemarks || "";
      const taskId = historyItem.col1 ? parseInt(historyItem.col1, 10) : historyItem._taskId;

      const { error } = await supabase
        .from('Checklist')
        .update({ Remarks: newRemarks })
        .eq('Task ID', taskId);

      if (error) throw error;

      // Update local state
      setHistoryData(prev =>
        prev.map(item =>
          item._id === id ? { ...item, col13: newRemarks } : item
        )
      );
      setEditingRemarks(prev => ({ ...prev, [id]: false }));
      setSuccessMessage("Remarks updated successfully!");

      // Clear temporary remarks
      setTempRemarks(prev => {
        const newTemp = { ...prev };
        delete newTemp[id];
        return newTemp;
      });
    } catch (error) {
      console.error("Error updating remarks:", error);
      setSuccessMessage(`Failed to update remarks: ${error.message}`);
    }
  };

  const formatDateTimeToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    const seconds = date.getSeconds().toString().padStart(2, "0")
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  }, [])

  const formatDateToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }, [])



  useEffect(() => {
    const role = sessionStorage.getItem("role")
    const user = sessionStorage.getItem("username")
    setUserRole(role || "")
    setUsername(user || "")
  }, [])

  // Add this useEffect for cleanup
  useEffect(() => {
    return () => {
      // Cleanup object URLs on component unmount
      accountData.forEach(account => {
        if (account.image && typeof account.image !== 'string' && account.image instanceof File) {
          URL.revokeObjectURL(account.image)
        }
      })
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Parse Google Sheets date-time to handle DD/MM/YYYY HH:MM:SS format
  const parseGoogleSheetsDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return ""
    // If already in DD/MM/YYYY HH:MM:SS format, return as is
    if (typeof dateTimeStr === "string" && dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)) {
      return dateTimeStr
    }
    // If in DD/MM/YYYY format (without time), return as is
    if (typeof dateTimeStr === "string" && dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateTimeStr
    }
    // Handle Google Sheets Date(year,month,day) format
    if (typeof dateTimeStr === "string" && dateTimeStr.startsWith("Date(")) {
      const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateTimeStr)
      if (match) {
        const year = Number.parseInt(match[1], 10)
        const month = Number.parseInt(match[2], 10)
        const day = Number.parseInt(match[3], 10)
        return `${day.toString().padStart(2, "0")}/${(month + 1).toString().padStart(2, "0")}/${year}`
      }
    }
    // Try to parse as a regular date
    try {
      const date = new Date(dateTimeStr)
      if (!isNaN(date.getTime())) {
        // Check if the original string contained time information
        if (typeof dateTimeStr === "string" && (dateTimeStr.includes(":") || dateTimeStr.includes("T"))) {
          return formatDateTimeToDDMMYYYY(date)
        } else {
          return formatDateToDDMMYYYY(date)
        }
      }
    } catch (error) {
      console.error("Error parsing date-time:", error)
    }
    return dateTimeStr
  }

  // Parse date from DD/MM/YYYY or DD/MM/YYYY HH:MM:SS format for comparison
  const parseDateFromDDMMYYYY = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null
    const datePart = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr
    const parts = datePart.split("/")
    if (parts.length !== 3) return null
    return new Date(parts[2], parts[1] - 1, parts[0])
  }, [])

  const sortDateWise = (a, b) => {
    const dateStrA = a["col6"] || ""
    const dateStrB = b["col6"] || ""
    const dateA = parseDateFromDDMMYYYY(dateStrA)
    const dateB = parseDateFromDDMMYYYY(dateStrB)
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA.getTime() - dateB.getTime()
  }

  const resetFilters = useCallback(() => {
    setSearchTerm("")
    setSelectedMembers([])
    setStartDate("")
    setEndDate("")
    setSelectedStatus("")
    setNameSearchTerm("")
    setAttachmentFilter("")
    setWorkTypeFilter("")
  }, [])

  const exportToExcel = () => {
    const dataToExport = showHistory ? filteredHistoryData : filteredAccountData
    if (dataToExport.length === 0) {
      alert("No data to export")
      return
    }

    const csv = [
      ["Task ID", "Name", "Task Description", "Status", "Remarks", "Task Start Date & Time", "Freq / Work Type", "Actual Time", "Admin", "Submission Status"],
      ...dataToExport.map(row => [
        row["Task ID"] || "",
        row["Name"] || "",
        row["Task Description"] || "",
        row["Status"] || "",
        row["Remarks"] || "",
        row["Task Start Date"] || "",
        row["Freq / Work Type"] || "",
        row["Actual Time"] || "",
        row["Admin"] || "",
        row["Submission Status"] || ""
      ])
    ]

    let csvContent = csv.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const link = document.createElement("a")
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)
    link.download = `checklist-${showHistory ? "history" : "tasks"}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    setShowExportModal(false)
  }

  const exportToPdf = () => {
    const dataToExport = showHistory ? filteredHistoryData : filteredAccountData
    if (dataToExport.length === 0) {
      alert("No data to export")
      return
    }

    const doc = new jsPDF({ orientation: 'landscape' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10
    const columns = ["Task ID", "Name", "Description", "Status", "Remarks", "Date & Time", "Type", "Actual Time", "Admin", "Submission"]
    const rows = dataToExport.map(row => [
      row["Task ID"] || "",
      (row["Name"] || "").substring(0, 10),
      (row["Task Description"] || "").substring(0, 15),
      row["Status"] || "",
      (row["Remarks"] || "").substring(0, 10),
      row["Task Start Date"] || "",
      (row["Freq / Work Type"] || "").substring(0, 8),
      row["Actual Time"] || "",
      row["Admin"] || "",
      row["Submission Status"] || ""
    ])

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 20,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: 'bold' }
    })

    doc.save(`checklist-${showHistory ? "history" : "tasks"}-${new Date().toISOString().split('T')[0]}.pdf`)
    setShowExportModal(false)
  }

  // Admin functions for history management
  const handleMarkMultipleDone = async () => {
    if (selectedHistoryItems.length === 0) {
      return
    }
    if (markingAsDone) return

    // Open confirmation modal
    setConfirmationModal({
      isOpen: true,
      itemCount: selectedHistoryItems.length,
    })
  }

  // Confirmation modal component
  const ConfirmationModal = ({ isOpen, itemCount, onConfirm, onCancel }) => {
    if (!isOpen) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-yellow-100 text-yellow-600 rounded-full p-3 mr-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Mark Items as Admin Done</h2>
          </div>

          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to mark {itemCount} {itemCount === 1 ? "item" : "items"} as Admin Done?
          </p>

          <div className="flex justify-center space-x-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Admin Done submission handler - Store "Done" text instead of timestamp
  const confirmMarkDone = async () => {
    // Close the modal
    setConfirmationModal({ isOpen: false, itemCount: 0 });
    setMarkingAsDone(true);
    try {
      for (const historyItem of selectedHistoryItems) {
        const taskId = historyItem.col1 ? parseInt(historyItem.col1, 10) : historyItem._taskId;
        await supabase
          .from('Checklist')
          .update({ 'Admin Done': 'Admin Done' })
          .eq('Task ID', taskId);
      }

      setHistoryData((prev) =>
        prev.filter((item) => !selectedHistoryItems.some((selected) => selected._id === item._id))
      );

      setSelectedHistoryItems([]);
      setSuccessMessage(`Successfully marked ${selectedHistoryItems.length} items as Admin Done!`);

      fetchSheetData();
    } catch (error) {
      console.error("Error marking tasks as Admin Done:", error);
      setSuccessMessage(`Failed to mark tasks as Admin Done: ${error.message}`);
    } finally {
      setMarkingAsDone(false);
    }
  };

  const filteredAccountData = useMemo(() => {
    if (!accountData.length) return []

    let filtered = accountData.filter((account) => !isLeaveStatus(account["col16"]));

    if (debouncedSearchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter((account) =>
        Object.values(account).some(
          (value) => value && value.toString().toLowerCase().includes(lowerSearchTerm),
        ),
      );
    }

    if (selectedStatus) {
      filtered = filtered.filter((account) => {
        if (selectedStatus === "Admin Done") {
          return !isEmpty(account["col15"]) && account["col15"].toString().trim() === "Admin Done";
        } else {
          const taskStatus = getTaskStatus(account["col10"], account["col15"], account["col6"], account["col4"]);
          return taskStatus === selectedStatus;
        }
      });
    }

    if (workTypeFilter) {
      filtered = filtered.filter(
        (account) => (account["col17"] || "Task") === workTypeFilter
      );
    }

    if (selectedMembers.length > 0) {
      filtered = filtered.filter((account) => selectedMembers.includes(account["col4"]));
    }

    if (startDate || endDate) {
      filtered = filtered.filter((account) => {
        const itemDate = parseDateFromDDMMYYYY(account["col6"]);
        if (!itemDate) return false;

        if (startDate) {
          const startDateParts = startDate.split("-");
          const startDateObj = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
          startDateObj.setHours(0, 0, 0, 0);
          if (itemDate < startDateObj) return false;
        }

        if (endDate) {
          const endDateParts = endDate.split("-");
          const endDateObj = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);
          endDateObj.setHours(23, 59, 59, 999);
          if (itemDate > endDateObj) return false;
        }

        return true;
      });
    }

    // Sort with grace period consideration
    return filtered.sort((a, b) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const dateA = parseDateFromDDMMYYYY(a["col6"]);
      const dateB = parseDateFromDDMMYYYY(b["col6"]);

      // List of users who get 1-day grace period
      const usersWithGracePeriod = [
        "ARCHANA DAY",
        "AMITA, POONIYA",
        "INDRAJEET"
      ].map(name => name.toUpperCase());

      const isAGracePeriodUser = a["col4"] && usersWithGracePeriod.includes(a["col4"].trim().toUpperCase());
      const isBGracePeriodUser = b["col4"] && usersWithGracePeriod.includes(b["col4"].trim().toUpperCase());

      const isATodayTask = dateA && dateA.setHours(0, 0, 0, 0) === today.getTime();
      const isAYesterdayTask = isAGracePeriodUser && dateA && dateA.setHours(0, 0, 0, 0) === yesterday.getTime();
      const isATodayOrYesterdayTask = isATodayTask || isAYesterdayTask;

      const isBTodayTask = dateB && dateB.setHours(0, 0, 0, 0) === today.getTime();
      const isBYesterdayTask = isBGracePeriodUser && dateB && dateB.setHours(0, 0, 0, 0) === yesterday.getTime();
      const isBTodayOrYesterdayTask = isBTodayTask || isBYesterdayTask;

      // Today's (and yesterday's for grace period users) tasks always come first
      if (isATodayOrYesterdayTask && !isBTodayOrYesterdayTask) return -1;
      if (!isATodayOrYesterdayTask && isBTodayOrYesterdayTask) return 1;

      // For today's/yesterday's tasks: Pending first, then sort by oldest
      if (isATodayOrYesterdayTask && isBTodayOrYesterdayTask) {
        const statusA = getTaskStatus(a["col10"], a["col15"], a["col6"], a["col4"]);
        const statusB = getTaskStatus(b["col10"], b["col15"], b["col6"], b["col4"]);

        if (statusA === "Pending" && statusB !== "Pending") return -1;
        if (statusA !== "Pending" && statusB === "Pending") return 1;

        // Both same status, sort by oldest first
        const dateStrA = a["col6"] || "";
        const dateStrB = b["col6"] || "";
        const parsedDateA = parseDateFromDDMMYYYY(dateStrA);
        const parsedDateB = parseDateFromDDMMYYYY(dateStrB);

        if (!parsedDateA && !parsedDateB) return 0;
        if (!parsedDateA) return 1;
        if (!parsedDateB) return -1;

        return parsedDateA.getTime() - parsedDateB.getTime();
      }

      // For non-today tasks: sort by status and date
      const statusA = getTaskStatus(a["col10"], a["col15"], a["col6"], a["col4"]);
      const statusB = getTaskStatus(b["col10"], b["col15"], b["col6"], b["col4"]);

      if (statusA === "Pending" && statusB !== "Pending") return -1;
      if (statusA !== "Pending" && statusB === "Pending") return 1;

      if (statusA === "Pending" && statusB === "Pending") {
        const dateStrA = a["col6"] || "";
        const dateStrB = b["col6"] || "";
        const parsedDateA = parseDateFromDDMMYYYY(dateStrA);
        const parsedDateB = parseDateFromDDMMYYYY(dateStrB);

        if (!parsedDateA && !parsedDateB) return 0;
        if (!parsedDateA) return 1;
        if (!parsedDateB) return -1;

        return parsedDateA.getTime() - parsedDateB.getTime();
      }

      const dateStrA = a["col6"] || "";
      const dateStrB = b["col6"] || "";
      const parsedDateA = parseDateFromDDMMYYYY(dateStrA);
      const parsedDateB = parseDateFromDDMMYYYY(dateStrB);

      if (!parsedDateA && !parsedDateB) return 0;
      if (!parsedDateA) return 1;
      if (!parsedDateB) return -1;

      return parsedDateB.getTime() - parsedDateA.getTime();
    });
  }, [accountData, debouncedSearchTerm, searchTerm, selectedStatus, selectedMembers, startDate, endDate, workTypeFilter]);

  // Replace existing filteredHistoryData with this
  const filteredHistoryData = useMemo(() => {
    if (!historyData.length) return []

    return historyData
      .filter((item) => {
        const matchesSearch = searchTerm
          ? Object.values(item).some(
            (value) => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
          )
          : true
        const matchesMember = selectedMembers.length > 0 ? selectedMembers.includes(item["col4"]) : true

        let matchesStatus = true;
        if (selectedStatus && !showHistory) {
          if (selectedStatus === "Leave") {
            matchesStatus = isLeaveStatus(item["col16"]);
          } else {
            const submissionStatus = getSubmissionStatus(item["col10"], item["col11"], item["col16"]);
            if (selectedStatus === "Done") {
              matchesStatus = submissionStatus.status === "On time" || submissionStatus.status === "Late Submitted";
            } else if (selectedStatus === "Pending") {
              matchesStatus = submissionStatus.status === "—";
            } else if (selectedStatus === "On time") {
              matchesStatus = submissionStatus.status === "On time";
            } else if (selectedStatus === "Late Submitted") {
              matchesStatus = submissionStatus.status === "Late Submitted";
            }
          }
        }

        let matchesDateRange = true
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col6"])
          if (itemDate) {
            itemDate.setHours(0, 0, 0, 0)
            if (startDate) {
              const startDateParts = startDate.split("-")
              const startDateObj = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2])
              startDateObj.setHours(0, 0, 0, 0)
              if (itemDate.getTime() < startDateObj.getTime()) matchesDateRange = false
            }
            if (endDate) {
              const endDateParts = endDate.split("-")
              const endDateObj = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2])
              endDateObj.setHours(0, 0, 0, 0)
              if (itemDate.getTime() > endDateObj.getTime()) matchesDateRange = false
            }
          }
        }

        let matchesAttachment = true;
        if (attachmentFilter === "NoPic") {
          matchesAttachment = !item["col14"] || item["col14"].trim() === "";
        } else if (attachmentFilter === "HasPic") {
          matchesAttachment = !!item["col14"] && item["col14"].trim() !== "";
        }

        const matchesWorkType = workTypeFilter
          ? (item["col17"] || "Task") === workTypeFilter
          : true

        return matchesSearch && matchesMember && matchesStatus && matchesDateRange && matchesAttachment && matchesWorkType
      })
      .sort((a, b) => {
        const dateStrA = a["col10"] || ""
        const dateStrB = b["col10"] || ""
        const dateA = parseDateFromDDMMYYYY(dateStrA)
        const dateB = parseDateFromDDMMYYYY(dateStrB)
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.getTime() - dateA.getTime()
      })
  }, [historyData, searchTerm, selectedMembers, selectedStatus, startDate, endDate, parseDateFromDDMMYYYY, attachmentFilter, workTypeFilter])

  const displayedHistoryData = useMemo(() => {
    return filteredHistoryData.slice(0, historyDisplayLimit);
  }, [filteredHistoryData, historyDisplayLimit]);

  const handleLoadMoreHistory = useCallback(() => {
    if (historyDisplayLimit < filteredHistoryData.length && !isLoadingMoreHistory) {
      setIsLoadingMoreHistory(true);
      setTimeout(() => {
        setHistoryDisplayLimit(prev => Math.min(prev + 500, filteredHistoryData.length));
        setIsLoadingMoreHistory(false);
      }, 300);
    }
  }, [historyDisplayLimit, filteredHistoryData.length, isLoadingMoreHistory]);

  const getTaskStatistics = useCallback(() => {
    const totalCompleted = historyData.length
    const memberStats =
      selectedMembers.length > 0
        ? selectedMembers.reduce((stats, member) => {
          const memberTasks = historyData.filter((task) => task["col4"] === member).length
          return {
            ...stats,
            [member]: memberTasks,
          }
        }, {})
        : {}
    const filteredTotal = filteredHistoryData.length
    return {
      totalCompleted,
      memberStats,
      filteredTotal,
    }
  }, [historyData, selectedMembers, filteredHistoryData])

  const handleMemberSelection = useCallback((member) => {
    setSelectedMembers((prev) => {
      if (prev.includes(member)) {
        return prev.filter((item) => item !== member)
      } else {
        return [...prev, member]
      }
    })
  }, [])

  const getFilteredMembersList = useCallback(() => {
    if (userRole === "admin") {
      return membersList
    } else {
      return membersList.filter((member) => member.toLowerCase() === username.toLowerCase())
    }
  }, [membersList, userRole, username])

  const isFetchingRef = useRef(false)

  // isBackground=true is used by the poll below: it refetches silently
  // (no spinner) and, on failure, keeps whatever data is already on screen
  // instead of blanking it out over a transient network hiccup.
  const fetchSheetData = useCallback(async (isBackground = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      if (!isBackground) setLoading(true)
      const currentUsername = sessionStorage.getItem("username")
      const currentUserRole = sessionStorage.getItem("role")
      const userParam = (currentUserRole !== "admin" && currentUsername) ? `&user=${encodeURIComponent(currentUsername)}` : ""
      const pendingAccounts = []
      const historyRows = []
      
      let query = supabase.from('Checklist').select('*')
      if (currentUserRole !== "admin" && currentUsername) {
        query = query.ilike('Name', currentUsername.trim())
      }
      const { data: supabaseRows, error: sbError } = await query
        .order('Task ID', { ascending: false })
        .limit(2500)
      if (sbError) throw sbError

      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      const todayStr = formatDateToDDMMYYYY(today)
      const tomorrowStr = formatDateToDDMMYYYY(tomorrow)

      // For users with grace period: also include yesterday's tasks
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      const yesterdayStr = formatDateToDDMMYYYY(yesterday)

      const membersSet = new Set()
      let rows = [
        { c: [] }, // dummy header row for 1-based index
        ...(supabaseRows || []).map((r) => ({
          c: [
            { v: r['Timestamp'] || '' },
            { v: r['Task ID'] || '' },
            { v: r['Department'] || r['Firm'] || '' },
            { v: r['Given By'] || '' },
            { v: r['Name'] || '' },
            { v: r['Tast Descriptions'] || r['Task Description'] || '' },
            { v: r['Task Start Date'] || '' },
            { v: r['Freq'] || '' },
            { v: r['Enable Reminders'] || '' },
            { v: r['Require Attachment'] || '' },
            { v: r['Actual'] || '' },
            { v: r['Delay'] || '' },
            { v: r['Status'] || '' },
            { v: r['Remarks'] || '' },
            { v: r['Uploaded Image'] || '' },
            { v: r['Admin Done'] || '' },
            { v: r['Leave'] || '' },
            { v: r['Work Type'] || '' },
          ]
        }))
      ]

      // List of users who get 1-day grace period
      const usersWithGracePeriod = [
        "ARCHANA DAY",
        "AMITA, POONIYA",
        "INDRAJEET"
      ].map(name => name.toUpperCase());

      rows.forEach((row, rowIndex) => {
        if (rowIndex === 0) return
        let rowValues = []
        if (row.c) {
          rowValues = row.c.map((cell) => (cell && cell.v !== undefined ? cell.v : ""))
        } else if (Array.isArray(row)) {
          rowValues = row
        } else {
          return
        }

        const assignedTo = rowValues[4] || "Unassigned"
        membersSet.add(assignedTo)
        const isUserMatch = currentUserRole === "admin" || assignedTo.toLowerCase() === currentUsername.toLowerCase()
        if (!isUserMatch && currentUserRole !== "admin") return

        const columnGValue = rowValues[6] // Task Start Date
        const columnKValue = rowValues[10] // Actual Date
        const columnMValue = rowValues[12] // Status (DONE)
        const columnPValue = rowValues[15] // Admin Processed Date (Column P)
        const columnQValue = rowValues[16] // Leave Status (Column Q)

        const rowDateStr = columnGValue ? String(columnGValue).trim() : ""
        const formattedRowDate = parseGoogleSheetsDateTime(rowDateStr)
        const googleSheetsRowIndex = rowIndex + 1

        const taskId = rowValues[1] || ""
        const stableId = taskId
          ? `task_${taskId}_${googleSheetsRowIndex}`
          : `row_${googleSheetsRowIndex}_${Math.random().toString(36).substring(2, 15)}`

        const rowData = {
          _id: stableId,
          _rowIndex: googleSheetsRowIndex,
          _taskId: taskId,
        }

        const columnHeaders = [
          { id: "col0", label: "Timestamp", type: "string" },
          { id: "col1", label: "Task ID", type: "string" },
          { id: "col2", label: "Firm", type: "string" },
          { id: "col3", label: "Given By", type: "string" },
          { id: "col4", label: "Name", type: "string" },
          { id: "col5", label: "Task Description", type: "string" },
          { id: "col6", label: "Task Start Date", type: "datetime" },
          { id: "col7", label: "Freq", type: "string" },
          { id: "col8", label: "Enable Reminders", type: "string" },
          { id: "col9", label: "Require Attachment", type: "string" },
          { id: "col10", label: "Actual", type: "datetime" },
          { id: "col11", label: "Delay", type: "string" },
          { id: "col12", label: "Status", type: "string" },
          { id: "col13", label: "Remarks", type: "string" },
          { id: "col14", label: "Uploaded Image", type: "string" },
          { id: "col15", label: "Admin Done", type: "string" },
          { id: "col16", label: "Leave", type: "string" },
          { id: "col17", label: "Work Type", type: "string" },
        ]

        columnHeaders.forEach((header, index) => {
          const cellValue = rowValues[index]
          if (
            header.type === "datetime" ||
            header.type === "date" ||
            (cellValue && String(cellValue).startsWith("Date("))
          ) {
            rowData[header.id] = cellValue ? parseGoogleSheetsDateTime(String(cellValue)) : ""
          } else if (header.type === "number" && cellValue !== null && cellValue !== "") {
            rowData[header.id] = cellValue
          } else {
            rowData[header.id] = cellValue !== null ? cellValue : ""
          }
        })

        const hasColumnG = !isEmpty(columnGValue)
        const hasColumnK = !isEmpty(columnKValue)
        const isAdminDone = !isEmpty(columnPValue) && columnPValue.toString().trim() === "Admin Done"
        const isLeave = isLeaveStatus(columnQValue);

        // HISTORY LOGIC: For history, collect tasks that are Completed OR Admin Done OR Leave
        // User request: "when Column Q (index-16) have Leave value ... show that data in history page"
        if (hasColumnG) {
          const isUserHistoryMatch = currentUserRole === "admin" || assignedTo.toLowerCase() === currentUsername.toLowerCase()
          // Matches if: (Has Actual Date AND NOT Leave) OR Admin Done OR Leave
          // Basically, any "finished" state.
          // Note: Originally history required `hasColumnK`.
          const isCompleted = hasColumnK || isAdminDone || isLeave;

          if (isUserHistoryMatch && isCompleted) {
            historyRows.push(rowData)
          }
        }

        // TASK PAGE LOGIC: Show Pending and Overdue tasks
        // Exclude: Done, Admin Done, Leave
        if (hasColumnG) {
          const rowDate = parseDateFromDDMMYYYY(formattedRowDate)
          const isToday = formattedRowDate.startsWith(todayStr)
          const isTomorrow = formattedRowDate.startsWith(tomorrowStr)
          const isYesterday = formattedRowDate.startsWith(yesterdayStr)
          const isPastDate = rowDate && rowDate <= today

          // Only add to tasks if it's NOT done, NOT admin done, AND NOT Leave
          const isNotDone = !hasColumnK && !isAdminDone && !isLeave

          const assignedToUpper = assignedTo.trim().toUpperCase();
          const isUserWithGracePeriod = usersWithGracePeriod.includes(assignedToUpper);

          // For users with grace period: include today, tomorrow, yesterday, and past dates
          if (isUserWithGracePeriod) {
            if ((isToday || isTomorrow || isYesterday || isPastDate) && isNotDone) {
              pendingAccounts.push(rowData)
            }
          } else {
            // For all other users: normal logic (today, tomorrow, past dates)
            if ((isToday || isTomorrow || isPastDate) && isNotDone) {
              pendingAccounts.push(rowData)
            }
          }
        }
      })

      const sortedMembers = Array.from(membersSet).sort()
      setMembersList(sortedMembers)
      // Preserve any image a user has locally attached but not submitted yet —
      // a background refresh (15s poll) would otherwise overwrite accountData
      // with fresh server data that has no idea about that local attachment,
      // making the just-picked image silently disappear before submit.
      setAccountData((prev) => {
        const localImages = new Map()
        prev.forEach((item) => {
          if (item.image) localImages.set(item._id, item.image)
        })
        return localImages.size > 0
          ? pendingAccounts.map((item) =>
              localImages.has(item._id) ? { ...item, image: localImages.get(item._id) } : item
            )
          : pendingAccounts
      })
      setHistoryData(historyRows)
      hasLoadedOnceRef.current = true
      // Removed localStorage caching to guarantee 100% real-time data & avoid cross-user leakage
      if (!isBackground) setLoading(false)

      // Background multi-stage parallel loader to fetch complete history across ALL dates
      const fetchFullHistoricalData = async () => {
        try {
          let countQuery = supabase.from('Checklist').select('*', { count: 'exact', head: true });
          if (currentUserRole !== "admin" && currentUsername) {
            countQuery = countQuery.ilike('Name', currentUsername.trim());
          }
          const { count, error: cErr } = await countQuery;
          if (cErr || !count || count <= 2500) return;

          const total = count;
          const PAGE_SIZE = 1000;
          const totalPages = Math.ceil(total / PAGE_SIZE);
          const CONCURRENT_BATCH = 10;
          const allHistory = [...historyRows];
          const seenIds = new Set(historyRows.map(h => String(h._taskId || h._id)));

          for (let i = 2; i < totalPages; i += CONCURRENT_BATCH) {
            const pagePromises = [];
            for (let j = i; j < Math.min(i + CONCURRENT_BATCH, totalPages); j++) {
              const from = j * PAGE_SIZE;
              const to = Math.min((j + 1) * PAGE_SIZE - 1, total - 1);
              let pQuery = supabase
                .from('Checklist')
                .select('*')
                .order('Task ID', { ascending: false })
                .range(from, to);
              if (currentUserRole !== "admin" && currentUsername) {
                pQuery = pQuery.ilike('Name', currentUsername.trim());
              }
              pagePromises.push(pQuery);
            }
            const results = await Promise.all(pagePromises);
            for (const res of results) {
              if (res.data) {
                res.data.forEach((r) => {
                  const assignedTo = r['Name'] || "Unassigned";
                  const isUserHistoryMatch = currentUserRole === "admin" || assignedTo.toLowerCase() === currentUsername.toLowerCase();
                  if (!isUserHistoryMatch) return;

                  const columnGValue = r['Task Start Date'];
                  const columnKValue = r['Actual'];
                  const columnPValue = r['Admin Done'];
                  const columnQValue = r['Leave'];

                  const hasColumnG = !isEmpty(columnGValue);
                  const hasColumnK = !isEmpty(columnKValue);
                  const isAdminDone = !isEmpty(columnPValue) && columnPValue.toString().trim() === "Admin Done";
                  const isLeave = isLeaveStatus(columnQValue);

                  const isCompleted = hasColumnK || isAdminDone || isLeave;
                  const taskId = r['Task ID'] || "";
                  const key = String(taskId || `idx_${allHistory.length}`);

                  if (hasColumnG && isCompleted && !seenIds.has(key)) {
                    seenIds.add(key);
                    const rowData = {
                      _id: taskId ? `task_${taskId}_${allHistory.length}` : `row_${allHistory.length}_${Math.random().toString(36).substring(2, 9)}`,
                      _rowIndex: allHistory.length + 1,
                      _taskId: taskId,
                      col0: r['Timestamp'] || '',
                      col1: r['Task ID'] || '',
                      col2: r['Department'] || r['Firm'] || '',
                      col3: r['Given By'] || '',
                      col4: r['Name'] || '',
                      col5: r['Tast Descriptions'] || r['Task Description'] || '',
                      col6: parseGoogleSheetsDateTime(String(r['Task Start Date'] || '')),
                      col7: r['Freq'] || '',
                      col8: r['Enable Reminders'] || '',
                      col9: r['Require Attachment'] || '',
                      col10: r['Actual'] ? parseGoogleSheetsDateTime(String(r['Actual'])) : '',
                      col11: r['Delay'] || '',
                      col12: r['Status'] || '',
                      col13: r['Remarks'] || '',
                      col14: r['Uploaded Image'] || '',
                      col15: r['Admin Done'] || '',
                      col16: r['Leave'] || '',
                      col17: r['Work Type'] || '',
                    };
                    allHistory.push(rowData);
                  }
                });
              }
            }
          }
          if (allHistory.length > historyRows.length) {
            setHistoryData(allHistory);
          }
        } catch (hErr) {
          console.warn('Background full history fetch:', hErr);
        }
      };

      fetchFullHistoricalData();
    } catch (error) {
      console.error("Error fetching sheet data:", error)
      if (!isBackground || !hasLoadedOnceRef.current) {
        setError("Failed to load account data: " + error.message)
      }
      if (!isBackground) setLoading(false)
    } finally {
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    // 100% Real-time direct fetch on page load
    fetchSheetData(false)
  }, [fetchSheetData])

  // Near-real-time refresh driven by Supabase realtime instead of a 45s poll:
  // the page only re-fetches when Checklist actually changes. A long fallback
  // covers a dropped socket, and nothing is fetched while the tab is hidden —
  // a hidden tab just refreshes once when it becomes visible again.
  useEffect(() => {
    let debounceTimer
    let staleWhileHidden = false

    const refresh = () => {
      if (document.hidden) {
        staleWhileHidden = true
        return
      }
      fetchSheetData(true)
    }

    const debouncedRefresh = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(refresh, 3000)
    }

    const channel = supabase
      .channel('checklist-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Checklist' }, debouncedRefresh)
      .subscribe()

    const fallbackInterval = setInterval(refresh, 5 * 60 * 1000)

    const onVisibilityChange = () => {
      if (!document.hidden && staleWhileHidden) {
        staleWhileHidden = false
        fetchSheetData(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearTimeout(debounceTimer)
      clearInterval(fallbackInterval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [fetchSheetData])

  // Checkbox handlers with better state management
  const handleSelectItem = useCallback((id, isChecked) => {
    console.log(`Checkbox action: ${id} -> ${isChecked}`)
    setSelectedItems((prev) => {
      const newSelected = new Set(prev)
      if (isChecked) {
        newSelected.add(id)
      } else {
        newSelected.delete(id)
        // Clean up related data when unchecking
        setAdditionalData((prevData) => {
          const newAdditionalData = { ...prevData }
          delete newAdditionalData[id]
          return newAdditionalData
        })
        setRemarksData((prevRemarks) => {
          const newRemarksData = { ...prevRemarks }
          delete newRemarksData[id]
          return newRemarksData
        })
      }
      console.log(`Updated selection: ${Array.from(newSelected)}`)
      return newSelected
    })
  }, [])

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation()
      const isChecked = e.target.checked
      console.log(`Checkbox clicked: ${id}, checked: ${isChecked}`)
      handleSelectItem(id, isChecked)
    },
    [handleSelectItem],
  )

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation();
      const checked = e.target.checked;

      if (checked) {
        // Only select items that are not disabled (today's tasks only)
        const enabledIds = filteredAccountData
          .filter((item) => {
            const taskStatus = getTaskStatus(item["col10"], item["col15"], item["col6"]);
            return taskStatus !== "Admin Done" && taskStatus !== "Done" && taskStatus !== "Disabled";
          })
          .map((item) => item._id);

        setSelectedItems(new Set(enabledIds));
        console.log(`Selected all enabled items: ${enabledIds}`);
      } else {
        setSelectedItems(new Set());
        setAdditionalData({});
        setRemarksData({});
        console.log("Cleared all selections");
      }
    },
    [filteredAccountData],
  );

  // Add these optimized handlers inside the component
  const handleAdditionalDataChange = useCallback((id, value) => {
    setAdditionalData((prev) => ({ ...prev, [id]: value }))
    if (value !== "No") {
      setRemarksData((prev) => {
        const newData = { ...prev }
        delete newData[id]
        return newData
      })
    }
  }, [])

  const handleRemarksChange = useCallback((id, value) => {
    setRemarksData((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleLoadMore = useCallback(() => {
    if (displayLimit < filteredAccountData.length && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayLimit(prev => Math.min(prev + 500, filteredAccountData.length));
        setIsLoadingMore(false);
      }, 300);
    }
  }, [displayLimit, filteredAccountData.length, isLoadingMore]);

  useEffect(() => {
    setDisplayLimit(500);
  }, [debouncedSearchTerm, selectedStatus, selectedMembers, startDate, endDate, workTypeFilter]);

  useEffect(() => {
    setHistoryDisplayLimit(500);
  }, [debouncedSearchTerm, selectedStatus, selectedMembers, startDate, endDate, showHistory, workTypeFilter]);

  const displayedAccountData = useMemo(() => {
    return filteredAccountData.slice(0, displayLimit);
  }, [filteredAccountData, displayLimit]);

  const handleImageUpload = useCallback(async (id, e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setAccountData((prev) => {
      const updated = prev.map((item) => {
        if (item._id === id) {
          // If we want to revoke object URLs, we'd need to track them, 
          // but creating them in render is fine for small amounts.
          return { ...item, image: files }
        }
        return item
      })
      return updated
    })
  }, [])

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
    })
  }

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev)
    resetFilters()
  }, [resetFilters])

  // MAIN SUBMIT FUNCTION
  const handleSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);
    if (selectedItemsArray.length === 0) {
      alert("Please select at least one item to submit");
      return;
    }

    const missingRemarks = selectedItemsArray.filter((id) => {
      const additionalStatus = additionalData[id];
      const remarks = remarksData[id];
      return additionalStatus === "No" && (!remarks || remarks.trim() === "");
    });

    if (missingRemarks.length > 0) {
      alert(`Please provide remarks for items marked as "No". ${missingRemarks.length} item(s) are missing remarks.`);
      return;
    }

    const missingRequiredImages = selectedItemsArray.filter((id) => {
      const item = accountData.find((account) => account._id === id);
      const requiresAttachment = item["col9"] && item["col9"].toUpperCase() === "YES";
      return requiresAttachment && (!item.image || (Array.isArray(item.image) && item.image.length === 0));
    });

    if (missingRequiredImages.length > 0) {
      alert(
        `Please upload images for all required attachments. ${missingRequiredImages.length} item(s) are missing required images.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentTimestamp = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const todayFormatted = formatDateToDDMMYYYY(now);

      const imageUrlMap = {};

      for (const id of selectedItemsArray) {
        const item = accountData.find((account) => account._id === id);
        if (!item) continue;

        if (Array.isArray(item.image) && item.image.length > 0) {
          const urls = [];
          for (const file of item.image) {
            if (file instanceof File) {
              try {
                const url = await uploadImageToCloudinary(file);
                if (url) urls.push(url);
              } catch (uploadErr) {
                console.error("Cloudinary upload error:", uploadErr);
              }
            }
          }
          imageUrlMap[id] = urls.join(", ");
        } else if (item.image instanceof File) {
          try {
            const url = await uploadImageToCloudinary(item.image);
            if (url) imageUrlMap[id] = url;
          } catch (uploadErr) {
            console.error("Cloudinary upload error:", uploadErr);
          }
        }
      }

      // Update in Supabase Checklist table
      for (const id of selectedItemsArray) {
        const item = accountData.find((account) => account._id === id);
        if (!item) continue;

        const taskId = item['col1'] ? parseInt(item['col1'], 10) : item._taskId;

        const updatePayload = {
          Actual: currentTimestamp,
          Status: additionalData[id] || "Yes",
          Remarks: remarksData[id] || "",
        };

        if (imageUrlMap[id]) {
          updatePayload['Uploaded Image'] = imageUrlMap[id];
        }

        const { error: updateErr } = await supabase
          .from('Checklist')
          .update(updatePayload)
          .eq('Task ID', taskId);

        if (updateErr) {
          console.error("Failed to update task in Supabase:", taskId, updateErr);
        }
      }

      // Optimistic UI updates
      const submittedItemsForHistory = selectedItemsArray.map((id) => {
        const item = accountData.find((account) => account._id === id);
        return {
          ...item,
          col10: todayFormatted,
          col12: additionalData[id] || "Yes",
          col13: remarksData[id] || "",
          col14: imageUrlMap[id] || (item.image && typeof item.image === "string" ? item.image : ""),
        };
      });

      // Update local state
      setAccountData((prev) => prev.filter((item) => !selectedItems.has(item._id)));
      setHistoryData((prev) => [...submittedItemsForHistory, ...prev]);
      setSelectedItems(new Set());
      setAdditionalData({});
      setRemarksData({});
      setSuccessMessage(`Successfully submitted ${selectedItemsArray.length} task(s)!`);

      // Refresh data
      await fetchSheetData();
    } catch (error) {
      console.error("Submission error:", error);
      alert("Error occurred during submission: " + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert Set to Array for display
  const selectedItemsCount = selectedItems.size

  // Filter Section inline rendering
  const renderFilterSection = () => {
    const filteredMembersList = getFilteredMembersList().filter(member =>
      member.toLowerCase().includes(nameSearchTerm.toLowerCase())
    );

    return (
      <div className="p-4 border-b border-purple-100 bg-gray-50">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* Status Filter (Only on Active Tasks page) */}
          {!showHistory && (
            <div className="flex flex-col">
              <label className="text-sm font-medium text-purple-700 mb-1">
                Filter by Status:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border-2 border-purple-300 rounded-xl px-4 py-2 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-[0_4px_10px_rgba(168,85,247,0.2)] transition-all cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="Pending">Pending (Today Only)</option>
                <option value="Disabled">Overdue</option>
              </select>
            </div>
          )}

          {/* Work Type Filter */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-purple-700 mb-1">
              Filter by Work Type:
            </label>
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="bg-white border-2 border-purple-300 rounded-xl px-4 py-2 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-[0_4px_10px_rgba(168,85,247,0.2)] transition-all cursor-pointer"
            >
              <option value="">All Work Types</option>
              <option value="Task">Task</option>
              <option value="Meeting">Meeting</option>
              <option value="Report">Report</option>
            </select>
          </div>

          {/* Name/Member Filter with Search Dropdown */}
          {getFilteredMembersList().length > 0 && (
            <div className="flex flex-col relative">
              <label className="text-sm font-medium text-purple-700 mb-1">
                Filter by Member:
              </label>
              <div className="relative">
                {/* Search input that triggers dropdown */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={14}
                  />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={nameSearchTerm}
                    onChange={(e) => setNameSearchTerm(e.target.value)}
                    onClick={() => setIsDropdownOpen(true)}
                    className="bg-white border-2 border-purple-300 rounded-xl pl-8 pr-4 py-2 text-sm w-[200px] focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-[0_4px_10px_rgba(168,85,247,0.2)] transition-all cursor-text placeholder-gray-500"
                  />
                </div>

                {/* Dropdown - only shows when clicked and has items */}
                {isDropdownOpen && filteredMembersList.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-md bg-white shadow-lg">
                    <div className="space-y-2">
                      {filteredMembersList.map((member, idx) => (
                        <div key={idx} className="flex items-center">
                          <input
                            id={`member-${idx}`}
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            checked={selectedMembers.includes(member)}
                            onChange={() => handleMemberSelection(member)}
                          />
                          <label
                            htmlFor={`member-${idx}`}
                            className="ml-2 text-sm text-gray-700 whitespace-nowrap"
                          >
                            {member}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected members display */}
                {selectedMembers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedMembers.map((member) => (
                      <span
                        key={member}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                      >
                        {member}
                        <button
                          onClick={() => handleMemberSelection(member)}
                          className="ml-1 text-purple-600 hover:text-purple-800"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Date Range Filter */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-purple-700 mb-1">
              Filter by Date Range:
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <label
                  htmlFor="start-date"
                  className="text-sm text-gray-700 mr-1"
                >
                  From
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border-2 border-purple-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-[0_4px_10px_rgba(168,85,247,0.2)] transition-all cursor-pointer"
                />
              </div>
              <div className="flex items-center">
                <label
                  htmlFor="end-date"
                  className="text-sm text-gray-700 mr-1"
                >
                  To
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border-2 border-purple-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-[0_4px_10px_rgba(168,85,247,0.2)] transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Attachment Filter */}
          {showHistory && (
            <div className="flex flex-col">
              <label className="text-sm font-medium text-purple-700 mb-1">
                Filter by Picture:
              </label>
              <select
                value={attachmentFilter}
                onChange={(e) => setAttachmentFilter(e.target.value)}
                className="bg-white border-2 border-purple-300 rounded-xl px-4 py-2 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-[0_4px_10px_rgba(168,85,247,0.2)] transition-all cursor-pointer"
              >
                <option value="">All Uploads</option>
                <option value="HasPic">Pic Uploaded</option>
                <option value="NoPic">No Pic Uploaded</option>
              </select>
            </div>
          )}

          {/* Clear Filters Button */}
          {(selectedMembers.length > 0 ||
            startDate ||
            endDate ||
            searchTerm ||
            selectedStatus ||
            workTypeFilter ||
            nameSearchTerm) && (
              <button
                onClick={() => {
                  resetFilters();
                  setIsDropdownOpen(false);
                }}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm self-end"
              >
                Clear All Filters
              </button>
            )}
        </div>
      </div>
    );
  };



  // Leave Handler
  const handleLeave = async () => {
    // Get today's date string
    const today = new Date();
    const todayStr = formatDateToDDMMYYYY(today);

    // Determine candidate tasks: If items are selected, use those. Otherwise use all filtered items (Bulk action).
    const candidates = selectedItems.size > 0
      ? filteredAccountData.filter(item => selectedItems.has(item._id))
      : filteredAccountData;

    // Filter tasks that match today's date
    const todaysTasks = candidates.filter(task => {
      const hasColumnG = !isEmpty(task["col6"]); // Task Start Date
      if (!hasColumnG) return false;

      const rowDateStr = String(task["col6"]).trim();
      let formattedRowDate = parseGoogleSheetsDateTime(rowDateStr); // returns DD/MM/YYYY or DD/MM/YYYY HH:MM:SS

      // Strip time if present to ensure date-only comparison
      if (formattedRowDate && formattedRowDate.includes(" ")) {
        formattedRowDate = formattedRowDate.split(" ")[0];
      }

      if (formattedRowDate !== todayStr) return false;

      // Check if Column K (Index 10) is empty
      const isActualEmpty = isEmpty(task["col10"]);
      if (!isActualEmpty) return false;

      // Ensure it's not already done or leave
      const isLeave = isLeaveStatus(task["col16"]);
      if (isLeave) return false;

      return true;
    });

    if (todaysTasks.length === 0) {
      alert("No pending tasks found for today in the current view to mark as Leave.");
      return;
    }

    const confirmLeave = window.confirm(`Are you sure you want to mark ${todaysTasks.length} visible pending task(s) for TODAY as Leave?`);
    if (!confirmLeave) return;

    setIsSubmitting(true);
    try {
      // Process updates SEQUENTIALLY to avoid Google Apps Script rate limits/lock contention
      // This solves the CORS/Network error issue when updating multiple rows
      for (const item of todaysTasks) {
        const formData = new FormData();
        formData.append("sheetName", CONFIG.SHEET_NAME);
        formData.append("action", "update");
        formData.append("rowIndex", item._rowIndex);

        const rowData = Array(17).fill("");
        // Update Column K (Index 10) with today's date and Column Q (Index 16) with "Leave"
        rowData[10] = todayStr; // Index 10 is Column K (Actual Date)
        rowData[16] = "Leave"; // Index 16 is Column Q (Leave Status)

        formData.append("rowData", JSON.stringify(rowData));

        await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: "POST",
          body: formData,
        }).then(res => res.json()); // Wait for each request to complete
      }

      // Batch update local state
      setAccountData((prev) => prev.map(item => {
        if (todaysTasks.find(t => t._id === item._id)) {
          // Update Col 16 (Leave) AND Col 10 (Actual Date)
          return { ...item, col10: todayStr, col16: "Leave" }
        }
        return item;
      }));

      setSelectedItems(new Set());
      setSuccessMessage(`Successfully marked ${todaysTasks.length} task(s) as Leave!`);

    } catch (error) {
      console.error("Leave update error:", error);
      alert("Error occurred while marking as Leave. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-purple-700">
            {showHistory
              ? CONFIG.PAGE_CONFIG.historyTitle
              : CONFIG.PAGE_CONFIG.title}
          </h1>

          {/* Search Input */}
          <div className="relative w-full sm:w-auto flex-grow max-w-md mx-auto sm:mx-0 group">
            <input
              type="text"
              placeholder={showHistory ? "Search history..." : "Search tasks..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-purple-200/60 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500/30 w-full text-sm bg-white/60 backdrop-blur-sm transition-all shadow-sm hover:shadow-md hover:bg-white"
            />
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-400 group-hover:text-purple-600 transition-colors">
              <Search size={16} strokeWidth={2.5} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            {/* Refresh Button */}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center py-2 px-4 bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 shadow-sm text-sm font-medium w-full sm:min-w-[100px] sm:w-auto group"
              title="Hard Refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2 group-hover:animate-spin" />
              Refresh
            </button>

            {/* Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center py-2 px-4 bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 shadow-sm text-sm font-medium w-full sm:min-w-[100px] sm:w-auto"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>

            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center justify-center py-2 px-4 bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 shadow-sm text-sm font-medium w-full sm:min-w-[100px] sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>

            {/* History Toggle Button */}
            <button
              onClick={toggleHistory}
              className="flex items-center justify-center py-2 px-4 bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 shadow-sm text-sm font-medium w-full sm:min-w-[140px] sm:w-auto"
            >
              {showHistory ? (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Tasks
                </>
              ) : (
                <>
                  <History className="h-4 w-4 mr-2" />
                  History
                </>
              )}
            </button>

            {/* Admin Mark Done (History View) */}
            {showHistory && userRole === "admin" && selectedHistoryItems.length > 0 && (
              <button
                onClick={handleMarkMultipleDone}
                disabled={markingAsDone}
                className="flex items-center justify-center py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 shadow-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full sm:min-w-[140px] sm:w-auto"
              >
                {markingAsDone ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing
                  </span>
                ) : (
                  "Mark Admin Done"
                )}
              </button>
            )}

            {/* Task Actions (Tasks View) */}
            {!showHistory && (
              <>
                {/* Leave Button */}
                {/* <button
                  onClick={handleLeave}
                  disabled={isSubmitting}
                  className="flex items-center justify-center py-2 px-4 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200 transition-all duration-200 shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                >
                  Leave
                </button> */}

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={selectedItemsCount === 0 || isSubmitting}
                  className="flex items-center justify-center py-2 px-6 gradient-bg text-white rounded-lg hover:shadow-lg transition-all duration-200 shadow-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 w-full sm:min-w-[140px] sm:w-auto"
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      ...
                    </span>
                  ) : (
                    `Submit (${selectedItemsCount})`
                  )}
                </button>
              </>
            )}
          </div>

          {/* Admin Mark Done Button - Show in both mobile and desktop when conditions are met */}
          {/* {showHistory &&
            userRole === "admin" &&
            selectedHistoryItems.length > 0 && (
              <div className="sm:hidden w-full mt-2">
                <button
                  onClick={handleMarkMultipleDone}
                  disabled={markingAsDone}
                  className="w-full gradient-bg py-3 px-4 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {markingAsDone
                    ? "Processing..."
                    : `Mark ${selectedHistoryItems.length} Items as Admin Done`}
                </button>
              </div>
            )} */}
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              {successMessage}
            </div>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-green-500 hover:text-green-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
            <h2 className="text-purple-700 font-medium">
              {showHistory
                ? `Completed ${CONFIG.SHEET_NAME} Tasks`
                : `All ${CONFIG.SHEET_NAME} Tasks`}
            </h2>
            <p className="text-purple-600 text-sm">
              {showHistory
                ? `${CONFIG.PAGE_CONFIG.historyDescription} for ${userRole === "admin" ? "all" : "your"
                } tasks`
                : CONFIG.PAGE_CONFIG.description}
            </p>
          </div>

          {/* Filter Section */}
          {showFilters && renderFilterSection()}

          {loading ? (
            <div className="text-center py-12 flex justify-center">
              <div className="luxury-loader-card">
                <div className="luxury-spinner-box">
                  <div className="luxury-aura"></div>
                  <div className="luxury-track"></div>
                  <div className="luxury-ring-outer"></div>
                  <div className="luxury-ring-inner"></div>
                  <div className="luxury-core">
                    <div className="luxury-core-wave"></div>
                  </div>
                </div>
                <p className="luxury-text-title">Loading task data...</p>
                <p className="luxury-text-subtitle">Syncing with Google Sheets</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800 text-center">
              {error}{" "}
              <button
                className="underline ml-2"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : showHistory ? (
            <>
              {/* Confirmation Modal */}
              <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                itemCount={confirmationModal.itemCount}
                onConfirm={confirmMarkDone}
                onCancel={() =>
                  setConfirmationModal({ isOpen: false, itemCount: 0 })
                }
              />

              {/* Task Statistics */}
              <div className="p-4 border-b border-purple-100 bg-blue-50">
                <div className="flex flex-col">
                  <h3 className="text-sm font-medium text-blue-700 mb-2">
                    Task Completion Statistics:
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="px-3 py-2 bg-white rounded-md shadow-sm">
                      <span className="text-xs text-gray-500">
                        Total Completed
                      </span>
                      <div className="text-lg font-semibold text-blue-600">
                        {getTaskStatistics().totalCompleted}
                      </div>
                    </div>
                    {(selectedMembers.length > 0 ||
                      startDate ||
                      endDate ||
                      searchTerm ||
                      selectedStatus ||
                      workTypeFilter) && (
                        <div className="px-3 py-2 bg-white rounded-md shadow-sm">
                          <span className="text-xs text-gray-500">
                            Filtered Results
                          </span>
                          <div className="text-lg font-semibold text-blue-600">
                            {getTaskStatistics().filteredTotal}
                          </div>
                        </div>
                      )}
                    {selectedMembers.map((member) => (
                      <div
                        key={member}
                        className="px-3 py-2 bg-white rounded-md shadow-sm"
                      >
                        <span className="text-xs text-gray-500">{member}</span>
                        <div className="text-lg font-semibold text-indigo-600">
                          {getTaskStatistics().memberStats[member]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* History Table */}
              <div className="overflow-x-auto sticky top-0 max-h-[calc(100vh-300px)] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {/* Add this column header after the Admin Done column (if admin) or at the end */}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                        Edit
                      </th>
                      {/* Submission Status Column Header */}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 min-w-[120px]">
                        Submission Status
                      </th>
                      {/* Admin Select Column Header */}
                      {userRole === "admin" && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          <div className="flex flex-col items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              checked={
                                // Only consider items that are NOT "Admin Done" for select all
                                filteredHistoryData.filter(
                                  (item) =>
                                    isEmpty(item["col15"]) ||
                                    item["col15"].toString().trim() !==
                                    "Admin Done"
                                ).length > 0 &&
                                selectedHistoryItems.length ===
                                filteredHistoryData.filter(
                                  (item) =>
                                    isEmpty(item["col15"]) ||
                                    item["col15"].toString().trim() !==
                                    "Admin Done"
                                ).length
                              }
                              onChange={(e) => {
                                // Only select items that are NOT "Admin Done"
                                const unprocessedItems =
                                  filteredHistoryData.filter(
                                    (item) =>
                                      isEmpty(item["col15"]) ||
                                      item["col15"].toString().trim() !==
                                      "Admin Done"
                                  );
                                if (e.target.checked) {
                                  setSelectedHistoryItems(unprocessedItems);
                                } else {
                                  setSelectedHistoryItems([]);
                                }
                              }}
                            />
                            <span className="text-xs text-gray-400 mt-1">
                              Admin
                            </span>
                          </div>
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Task ID
                      </th>


                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Name
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Task Description
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 min-w-[80px]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50 min-w-[150px]">
                        Remarks
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 min-w-[140px]">
                        Task Start Date & Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                        Freq / Work Type
                      </th>


                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50 min-w-[140px]">
                        Actual Date & Time
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Attachment
                      </th>
                      {/* Admin Done Date Column */}
                      {userRole === "admin" && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[140px]">
                          Admin Done
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayedHistoryData.length > 0 ? (
                      <>
                        {displayedHistoryData.map((history) => {
                          const submissionStatus = getSubmissionStatus(
                            history["col10"],
                            history["col11"],
                            history["col16"]
                          );
                          return (
                            <tr key={history._id} className="hover:bg-gray-50">
                              {/* Add this cell at the end of each row, after the Admin Done column (if admin) */}
                              <td className="px-3 py-4 min-w-[80px]">
                                {editingRemarks[history._id] ? (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() =>
                                        handleEditRemarks(
                                          history._id,
                                          history["col13"],
                                          history
                                        )
                                      }
                                      className="text-green-600 hover:text-green-800"
                                      title="Save"
                                    >
                                      <CheckCircle2 size={20} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setEditingRemarks((prev) => ({
                                          ...prev,
                                          [history._id]: false,
                                        }))
                                      }
                                      className="text-red-600 hover:text-red-800"
                                      title="Cancel"
                                    >
                                      <X size={20} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingRemarks((prev) => ({
                                        ...prev,
                                        [history._id]: true,
                                      }))
                                    }
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Edit Remarks"
                                  >
                                    <Edit size={20} />
                                  </button>
                                )}
                              </td>
                              {/* Submission Status Column */}
                              <td className="px-3 py-4 bg-blue-50 min-w-[120px]">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${submissionStatus.color === "green"
                                    ? "bg-green-100 text-green-800"
                                    : submissionStatus.color === "red"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                    }`}
                                >
                                  {submissionStatus.status}
                                </span>
                              </td>
                              {/* Admin Select Checkbox */}
                              {userRole === "admin" && (
                                <td className="px-3 py-4 w-12">
                                  {!isEmpty(history["col15"]) &&
                                    history["col15"].toString().trim() ===
                                    "Admin Done" ? (
                                    <div className="flex flex-col items-center">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 bg-green-100"
                                        checked={true}
                                        disabled={true}
                                        title="Admin Done"
                                      />
                                      <span className="text-xs text-green-600 mt-1 text-center break-words">
                                        Done
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        checked={selectedHistoryItems.some(
                                          (item) => item._id === history._id
                                        )}
                                        onChange={() => {
                                          setSelectedHistoryItems((prev) =>
                                            prev.some(
                                              (item) => item._id === history._id
                                            )
                                              ? prev.filter(
                                                (item) =>
                                                  item._id !== history._id
                                              )
                                              : [...prev, history]
                                          );
                                        }}
                                      />
                                      <span className="text-xs text-gray-400 mt-1 text-center break-words">
                                        Mark Done
                                      </span>
                                    </div>
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-4 min-w-[100px]">
                                <div className="text-sm font-medium text-gray-900 break-words">
                                  {history["col1"] || "—"}
                                </div>
                              </td>

                              {/* Name */}
                              <td className="px-3 py-4 min-w-[100px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col4"] || "—"}
                                </div>
                              </td>

                              {/* Task Description */}
                              <td className="px-3 py-4 min-w-[200px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col5"] || "—"}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="px-3 py-4 bg-blue-50 min-w-[80px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col12"] || "—"}
                                </div>
                              </td>

                              {/* Remarks */}
                              <td className="px-3 py-4 bg-purple-50 min-w-[150px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col13"] || "—"}
                                </div>
                              </td>

                              {/* Task Start Date & Time */}
                              <td className="px-3 py-4 bg-yellow-50 min-w-[140px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col6"] ? (
                                    <div>
                                      <div className="font-medium break-words">
                                        {history["col6"].includes(" ")
                                          ? history["col6"].split(" ")[0]
                                          : history["col6"]}
                                      </div>
                                      {history["col6"].includes(" ") && (
                                        <div className="text-xs text-gray-500 break-words">
                                          {history["col6"].split(" ")[1]}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </div>
                              </td>

                              {/* Freq / Work Type */}
                              <td className="px-3 py-4 min-w-[110px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col7"] || "—"}
                                </div>
                                <span className={`mt-1 inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${getWorkTypeColor(history["col17"])}`}>
                                  {history["col17"] || "Task"}
                                </span>
                              </td>

                              {/* Actual Date & Time */}
                              <td className="px-3 py-4 bg-green-50 min-w-[140px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col10"] ? (
                                    <div>
                                      <div className="font-medium break-words">
                                        {history["col10"].includes(" ")
                                          ? history["col10"].split(" ")[0]
                                          : history["col10"]}
                                      </div>
                                      {history["col10"].includes(" ") && (
                                        <div className="text-xs text-gray-500 break-words">
                                          {history["col10"].split(" ")[1]}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </div>
                              </td>

                              {/* Attachment */}
                              <td className="px-3 py-4 min-w-[100px]">
                                {history["col14"] ? (
                                  <div className="flex gap-2 flex-wrap">
                                    {history["col14"].split(',').map(url => url.trim()).filter(Boolean).map((url, index) => (
                                      <a
                                        key={index}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative group block w-14 h-14 rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-all flex-shrink-0"
                                      >
                                        <img
                                          src={url}
                                          alt={`Attachment ${index + 1}`}
                                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                          onError={(e) => {
                                            e.target.onerror = null;
                                            if (url.match(/\.pdf|\.doc|\.xls|\.csv|\.txt|\.zip|\.rar/i)) {
                                              e.target.src = "https://img.icons8.com/color/48/document--v1.png";
                                            } else {
                                              e.target.src = "https://img.icons8.com/color/48/image.png";
                                            }
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                          <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                          </div>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">
                                    No attachment
                                  </span>
                                )}
                              </td>

                              {/* Admin Done Column */}
                              {userRole === "admin" && (
                                <td className="px-3 py-4 bg-gray-50 min-w-[140px]">
                                  {!isEmpty(history["col15"]) &&
                                    history["col15"].toString().trim() ===
                                    "Admin Done" ? (
                                    <div className="text-sm text-gray-900 break-words">
                                      <div className="flex items-center">
                                        <div className="h-4 w-4 rounded border-gray-300 text-green-600 bg-green-100 mr-2 flex items-center justify-center">
                                          <span className="text-xs text-green-600">
                                            ✓
                                          </span>
                                        </div>
                                        <div className="flex flex-col">
                                          <div className="font-medium text-green-700 text-sm">
                                            Done
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-gray-400 text-sm">
                                      <div className="h-4 w-4 rounded border-gray-300 mr-2"></div>
                                      <span>Pending</span>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {/* Load More Button for History */}
                        {historyDisplayLimit < filteredHistoryData.length && (
                          <tr>
                            <td
                              colSpan={userRole === "admin" ? 16 : 14}
                              className="px-6 py-4 text-center"
                            >
                              <button
                                onClick={handleLoadMoreHistory}
                                disabled={isLoadingMoreHistory}
                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoadingMoreHistory ? (
                                  <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                    Loading...
                                  </div>
                                ) : (
                                  `Load More (${filteredHistoryData.length -
                                  historyDisplayLimit
                                  } remaining)`
                                )}
                              </button>
                            </td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <tr>
                        <td
                          colSpan={userRole === "admin" ? 16 : 14}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          {searchTerm ||
                            selectedMembers.length > 0 ||
                            startDate ||
                            endDate ||
                            selectedStatus
                            ? "No historical records matching your filters"
                            : "No completed records found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="overflow-x-auto sticky top-0 max-h-[calc(100vh-250px)] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-40">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12 sticky left-0 z-50 bg-gray-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          checked={
                            // Only consider enabled items for select all
                            filteredAccountData.filter((item) => {
                              const taskStatus = getTaskStatus(
                                item["col10"],
                                item["col15"],
                                item["col6"]
                              );
                              return (
                                taskStatus !== "Admin Done" &&
                                taskStatus !== "Done" &&
                                taskStatus !== "Disabled"
                              );
                            }).length > 0 &&
                            selectedItems.size ===
                            filteredAccountData.filter((item) => {
                              const taskStatus = getTaskStatus(
                                item["col10"],
                                item["col15"],
                                item["col6"]
                              );
                              return (
                                taskStatus !== "Admin Done" &&
                                taskStatus !== "Done" &&
                                taskStatus !== "Disabled"
                              );
                            }).length
                          }
                          onChange={handleSelectAllItems}
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20 sticky left-12 z-50 bg-gray-50">
                        Task ID
                      </th>
                      {/* Status Column Header */}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                        Status
                      </th>


                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Name
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                        Remarks
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Task Description
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 min-w-[140px]">
                        Task Start Date & Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                        Freq / Work Type
                      </th>


                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Upload Image
                        <span className="block normal-case text-[10px] font-normal text-gray-400">Max 10MB</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayedAccountData.map((account) => (
                      <MemoizedTaskRow
                        key={account._id}
                        account={account}
                        isSelected={selectedItems.has(account._id)}
                        additionalData={additionalData[account._id]}
                        remarksData={remarksData[account._id]}
                        onCheckboxClick={handleCheckboxClick}
                        onAdditionalDataChange={handleAdditionalDataChange}
                        onRemarksChange={handleRemarksChange}
                        onImageUpload={handleImageUpload}
                      />
                    ))}

                    {/* Load More Button */}
                    {displayLimit < filteredAccountData.length && (
                      <tr>
                        <td colSpan={14} className="px-6 py-4 text-center">
                          <button
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingMore ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                Loading...
                              </div>
                            ) : (
                              `Load More (${filteredAccountData.length - displayLimit
                              } remaining)`
                            )}
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Empty state */}
                    {filteredAccountData.length === 0 && (
                      <tr>
                        <td
                          colSpan={14}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          {searchTerm ||
                            selectedMembers.length > 0 ||
                            startDate ||
                            endDate ||
                            selectedStatus
                            ? "No tasks matching your filters"
                            : "No tasks found for today, tomorrow, or past due dates"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </>
          )}

          {/* Export Format Modal */}
          {showExportModal && (
            <div className="fixed inset-0 bg-gradient-to-b from-black/40 to-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-lg mx-4 shadow-2xl border border-white/20 overflow-hidden">
                {/* Header */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
                      <Download className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                      Export Data
                    </h2>
                  </div>
                  <p className="text-slate-500 text-sm ml-12">
                    Choose your preferred format to download the data
                  </p>
                </div>

                {/* Buttons */}
                <div className="space-y-4">
                  <button
                    onClick={exportToExcel}
                    className="w-full group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-green-500/30 active:scale-95 transform"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-3">
                      <div className="text-2xl">📊</div>
                      <div className="text-left">
                        <div className="font-bold text-white text-lg">Export as Excel</div>
                        <div className="text-green-100 text-xs">CSV Format • Easy to use</div>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  </button>

                  <button
                    onClick={exportToPdf}
                    className="w-full group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-red-500/30 active:scale-95 transform"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-3">
                      <div className="text-2xl">📄</div>
                      <div className="text-left">
                        <div className="font-bold text-white text-lg">Export as PDF</div>
                        <div className="text-red-100 text-xs">Professional Format • Print-ready</div>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-rose-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  </button>

                  <button
                    onClick={() => setShowExportModal(false)}
                    className="w-full group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-slate-200 to-slate-300 hover:from-slate-300 hover:to-slate-400 transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 transform mt-6"
                  >
                    <div className="relative z-10 font-semibold text-slate-700 group-hover:text-slate-800">
                      Cancel
                    </div>
                  </button>
                </div>

                {/* Footer Note */}
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                  <p className="text-xs text-slate-600 text-center">
                    💡 <span className="font-semibold">Tip:</span> Choose Excel for spreadsheets or PDF for reports and printing
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AccountDataPage