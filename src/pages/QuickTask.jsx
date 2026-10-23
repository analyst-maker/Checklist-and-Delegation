"use client"
import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { Search, ChevronDown, Filter, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import DelegationPage from "./delegation-data";

export default function QuickTask() {
  const [tasks, setTasks] = useState([]);
  const [delegationTasks, setDelegationTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [delegationLoading, setDelegationLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [activeTab, setActiveTab] = useState('checklist');
  const [checklistLoaded, setChecklistLoaded] = useState(false);
  const [delegationLoaded, setDelegationLoaded] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [nameSearchTerm, setNameSearchTerm] = useState('');
  const [freqFilter, setFreqFilter] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [dropdownOpen, setDropdownOpen] = useState({
    name: false,
    frequency: false
  });

  const CONFIG = {
    SHEET_ID: "1r3YHyjqv24gZXBI9IofAhodnlBuDTA3sgyzU_PNCaQg",
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec",
    WHATSAPP_SHEET: "Whatsapp", // For login credentials and user roles
    CHECKLIST_SHEET: "Unique", // For unique checklist tasks
    DELEGATION_SHEET: "Delegation", // For delegation tasks
    PAGE_CONFIG: {
      title: "Task Management",
      description: "Showing your tasks"
    }
  };

  // Auto-detect current user from login session and get role from Whatsapp sheet
  const fetchCurrentUser = useCallback(async () => {
    try {
      const loggedInUsername = sessionStorage.getItem('username');
      if (!loggedInUsername) {
        throw new Error("No user logged in. Please log in to access tasks.");
      }

      setUserLoading(true);
      setError(null);

      // LOW EGRESS: Query only the logged-in user's record and only needed fields
      const { data, error } = await supabase
        .from('Whatsapp')
        .select('"Username", "Role", "Department", "Given By", "Email"')
        .ilike('Username', loggedInUsername.trim())
        .limit(1);
      
      let foundUser = null;
      if (data && data.length > 0) {
        const userRow = data[0];
        foundUser = {
          name: userRow['Username'],
          role: (userRow['Role'] || "user").toLowerCase().trim(),
          department: userRow['Department'] || "",
          givenBy: userRow['Given By'] || "",
          email: userRow['Email'] || ""
        };
      }

      if (!foundUser) {
        const sessionRole = sessionStorage.getItem('role') || 'user';
        foundUser = {
          name: loggedInUsername,
          role: sessionRole.toLowerCase().trim(),
          department: "",
          givenBy: "",
          email: ""
        };
      }

      setCurrentUser(foundUser.name);
      setUserRole(foundUser.role);
    } catch (err) {
      console.error("Error fetching user:", err);
      const sessionRole = sessionStorage.getItem('role') || 'user';
      const loggedInUsername = sessionStorage.getItem('username');
      if (loggedInUsername) {
        setCurrentUser(loggedInUsername);
        setUserRole(sessionRole.toLowerCase().trim());
      } else {
        setError(err.message);
      }
    } finally {
      setUserLoading(false);
    }
  }, []);

  const fetchChecklistData = useCallback(async () => {
    const loggedInUsername = sessionStorage.getItem('username');
    const user = currentUser || loggedInUsername;
    if (!user || userLoading) return;

    setLoading(true);
    try {
      // LOW EGRESS: Select only needed columns and limit query size
      const activeRole = (userRole || sessionStorage.getItem('role') || 'user').toLowerCase().trim();
      let checklistQuery = supabase
        .from('Unique')
        .select('"Task ID", "Department", "Give By", "Name", "Task Description", "Task Start date", "Frequency", "Enable Reminder", "Require Attatchment"')
        .order('Task ID', { ascending: false })
        .limit(1000);
      if (activeRole !== 'admin' && user) {
        checklistQuery = checklistQuery.ilike('Name', user.trim());
      }
      const { data, error } = await checklistQuery;
      if (error) throw error;

      if (data && data.length > 0) {
        const transformedData = data.map((row, rowIndex) => {
          return {
            _id: `unique_${rowIndex}_${Math.random().toString(36).substring(2, 15)}`,
            _rowIndex: rowIndex + 2,
            Department: row['Department'] || "",
            'Given By': row['Give By'] || row['Given By'] || "Admin",
            Name: row['Name'] || "",
            'Task Description': row['Task Description'] || row['Tast Descriptions'] || "",
            'Start Date': row['Task Start date'] || row['Task Start Date'] || "",
            Frequency: row['Frequency'] || row['Freq'] || "daily",
            Reminders: row['Enable Reminder'] || row['Enable Reminders'] || "Yes",
            Attachment: row['Require Attatchment'] || row['Require Attachment'] || "No",
            Task: 'Checklist'
          };
        }).filter(item => {
          return Boolean(item['Task Description'] || item.Name) && item.Department !== 'Timestamp' && item.Department !== 'Department';
        });

        // Create unique tasks based on Name + Task Description combination
        const uniqueTasksMap = new Map();
        transformedData.forEach(task => {
          const key = `${(task.Name || '').toLowerCase().trim()}_${(task['Task Description'] || '').toLowerCase().trim()}`;
          if (!uniqueTasksMap.has(key)) {
            uniqueTasksMap.set(key, task);
          }
        });

        const uniqueTasks = Array.from(uniqueTasksMap.values());

        // Apply role-based filtering
        const activeRole = (userRole || sessionStorage.getItem('role') || 'user').toLowerCase();
        let filteredData;
        if (activeRole === 'admin') {
          filteredData = uniqueTasks;
        } else {
          filteredData = uniqueTasks.filter(item => {
            const itemName = (item.Name || '').toString().toLowerCase().trim();
            const currentUserLower = user.toLowerCase().trim();
            return itemName === currentUserLower;
          });
        }

        setTasks(filteredData);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error("Checklist fetch error:", err);
      setError(err.message || "Failed to load checklist data");
    } finally {
      setLoading(false);
    }
  }, [currentUser, userRole, userLoading]);

  const fetchDelegationData = useCallback(async () => {
    if (!currentUser || userLoading) return;

    setDelegationLoading(true);
    try {
      // LOW EGRESS: select only required columns and limit query size
      const activeRole = (userRole || sessionStorage.getItem('role') || 'user').toLowerCase().trim();
      let delegationQuery = supabase
        .from('Delegation')
        .select('"Task ID", "Timestamp", "Department", "Given By", "Name", "Task Description", "Task Start Date", "Freq", "Enable Reminders", "Require Attachment"')
        .order('Task ID', { ascending: false })
        .limit(1000);
      if (activeRole !== 'admin' && currentUser) {
        const u = currentUser.trim();
        delegationQuery = delegationQuery.or(`Name.ilike.${u},"Given By".ilike.${u}`);
      }
      const { data, error } = await delegationQuery;
      if (error) throw error;

      if (data && data.length > 0) {
        const transformedData = data.map((row, rowIndex) => {
          return {
            _id: `delegation_${rowIndex}_${Math.random().toString(36).substring(2, 15)}`,
            _rowIndex: rowIndex + 2,
            Timestamp: row['Timestamp'] || "",
            'Task ID': row['Task ID'] || "",
            Department: row['Department'] || "",
            'Given By': row['Given By'] || "",
            Name: row['Name'] || "",
            'Task Description': row['Task Description'] || "",
            'Task Start Date': row['Task Start Date'] || "",
            Freq: row['Freq'] || "",
            'Enable Reminders': row['Enable Reminders'] || "",
            'Require Attachment': row['Require Attachment'] || "",
          };
        });

        // Apply role-based filtering (unchanged from original)
        let filteredData;
        if (userRole === 'admin') {
          // Admin sees all tasks
          filteredData = transformedData;
        } else {
          // Regular user sees only their tasks
          filteredData = transformedData.filter(item => {
            const itemName = (item.Name || '').toString().toLowerCase().trim();
            const itemGivenBy = (item['Given By'] || '').toString().toLowerCase().trim();
            const currentUserLower = currentUser.toLowerCase().trim();

            const isAssignedToUser = itemName === currentUserLower;
            const isGivenByUser = itemGivenBy === currentUserLower;

            return isAssignedToUser || isGivenByUser;
          });
        }

        setDelegationTasks(filteredData);
      } else {
        setDelegationTasks([]);
      }
    } catch (err) {
      console.error("Delegation fetch error:", err);
      setError(err.message || "Failed to load delegation data");
    } finally {
      setDelegationLoading(false);
    }
  }, [currentUser, userRole, userLoading]);

  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      // Handle Google Sheets date format like "Date(2025,6,4)"
      if (typeof dateValue === 'string' && dateValue.startsWith('Date(')) {
        const match = dateValue.match(/Date\((\d+),(\d+),(\d+)\)/);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]); // Note: Google Sheets month is 0-based like JS
          const day = parseInt(match[3]);
          const date = new Date(year, month, day);
          return format(date, 'dd/MM/yyyy');
        }
      }

      // Handle regular date objects/strings
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return format(date, 'dd/MM/yyyy');
      }

      return dateValue;
    } catch {
      return dateValue;
    }
  };

  const requestSort = (key) => {
    if (loading) return;
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleDropdown = (dropdown) => {
    setDropdownOpen(prev => ({
      ...prev,
      [dropdown]: !prev[dropdown]
    }));
  };

  const handleNameFilterSelect = (name) => {
    setNameFilter(name);
    setDropdownOpen({ ...dropdownOpen, name: false });
  };

  const handleFrequencyFilterSelect = (freq) => {
    setFreqFilter(freq);
    setDropdownOpen({ ...dropdownOpen, frequency: false });
  };

  const clearNameFilter = () => {
    setNameFilter('');
    setDropdownOpen({ ...dropdownOpen, name: false });
  };

  const clearFrequencyFilter = () => {
    setFreqFilter('');
    setDropdownOpen({ ...dropdownOpen, frequency: false });
  };

  // Get filter options based on active tab
  const getFilterOptions = () => {
    const currentTasks = activeTab === 'checklist' ? tasks : delegationTasks;

    const names = [...new Set(currentTasks.map(task => task.Name))]
      .filter(name => name && typeof name === 'string' && name.trim() !== '');

    // For checklist, use 'Frequency' field, for delegation use 'Freq'
    const frequencies = activeTab === 'checklist'
      ? [...new Set(currentTasks.map(task => task.Frequency))]
        .filter(freq => freq && typeof freq === 'string' && freq.trim() !== '')
      : [...new Set(currentTasks.map(task => task.Freq))]
        .filter(freq => freq && typeof freq === 'string' && freq.trim() !== '');

    return { names, frequencies };
  };

  const { names: currentNames, frequencies: currentFrequencies } = getFilterOptions();

  // Reset filters when changing tabs
  useEffect(() => {
    setNameFilter('');
    setFreqFilter('');
    setDropdownOpen({ name: false, frequency: false });
  }, [activeTab]);

  const filteredChecklistTasks = tasks.filter(task => {
    const nameFilterPass = !nameFilter || task.Name === nameFilter;
    const freqFilterPass = !freqFilter || task.Frequency === freqFilter;
    const searchTermPass = Object.values(task).some(
      value => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    return nameFilterPass && freqFilterPass && searchTermPass;
  }).sort((a, b) => {
    if (!sortConfig.key) return 0;
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, nameFilter, freqFilter, activeTab, itemsPerPage]);

  const totalChecklistItems = filteredChecklistTasks.length;
  const totalChecklistPages = Math.ceil(totalChecklistItems / itemsPerPage) || 1;
  const validChecklistCurrentPage = Math.min(Math.max(1, currentPage), totalChecklistPages);
  const checklistStartIndex = (validChecklistCurrentPage - 1) * itemsPerPage;
  const checklistEndIndex = Math.min(checklistStartIndex + itemsPerPage, totalChecklistItems);
  const paginatedChecklistTasks = filteredChecklistTasks.slice(checklistStartIndex, checklistStartIndex + itemsPerPage);

  const getPageNumbers = (current, total) => {
    const pages = [];
    const maxVisible = 5;
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, '...', total);
      } else if (current >= total - 2) {
        pages.push(1, '...', total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, '...', current - 1, current, current + 1, '...', total);
      }
    }
    return pages;
  };

  // Auto-detect user on component mount
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // ULTRA-LOW EGRESS: Lazy fetch task data based on active tab so only viewed data is downloaded
  useEffect(() => {
    if (currentUser && userRole && !userLoading) {
      if (activeTab === 'checklist' && !checklistLoaded) {
        fetchChecklistData().then(() => setChecklistLoaded(true));
      } else if (activeTab === 'delegation' && !delegationLoaded) {
        fetchDelegationData().then(() => setDelegationLoaded(true));
      }
    }
  }, [fetchChecklistData, fetchDelegationData, currentUser, userRole, userLoading, activeTab, checklistLoaded, delegationLoaded]);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'checklist') {
      fetchChecklistData().then(() => setChecklistLoaded(true));
    } else {
      fetchDelegationData().then(() => setDelegationLoaded(true));
    }
  }, [activeTab, fetchChecklistData, fetchDelegationData]);

  // Show loading while fetching user data
  if (userLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
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
            <p className="luxury-text-title">Loading user session...</p>
            <p className="luxury-text-subtitle">Authenticating credentials</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Show error if user not found or not logged in
  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-red-200">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-white text-purple-600 border border-purple-200 px-4 py-2 rounded-md hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Page
                </button>
                <button
                  onClick={() => window.location.href = '/login'}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="sticky top-0 z-30 bg-white pb-4 border-b border-gray-200">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-purple-700 pl-3">
              {CONFIG.PAGE_CONFIG.title}
            </h1>
            <p className="text-purple-600 text-sm pl-3">
              {currentUser && `Welcome ${currentUser}`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto">
            <div className="flex border border-purple-200 rounded-md overflow-hidden self-start">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors duration-300 ${activeTab === "checklist"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-purple-600 hover:bg-purple-50"
                  }`}
                onClick={() => setActiveTab("checklist")}
              >
                Checklist
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors duration-300 ${activeTab === "delegation"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-purple-600 hover:bg-purple-50"
                  }`}
                onClick={() => setActiveTab("delegation")}
              >
                Delegation
              </button>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-7 transform -translate-y-1/2 text-slate-500"
                size={18}
              />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 font-medium placeholder:text-slate-500 border-2 border-slate-300 hover:border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all shadow-sm"
                disabled={loading || delegationLoading}
              />
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <button
                  onClick={() => toggleDropdown("name")}
                  className="flex items-center gap-2 px-3 py-2 border border-purple-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4" />
                  {nameFilter || "Filter by Name"}
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${dropdownOpen.name ? "rotate-180" : ""
                      }`}
                  />
                </button>
                {dropdownOpen.name && (
                  <div className="absolute z-50 mt-1 w-56 rounded-md bg-white shadow-lg border border-gray-200 max-h-60 flex flex-col">
                    <div className="p-2 border-b border-gray-100 flex-shrink-0 bg-white sticky top-0 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
                        <input
                          type="text"
                          placeholder="Type name..."
                          value={nameSearchTerm}
                          onChange={(e) => setNameSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 bg-gray-50 hover:bg-white transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="py-1 overflow-y-auto">
                      <button
                        onClick={clearNameFilter}
                        className={`block w-full text-left px-4 py-2 text-sm ${!nameFilter
                          ? "bg-purple-100 text-purple-900"
                          : "text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        All Names
                      </button>
                      {currentNames.filter(n => n.toLowerCase().includes(nameSearchTerm.toLowerCase())).map((name) => (
                        <button
                          key={name}
                          onClick={() => handleNameFilterSelect(name)}
                          className={`block w-full text-left px-4 py-2 text-sm ${nameFilter === name
                            ? "bg-purple-100 text-purple-900"
                            : "text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown("frequency")}
                  className="flex items-center gap-2 px-3 py-2 border border-purple-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4" />
                  {freqFilter || "Filter by Frequency"}
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${dropdownOpen.frequency ? "rotate-180" : ""
                      }`}
                  />
                </button>
                {dropdownOpen.frequency && (
                  <div className="absolute z-50 mt-1 w-56 rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
                    <div className="py-1">
                      <button
                        onClick={clearFrequencyFilter}
                        className={`block w-full text-left px-4 py-2 text-sm ${!freqFilter
                          ? "bg-purple-100 text-purple-900"
                          : "text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        All Frequencies
                      </button>
                      {currentFrequencies.map((freq) => (
                        <button
                          key={freq}
                          onClick={() => handleFrequencyFilterSelect(freq)}
                          className={`block w-full text-left px-4 py-2 text-sm ${freqFilter === freq
                            ? "bg-purple-100 text-purple-900"
                            : "text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleRefresh}
                title="Refresh current tasks"
                disabled={loading || delegationLoading}
                className="flex items-center justify-center p-2 border border-purple-200 rounded-md bg-white text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition-colors shadow-sm"
              >
                <RefreshCw
                  size={16}
                  className={(loading || delegationLoading) ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {currentUser && (
        <>
          {activeTab === "checklist" ? (
            <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h2 className="text-purple-700 font-medium">
                  {userRole === "admin"
                    ? "All Unique Tasks"
                    : "My Unique Tasks"}
                </h2>
                <p className="text-purple-600 text-sm">
                  {userRole === "admin"
                    ? "Showing all unique tasks from checklist"
                    : CONFIG.PAGE_CONFIG.description}
                </p>
              </div>

              <div
                className="overflow-x-auto"
                style={{ maxHeight: "calc(100vh - 220px)" }}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                      {[
                        { key: "Department", label: "Department" },
                        { key: "Given By", label: "Given By" },
                        { key: "Name", label: "Name" },
                        {
                          key: "Task Description",
                          label: "Task Description",
                          minWidth: "min-w-[300px]",
                        },
                        {
                          key: "Start Date",
                          label: "Start Date",
                          bg: "bg-yellow-50",
                        },
                        { key: "Frequency", label: "Frequency" },
                        { key: "Reminders", label: "Reminders" },
                        { key: "Attachment", label: "Attachment" },
                      ].map((column) => (
                        <th
                          key={column.label}
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.bg || ""
                            } ${column.minWidth || ""} ${column.key
                              ? "cursor-pointer hover:bg-gray-100"
                              : ""
                            }`}
                          onClick={() =>
                            column.key && requestSort(column.key)
                          }
                        >
                          <div className="flex items-center">
                            {column.label}
                            {sortConfig.key === column.key && (
                              <span className="ml-1">
                                {sortConfig.direction === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <div className="flex justify-center">
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
                              <p className="luxury-text-title">Loading checklist data...</p>
                              <p className="luxury-text-subtitle">Syncing with Google Sheets</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : filteredChecklistTasks.length > 0 ? (
                      paginatedChecklistTasks.map((task) => (
                        <tr key={task._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {task.Department || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task["Given By"] || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.Name || "—"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 min-w-[300px] max-w-[400px]">
                            <div className="whitespace-normal break-words">
                              {task["Task Description"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-yellow-50">
                            {task["Start Date"] || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${task.Frequency === "Daily"
                                ? "bg-blue-100 text-blue-800"
                                : task.Frequency === "Weekly"
                                  ? "bg-green-100 text-green-800"
                                  : task.Frequency === "Monthly"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {task.Frequency || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.Reminders || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {task.Attachment || "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          {searchTerm || nameFilter || freqFilter
                            ? "No tasks matching your filters"
                            : userRole === "admin"
                              ? "No unique tasks available"
                              : "No unique tasks assigned to you"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {!loading && filteredChecklistTasks.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-purple-100 text-sm">
                  <div className="flex flex-wrap items-center gap-3 text-gray-600">
                    <span>
                      Showing <strong className="font-semibold text-gray-800">{totalChecklistItems > 0 ? checklistStartIndex + 1 : 0}</strong> to{" "}
                      <strong className="font-semibold text-gray-800">{checklistEndIndex}</strong> of{" "}
                      <strong className="font-semibold text-gray-800">{totalChecklistItems}</strong> tasks
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-gray-500 text-xs">Rows per page:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={validChecklistCurrentPage === 1}
                      title="First Page"
                      className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={validChecklistCurrentPage === 1}
                      title="Previous Page"
                      className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div className="flex items-center gap-1 mx-1">
                      {getPageNumbers(validChecklistCurrentPage, totalChecklistPages).map((page, index) => (
                        page === '...' ? (
                          <span key={`dots-${index}`} className="px-2 py-1 text-gray-400 text-xs select-none">...</span>
                        ) : (
                          <button
                            key={`page-${page}`}
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[32px] h-8 px-2 text-xs font-medium rounded transition-colors ${
                              validChecklistCurrentPage === page
                                ? "bg-purple-600 text-white shadow-sm"
                                : "bg-white border border-gray-200 text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalChecklistPages))}
                      disabled={validChecklistCurrentPage === totalChecklistPages}
                      title="Next Page"
                      className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalChecklistPages)}
                      disabled={validChecklistCurrentPage === totalChecklistPages}
                      title="Last Page"
                      className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <DelegationPage
              searchTerm={searchTerm}
              nameFilter={nameFilter}
              freqFilter={freqFilter}
              setNameFilter={setNameFilter}
              setFreqFilter={setFreqFilter}
              currentUser={currentUser}
              userRole={userRole}
              CONFIG={CONFIG}
              delegationTasks={delegationTasks}
              delegationLoading={delegationLoading}
              loading={delegationLoading}
            />
          )}
        </>
      )}
    </AdminLayout>
  );
}