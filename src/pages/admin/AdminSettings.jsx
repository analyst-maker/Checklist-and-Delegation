"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Settings, Zap, Play, CheckCircle2, AlertCircle, Clock, Calendar, 
  RefreshCw, Sliders, Search, Filter, ShieldCheck, Layers, ListChecks,
  CheckCircle, ArrowRight, Activity, Terminal, AlertTriangle, Eye, Sparkles,
  Download, UploadCloud, FileSpreadsheet, Database, ArrowDownToLine, Check,
  FileText, ExternalLink, UserPlus, Users, Key, Lock, Phone, Mail,
  UserCheck, UserX, Trash2, Edit3, Shield, Building2, User, X, Camera, Moon,
  ArrowUpDown, ArrowUp, ArrowDown, Save, ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { uploadImageToCloudinary } from '../../lib/cloudinary';
import { 
  runTaskGenerationTrigger, 
  formatDateToDDMMYYYY, 
  parseDateString, 
  isTemplateDue,
  isSameDay,
  updateUniqueTemplatesLastDateBatch
} from '../../utils/taskTriggerEngine';

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec";

const TIMING_OPTIONS = [
  { value: '0', label: '12:00 AM (Midnight)' },
  { value: '1', label: '01:00 AM' },
  { value: '2', label: '02:00 AM (Default Nightly Auto-Run)' },
  { value: '3', label: '03:00 AM' },
  { value: '4', label: '04:00 AM' },
  { value: '5', label: '05:00 AM' },
  { value: '6', label: '06:00 AM' },
  { value: '7', label: '07:00 AM' },
  { value: '8', label: '08:00 AM' },
  { value: '9', label: '09:00 AM' },
  { value: '9:40', label: '09:40 AM' },
  { value: '10', label: '10:00 AM' },
  { value: '11', label: '11:00 AM' },
  { value: '12', label: '12:00 PM (Noon)' },
  { value: '13', label: '01:00 PM' },
  { value: '14', label: '02:00 PM' },
  { value: '15', label: '03:00 PM' },
  { value: '16', label: '04:00 PM' },
  { value: '17', label: '05:00 PM' },
  { value: '18', label: '06:00 PM' },
  { value: '19', label: '07:00 PM' },
  { value: '20', label: '08:00 PM' },
  { value: '21', label: '09:00 PM' },
  { value: '22', label: '10:00 PM' },
  { value: '23', label: '11:00 PM' }
];

export const formatHourLabel = (h) => {
  if (!h && h !== 0) return '02:00 AM IST';
  const str = String(h).trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const hr = parseInt(parts[0], 10) || 0;
    const min = parseInt(parts[1], 10) || 0;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const display = hr % 12 === 0 ? 12 : hr % 12;
    return `${String(display).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm} IST`;
  }
  const num = parseInt(str, 10);
  if (isNaN(num)) return '02:00 AM IST';
  const ampm = num >= 12 ? 'PM' : 'AM';
  const display = num % 12 === 0 ? 12 : num % 12;
  return `${String(display).padStart(2, '0')}:00 ${ampm} IST`;
};

// =============================================================================
// INTERACTIVE CUSTOM DATE PICKER MODAL FOR TEMPLATE LAST DATES
// =============================================================================
function TemplateDatePickerModal({ template, isOpen, onClose, onSave, isSaving }) {
  if (!isOpen || !template) return null;

  const initialDObj = useMemo(() => {
    return parseDateString(template['Last Date']) || parseDateString(template['Task Start date'] || template['Task Start Date']) || new Date();
  }, [template]);

  const [selectedDate, setSelectedDate] = useState(() => parseDateString(template['Last Date']));
  const [viewYear, setViewYear] = useState(() => initialDObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => initialDObj.getMonth());
  const [manualDateText, setManualDateText] = useState(() => {
    const d = parseDateString(template['Last Date']);
    return d ? formatDateToDDMMYYYY(d) : '';
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 15 }, (_, i) => currentYear - 5 + i);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day) => {
    const newD = new Date(viewYear, viewMonth, day);
    setSelectedDate(newD);
    setManualDateText(formatDateToDDMMYYYY(newD));
  };

  const handleSetToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setManualDateText(formatDateToDDMMYYYY(today));
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setManualDateText(formatDateToDDMMYYYY(d));
  };

  const handleSetOffsetDays = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    setSelectedDate(d);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setManualDateText(formatDateToDDMMYYYY(d));
  };

  const handleManualTextChange = (e) => {
    const val = e.target.value;
    setManualDateText(val);
    const parsed = parseDateString(val);
    if (parsed) {
      setSelectedDate(parsed);
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  };

  const handleSave = () => {
    const formatted = selectedDate ? formatDateToDDMMYYYY(selectedDate) : null;
    onSave(template['Task ID'] ?? template.id, formatted);
  };

  const handleClear = () => {
    setSelectedDate(null);
    setManualDateText('');
    onSave(template['Task ID'] ?? template.id, null);
  };

  const isDaySelected = (day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getFullYear() === viewYear
    );
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 md:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-sm">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Calendar className="h-4 w-4" />
              </div>
              <span>Set Last Generated Date</span>
            </div>
            <p className="text-xs text-slate-800 font-bold mt-1">
              Template #{template['Task ID'] ?? template.id} &bull; {template.Name || 'Assignee'}
            </p>
            <p className="text-[11px] text-slate-500 truncate max-w-[290px]" title={template['Task Description'] || template['Tast Descriptions']}>
              {template['Task Description'] || template['Tast Descriptions'] || '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Shortcut Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleSetToday}
            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
          >
            ⚡ Today
          </button>
          <button
            type="button"
            onClick={handleSetYesterday}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => handleSetOffsetDays(7)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          >
            7 Days Ago
          </button>
          <button
            type="button"
            onClick={() => handleSetOffsetDays(14)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          >
            14 Days Ago
          </button>
          <button
            type="button"
            onClick={() => handleSetOffsetDays(30)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          >
            1 Month Ago
          </button>
        </div>

        {/* Month & Year Navigation Toolbar */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-600 border border-slate-200 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {monthNames.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>

            <select
              value={viewYear}
              onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-600 border border-slate-200 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Days Grid */}
        <div className="space-y-1.5">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-9 w-9" />
            ))}

            {/* Month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const selected = isDaySelected(day);
              const today = isToday(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-9 w-9 mx-auto rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none active:scale-90 ${
                    selected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-300 font-extrabold scale-105'
                      : today
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-400 font-extrabold hover:bg-indigo-100'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Preview & Manual Input */}
        <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Selected Date (DD/MM/YYYY)
            </label>
            <input
              type="text"
              value={manualDateText}
              onChange={handleManualTextChange}
              placeholder="e.g. 25/09/2026"
              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="text-right shrink-0">
            <span className="block text-[10px] text-slate-400 font-medium">Status</span>
            <span className="text-xs font-extrabold text-indigo-700">
              {selectedDate ? formatDateToDDMMYYYY(selectedDate) : 'Never (Clear)'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving}
            className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 cursor-pointer disabled:opacity-50"
            title="Set Last Date to null / Never"
          >
            Clear (Never)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Date</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const location = useLocation();

  // Determine active tab from URL hash
  const currentTab = useMemo(() => {
    const rawHash = (location.hash || '').replace('#', '').trim();
    if (['user-management', 'manual-data-dump', 'trigger-console', 'recurring-templates'].includes(rawHash)) {
      return rawHash;
    }
    return 'home';
  }, [location.hash]);

  // Instant scroll to top when tab changes to ensure zero-lag snappy switching
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentTab]);

  // Stats & Main State
  const [loading, setLoading] = useState(true);
  const [isRunningTrigger, setIsRunningTrigger] = useState(false);
  const [runningRowId, setRunningRowId] = useState(null);
  const [isSyncingDates, setIsSyncingDates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [checklistCount, setChecklistCount] = useState(0);
  const [delegationCount, setDelegationCount] = useState(0);
  const [todayGeneratedCount, setTodayGeneratedCount] = useState(0);
  const [calendarDates, setCalendarDates] = useState([]);
  const [holidays, setHolidays] = useState([]);
  
  // Nightly Cloud Trigger State & Timing Configuration
  const [nightlyTriggerHour, setNightlyTriggerHour] = useState(() => {
    return localStorage.getItem('nightly_trigger_hour') || '2';
  });
  const [selectedTimingHour, setSelectedTimingHour] = useState(() => {
    return localStorage.getItem('nightly_trigger_hour') || '2';
  });
  const [countdown, setCountdown] = useState({
    hours: '00',
    minutes: '00',
    seconds: '00',
    nextDateStr: ''
  });
  const [isSettingUpNightlyTrigger, setIsSettingUpNightlyTrigger] = useState(false);
  const [nightlyTriggerStatus, setNightlyTriggerStatus] = useState('');
  const [isRunningNightlyTest, setIsRunningNightlyTest] = useState(false);

  // Users State (Whatsapp table)
  const [users, setUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userDeptFilter, setUserDeptFilter] = useState('ALL');
  
  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [userPhotoFile, setUserPhotoFile] = useState(null);
  const [userPhotoPreview, setUserPhotoPreview] = useState('');
  
  const initialUserForm = {
    originalUsername: '',
    Username: '',
    password: '',
    Role: 'user',
    Email: '',
    Number: '',
    Photo: ''
  };
  const [userFormData, setUserFormData] = useState(initialUserForm);

  // Trigger Configuration
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD for input
  });
  const [ignoreCalendarCheck, setIgnoreCalendarCheck] = useState(false);
  const [autoTriggerOnLogin, setAutoTriggerOnLogin] = useState(() => {
    return localStorage.getItem('auto_trigger_on_login') !== 'false';
  });
  const [autoScheduleInterval, setAutoScheduleInterval] = useState(() => {
    return localStorage.getItem('auto_trigger_interval') || '60'; // minutes
  });

  // Logs & History
  const [executionLogs, setExecutionLogs] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [triggerHistory, setTriggerHistory] = useState([]);

  // Data Dump to Google Sheet State
  const [isDumping, setIsDumping] = useState(false);
  const [dumpProgress, setDumpProgress] = useState(0);
  const [dumpStatusMsg, setDumpStatusMsg] = useState('');
  const [dumpLogs, setDumpLogs] = useState([]);
  const [clearBeforeDump, setClearBeforeDump] = useState(true);

  const [appsScriptUrl, setAppsScriptUrl] = useState(() => {
    return localStorage.getItem('dump_apps_script_url') || APPS_SCRIPT_URL;
  });
  const [isAppsScriptSaved, setIsAppsScriptSaved] = useState(false);

  const [targetSheetUrl, setTargetSheetUrl] = useState(() => {
    const saved = localStorage.getItem('dump_target_sheet_url');
    if (saved) return saved;
    const envSheetId = import.meta.env.VITE_SPREADSHEET_ID;
    return envSheetId ? `https://docs.google.com/spreadsheets/d/${envSheetId}/edit` : 'https://docs.google.com/spreadsheets/d/1r3YHyjqv24gZXBI9IofAhodnlBuDTA3sgyzU_PNCaQg/edit';
  });
  const [isUrlSaved, setIsUrlSaved] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);

  // Helper to extract clean Google Spreadsheet ID from URL or raw ID
  const extractSpreadsheetId = (urlOrId) => {
    if (!urlOrId) return '';
    const trimmed = String(urlOrId).trim();
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    if (!trimmed.includes('/') && trimmed.length > 15) return trimmed;
    return trimmed;
  };

  const handleAppsScriptUrlChange = (val) => {
    setAppsScriptUrl(val);
    localStorage.setItem('dump_apps_script_url', val);
    setIsAppsScriptSaved(true);
    setTimeout(() => setIsAppsScriptSaved(false), 2500);
  };

  const handleTargetSheetUrlChange = (val) => {
    setTargetSheetUrl(val);
    localStorage.setItem('dump_target_sheet_url', val);
    setIsUrlSaved(true);
    setTimeout(() => setIsUrlSaved(false), 2500);
  };

  const handleSaveSheetConfig = () => {
    const cleanScript = (appsScriptUrl || '').trim();
    const cleanSheet = (targetSheetUrl || '').trim();

    if (!cleanScript) {
      alert('Kripya Google Apps Script Web App URL daalein!');
      return;
    }
    if (!cleanSheet) {
      alert('Kripya Target Google Sheet URL ya Sheet ID daalein!');
      return;
    }

    localStorage.setItem('dump_apps_script_url', cleanScript);
    localStorage.setItem('dump_target_sheet_url', cleanSheet);

    setIsAppsScriptSaved(true);
    setIsUrlSaved(true);
    setSaveSuccessMsg('✅ Google Sheet aur Script URL successfully save ho gaya hai! Ab se data hamesha isi sheet me dump hoga.');
    alert('✅ Configuration Saved! Ab se aapka live data hamesha isi Google Sheet URL me dump hoga aur login karne par bhi reset nahi hoga.');
    setTimeout(() => {
      setIsAppsScriptSaved(false);
      setIsUrlSaved(false);
      setSaveSuccessMsg('');
    }, 6000);
  };

  // Table Filters & Sorting for Unique Templates
  const [searchTerm, setSearchTerm] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [freqFilter, setFreqFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [taskIdSortOrder, setTaskIdSortOrder] = useState('ASC');
  const [editingTemplateForDate, setEditingTemplateForDate] = useState(null);
  const [updatingDateId, setUpdatingDateId] = useState(null);

  // Load all initial data from Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      const todayDDMMYYYY = formatDateToDDMMYYYY(new Date());

      // Check cache for Working Day Calendar & Holidays (saves ~1,500 rows download per visit)
      const cachedCal = localStorage.getItem('cache_working_calendar');
      const cachedCalTime = Number(localStorage.getItem('cache_working_calendar_time') || 0);
      const isCalValid = cachedCal && (Date.now() - cachedCalTime < 6 * 60 * 60 * 1000);

      const cachedHol = localStorage.getItem('cache_holidays');
      const cachedHolTime = Number(localStorage.getItem('cache_holidays_time') || 0);
      const isHolValid = cachedHol && (Date.now() - cachedHolTime < 6 * 60 * 60 * 1000);

      const [uRes, cCountRes, dCountRes, todayCountRes, calRes, holRes, wRes] = await Promise.all([
        supabase.from('Unique').select('*').limit(3000),
        supabase.from('Checklist').select('*', { count: 'exact', head: true }),
        supabase.from('Delegation').select('*', { count: 'exact', head: true }),
        supabase.from('Checklist').select('*', { count: 'exact', head: true }).eq('Task Start Date', todayDDMMYYYY),
        isCalValid ? Promise.resolve({ data: JSON.parse(cachedCal) }) : supabase.from('Working Day Calendar').select('*').limit(3000),
        isHolValid ? Promise.resolve({ data: JSON.parse(cachedHol) }) : supabase.from('Holiday List').select('*').limit(1000),
        supabase.from('Whatsapp').select('*').order('Username', { ascending: true })
      ]);

      if (uRes.data) setTemplates(uRes.data);
      if (cCountRes.count !== null) setChecklistCount(cCountRes.count);
      if (dCountRes.count !== null) setDelegationCount(dCountRes.count);
      if (todayCountRes.count !== null) setTodayGeneratedCount(todayCountRes.count);
      if (calRes.data) {
        setCalendarDates(calRes.data);
        if (!isCalValid) {
          localStorage.setItem('cache_working_calendar', JSON.stringify(calRes.data));
          localStorage.setItem('cache_working_calendar_time', String(Date.now()));
        }
      }
      if (holRes.data) {
        setHolidays(holRes.data);
        if (!isHolValid) {
          localStorage.setItem('cache_holidays', JSON.stringify(holRes.data));
          localStorage.setItem('cache_holidays_time', String(Date.now()));
        }
      }
      if (wRes.data) {
        const activeUsers = wRes.data.filter(u => {
          const name = (u.Username || u['User name'] || '').trim();
          const role = (u.Role || '').trim().toLowerCase();
          return !name.startsWith('DELETED_') && role !== 'deleted';
        });
        setUsers(activeUsers);
      }

      const savedHistory = JSON.parse(localStorage.getItem('task_trigger_history') || '[]');
      setTriggerHistory(savedHistory);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Live 1-second countdown clock for next scheduled trigger
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      let targetHour = 2;
      let targetMin = 0;

      const triggerStr = String(nightlyTriggerHour || '2').trim();
      if (triggerStr.includes(':')) {
        const parts = triggerStr.split(':');
        targetHour = parseInt(parts[0], 10) || 0;
        targetMin = parseInt(parts[1], 10) || 0;
      } else {
        targetHour = parseInt(triggerStr, 10) || 2;
        targetMin = 0;
      }
      
      const target = new Date();
      target.setHours(targetHour, targetMin, 0, 0);

      // If target time has already passed today, target is tomorrow
      if (now >= target) {
        target.setDate(target.getDate() + 1);
      }

      const diffMs = target.getTime() - now.getTime();
      const totalSec = Math.max(0, Math.floor(diffMs / 1000));

      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;

      const formattedDate = target.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      setCountdown({
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0'),
        nextDateStr: `${formattedDate} @ ${formatHourLabel(nightlyTriggerHour)}`
      });
    };

    calculateCountdown();
    const timer = setInterval(calculateCountdown, 1000);
    return () => clearInterval(timer);
  }, [nightlyTriggerHour]);

  // Save preferences
  const handleToggleAutoLogin = (val) => {
    setAutoTriggerOnLogin(val);
    localStorage.setItem('auto_trigger_on_login', String(val));
  };

  const handleChangeInterval = (val) => {
    setAutoScheduleInterval(val);
    localStorage.setItem('auto_trigger_interval', String(val));
  };

  // Setup / Update Scheduled Cloud Trigger on Google Apps Script
  const handleSetupNightlyTrigger = async (customTiming) => {
    const timingToSet = customTiming !== undefined ? customTiming : selectedTimingHour;
    
    // Save locally immediately so UI and refreshes always retain the configured time
    localStorage.setItem('nightly_trigger_hour', String(timingToSet));
    setNightlyTriggerHour(String(timingToSet));
    setSelectedTimingHour(String(timingToSet));

    setIsSettingUpNightlyTrigger(true);
    setNightlyTriggerStatus('');
    try {
      let hour = 2;
      let minute = 0;
      const tStr = String(timingToSet).trim();
      if (tStr.includes(':')) {
        const parts = tStr.split(':');
        hour = parseInt(parts[0], 10) || 0;
        minute = parseInt(parts[1], 10) || 0;
      } else {
        hour = parseInt(tStr, 10) || 2;
        minute = 0;
      }

      const activeScriptUrl = (appsScriptUrl || APPS_SCRIPT_URL).trim();
      const formData = new FormData();
      formData.append('action', 'setupNightlyTrigger');
      formData.append('hour', String(hour));
      formData.append('minute', String(minute));
      const res = await fetch(activeScriptUrl, { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem('nightly_trigger_hour', String(timingToSet));
        setNightlyTriggerHour(String(timingToSet));
        setSelectedTimingHour(String(timingToSet));
        setNightlyTriggerStatus(`✅ Cloud Trigger active daily at ${formatHourLabel(timingToSet)}!`);
        alert(`⏰ SUCCESS: Trigger timing ${formatHourLabel(timingToSet)} set ho gayi hai! Har din ${formatHourLabel(timingToSet)} par tasks automatically trigger honge.`);
      } else {
        throw new Error(json.error || 'Failed to setup trigger');
      }
    } catch (err) {
      console.error('Trigger setup error:', err);
      // Save locally so UI reflects the configured schedule
      localStorage.setItem('nightly_trigger_hour', String(timingToSet));
      setNightlyTriggerHour(String(timingToSet));
      setSelectedTimingHour(String(timingToSet));
      setNightlyTriggerStatus(`✅ Trigger timing saved for ${formatHourLabel(timingToSet)}!`);
    } finally {
      setIsSettingUpNightlyTrigger(false);
    }
  };

  // Test Run Nightly Cloud Trigger Now
  const handleRunNightlyCloudTest = async () => {
    setIsRunningNightlyTest(true);
    try {
      const formData = new FormData();
      formData.append('action', 'runNightlyTriggerNow');
      const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        alert(`🎉 Cloud Trigger executed! Result: ${json.message || 'Success'} (Generated ${json.tasksGenerated || 0} tasks)`);
        loadData();
      } else {
        alert(`Cloud execution notice: ${json.error || json.message}`);
      }
    } catch (err) {
      alert(`Cloud test error: ${err.message || err}`);
    } finally {
      setIsRunningNightlyTest(false);
    }
  };

  // =========================================================================
  // USER MANAGEMENT (WHATSAPP TABLE)
  // =========================================================================

  // Open Create User Modal
  const handleOpenCreateUserModal = () => {
    setIsEditingUser(false);
    setUserFormData(initialUserForm);
    setUserPhotoFile(null);
    setUserPhotoPreview('');
    setUserFormError('');
    setUserFormSuccess('');
    setIsUserModalOpen(true);
  };

  // Open Edit User Modal
  const handleOpenEditUserModal = (user) => {
    setIsEditingUser(true);
    setUserFormData({
      id: user.id !== undefined ? user.id : null,
      originalUsername: user.Username || user['User name'] || '',
      Username: user.Username || user['User name'] || '',
      password: user.password || user.Password || '',
      Role: user.Role || 'user',
      Email: user.Email || user.ID || '',
      Number: user.Number || '',
      Photo: user.Photo || user.Image || ''
    });
    setUserPhotoFile(null);
    setUserPhotoPreview(user.Photo || user.Image || '');
    setUserFormError('');
    setUserFormSuccess('');
    setIsUserModalOpen(true);
  };

  // Handle Photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUserPhotoFile(file);
      setUserPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Save User (Create or Update)
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormSuccess('');
    setUserFormSubmitting(true);

    try {
      const trimmedUsername = userFormData.Username.trim();
      const trimmedPassword = userFormData.password.trim();

      if (!trimmedUsername) {
        throw new Error('Username is required.');
      }
      if (!trimmedPassword) {
        throw new Error('Password is required.');
      }

      // Check for duplicate username on creation
      if (!isEditingUser) {
        const isDuplicate = users.some(
          u => (u.Username || u['User name'] || '').trim().toLowerCase() === trimmedUsername.toLowerCase()
        );
        if (isDuplicate) {
          throw new Error(`Username "${trimmedUsername}" already exists! Please choose a unique name.`);
        }
      }

      // Upload Photo if new file selected
      let photoUrl = userFormData.Photo;
      if (userPhotoFile) {
        try {
          photoUrl = await uploadImageToCloudinary(userPhotoFile);
        } catch (uploadErr) {
          console.warn('Cloudinary upload warning, using placeholder fallback:', uploadErr);
          photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedUsername)}&background=6366f1&color=fff&bold=true`;
        }
      } else if (!photoUrl) {
        photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedUsername)}&background=6366f1&color=fff&bold=true`;
      }

      const rowToSave = {
        'Username': trimmedUsername,
        'password': trimmedPassword,
        'Role': userFormData.Role || 'user',
        'Department': '',
        'Given By': '',
        'Email': userFormData.Email ? userFormData.Email.trim() : '',
        'Number': userFormData.Number ? userFormData.Number.trim() : '',
        'Photo': photoUrl
      };

      if (isEditingUser) {
        // Update user in Whatsapp table
        const targetUsername = (userFormData.originalUsername || userFormData.Username || '').trim();
        const res = await supabase.from('Whatsapp').update(rowToSave).ilike('Username', targetUsername);
        const updateErr = res.error;

        if (updateErr) throw updateErr;
        setUserFormSuccess(`User "${trimmedUsername}" updated successfully!`);
      } else {
        // Insert new user into Whatsapp table
        const { error: insertErr } = await supabase
          .from('Whatsapp')
          .insert([rowToSave]);

        if (insertErr) throw insertErr;
        setUserFormSuccess(`New User ID "${trimmedUsername}" created successfully in Whatsapp table!`);
      }

      // Clear local master data cache so new user can log in immediately
      try {
        localStorage.removeItem('masterDataCache');
        localStorage.removeItem('masterDataCacheTime');
        localStorage.removeItem(`whatsapp_user_cache_${trimmedUsername.toLowerCase()}`);
      } catch (e) {}

      // Refresh users list
      const { data: updatedUsers } = await supabase
        .from('Whatsapp')
        .select('*')
        .order('Username', { ascending: true });
      if (updatedUsers) {
        const filtered = updatedUsers.filter(u => {
          const name = (u.Username || u['User name'] || '').trim();
          const role = (u.Role || '').trim().toLowerCase();
          return !name.startsWith('DELETED_') && role !== 'deleted';
        });
        setUsers(filtered);
      }

      setTimeout(() => {
        setIsUserModalOpen(false);
        setUserFormSuccess('');
      }, 1000);

    } catch (err) {
      console.error('Error saving user:', err);
      setUserFormError(err.message || 'Failed to save user. Please check your connection.');
    } finally {
      setUserFormSubmitting(false);
    }
  };

  // Toggle user Active / Inactive
  const handleToggleUserStatus = async (user) => {
    try {
      const targetUsername = (user.Username || user['User name'] || '').trim();
      const isCurrentlyInactive = (user.Role || '').toLowerCase() === 'in active' || (user.Role || '').toLowerCase() === 'inactive';
      const newRole = isCurrentlyInactive ? 'user' : 'In Active';

      let updateErr = null;
      if (user.id !== undefined && user.id !== null) {
        const res = await supabase.from('Whatsapp').update({ 'Role': newRole }).eq('id', user.id);
        updateErr = res.error;
      } else if (targetUsername) {
        const res1 = await supabase.from('Whatsapp').update({ 'Role': newRole }).eq('Username', targetUsername);
        if (res1.error) {
          const res2 = await supabase.from('Whatsapp').update({ 'Role': newRole }).ilike('Username', targetUsername);
          updateErr = res2.error;
        }
      }

      if (updateErr) throw updateErr;

      // Clear local cache
      try {
        localStorage.removeItem('masterDataCache');
        localStorage.removeItem('masterDataCacheTime');
        localStorage.removeItem(`whatsapp_user_cache_${targetUsername.toLowerCase()}`);
      } catch (e) {}

      setUsers(prev => prev.map(u => {
        const uName = (u.Username || u['User name'] || '').trim();
        if (user.id !== undefined && u.id !== undefined && u.id === user.id) return { ...u, Role: newRole };
        if (uName.toLowerCase() === targetUsername.toLowerCase()) return { ...u, Role: newRole };
        return u;
      }));
    } catch (err) {
      alert(`Failed to update status: ${err.message || err}`);
    }
  };

  // Delete user from Whatsapp table
  const handleDeleteUser = async (user) => {
    const targetUsername = (user.Username || user['User name'] || '').trim();
    const targetNumber = (user.Number || '').trim();
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete user ID "${targetUsername}" from Whatsapp table? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      // 1. Try hard DELETE first
      let hardDeleted = false;
      if (user.id !== undefined && user.id !== null) {
        const { data: dData, error: idErr } = await supabase
          .from('Whatsapp')
          .delete()
          .eq('id', user.id)
          .select();
        if (!idErr && dData && dData.length > 0) hardDeleted = true;
      }
      if (!hardDeleted && targetNumber) {
        const { data: dData, error: numErr } = await supabase
          .from('Whatsapp')
          .delete()
          .eq('Number', targetNumber)
          .select();
        if (!numErr && dData && dData.length > 0) hardDeleted = true;
      }
      if (!hardDeleted && targetUsername) {
        const { data: dData, error: nameErr } = await supabase
          .from('Whatsapp')
          .delete()
          .eq('Username', targetUsername)
          .select();
        if (!nameErr && dData && dData.length > 0) hardDeleted = true;
      }

      // 2. If hard DELETE was not permitted / blocked by Supabase RLS policy,
      // update the record with 'DELETED' status and rename so it never returns or logs in
      if (!hardDeleted) {
        const deletedPayload = {
          'Role': 'DELETED',
          'Username': `DELETED_${targetUsername}_${Date.now()}`,
          'password': '',
          'Number': targetNumber ? `DEL_${Date.now()}_${targetNumber}` : `DEL_${Date.now()}`
        };

        if (user.id !== undefined && user.id !== null) {
          await supabase.from('Whatsapp').update(deletedPayload).eq('id', user.id);
        } else if (targetNumber) {
          await supabase.from('Whatsapp').update(deletedPayload).eq('Number', targetNumber);
        } else if (targetUsername) {
          const uRes = await supabase.from('Whatsapp').update(deletedPayload).eq('Username', targetUsername);
          if (uRes.error) {
            await supabase.from('Whatsapp').update(deletedPayload).ilike('Username', targetUsername);
          }
        }
      }

      // Clear all local caches
      try {
        localStorage.removeItem('masterDataCache');
        localStorage.removeItem('masterDataCacheTime');
        localStorage.removeItem(`whatsapp_user_cache_${targetUsername.toLowerCase()}`);
      } catch (e) {}

      // Update state immediately
      setUsers(prev => prev.filter(u => {
        const uName = (u.Username || u['User name'] || '').trim();
        const uNum = (u.Number || '').trim();
        if (user.id !== undefined && u.id !== undefined) return u.id !== user.id;
        if (targetNumber && uNum === targetNumber) return false;
        return uName.toLowerCase() !== targetUsername.toLowerCase();
      }));

      // Re-fetch to ensure sync with Supabase
      const { data: refreshed } = await supabase
        .from('Whatsapp')
        .select('*')
        .order('Username', { ascending: true });
      if (refreshed) {
        const filtered = refreshed.filter(u => {
          const name = (u.Username || u['User name'] || '').trim();
          const role = (u.Role || '').trim().toLowerCase();
          return !name.startsWith('DELETED_') && role !== 'deleted';
        });
        setUsers(filtered);
      }

    } catch (err) {
      console.error('Failed to delete user:', err);
      alert(`Failed to delete user: ${err.message || err}`);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    if (currentTab !== 'user-management' && currentTab !== 'home') return [];
    return users.filter(u => {
      const q = userSearchTerm.toLowerCase();
      const username = (u.Username || '').toLowerCase();
      const number = (u.Number || '').toLowerCase();
      const role = (u.Role || '').toLowerCase();

      const matchesSearch = !q || username.includes(q) || number.includes(q);
      
      let matchesRole = true;
      if (userRoleFilter === 'ADMIN') matchesRole = role === 'admin';
      if (userRoleFilter === 'USER') matchesRole = role === 'user';
      if (userRoleFilter === 'INACTIVE') matchesRole = role === 'in active' || role === 'inactive';

      return matchesSearch && matchesRole;
    });
  }, [users, userSearchTerm, userRoleFilter, currentTab]);

  // Run Task Generation Trigger
  const handleExecuteTrigger = async (specificId = null) => {
    if (isRunningTrigger || runningRowId) return;
    if (specificId) {
      setRunningRowId(specificId);
    } else {
      setIsRunningTrigger(true);
    }
    setExecutionLogs([]);
    setLastResult(null);

    const targetDateObj = selectedDate ? new Date(selectedDate) : new Date();
    const targetDateDDMMYYYY = formatDateToDDMMYYYY(targetDateObj);

    const result = await runTaskGenerationTrigger({
      targetDate: targetDateObj,
      ignoreCalendarCheck: ignoreCalendarCheck,
      specificTemplateId: specificId,
      forceRunSpecific: false,
      onProgress: (logEntry, allLogs) => {
        setExecutionLogs([...allLogs]);
      }
    });

    setLastResult(result);
    setIsRunningTrigger(false);
    setRunningRowId(null);

    // If single template was run manually
    if (specificId) {
      if (result.success && result.tasksGenerated > 0) {
        setTemplates(prev =>
          prev.map(item =>
            String(item['Task ID'] ?? item.id) === String(specificId)
              ? { ...item, 'Last Date': targetDateDDMMYYYY }
              : item
          )
        );
        alert(`✅ Template #${specificId} successfully generate ho gaya (${targetDateDDMMYYYY})!`);
      } else {
        const warningLog = result.logs?.find(l => l.type === 'warning');
        const reasonMsg = warningLog ? warningLog.message : 'Task is not due yet according to its frequency schedule.';
        alert(`⚠️ Template #${specificId} generate nahi hua:\n\n${reasonMsg}`);
      }
    } else if (result.success && result.generatedTasks && result.generatedTasks.length > 0) {
      const generatedIds = new Set(result.generatedTasks.map(t => String(t.templateId)));
      setTemplates(prev =>
        prev.map(item =>
          generatedIds.has(String(item['Task ID'] ?? item.id))
            ? { ...item, 'Last Date': targetDateDDMMYYYY }
            : item
        )
      );
    }

    // Refresh templates data to ensure 100% sync with Supabase
    try {
      const { data: uData } = await supabase.from('Unique').select('*').limit(3000);
      if (uData) setTemplates(uData);

      const { count: cCount } = await supabase.from('Checklist').select('*', { count: 'exact', head: true });
      if (cCount !== null) setChecklistCount(cCount);
    } catch (refreshErr) {
      console.warn('Could not refresh templates after trigger:', refreshErr);
    }

    const savedHistory = JSON.parse(localStorage.getItem('task_trigger_history') || '[]');
    setTriggerHistory(savedHistory);
  };

  // Sync all template Last Dates with existing Checklist tasks for selected date
  const handleSyncAllLastDates = async () => {
    if (isSyncingDates) return;
    setIsSyncingDates(true);
    try {
      const targetDateObj = selectedDate ? new Date(selectedDate) : new Date();
      const targetDateDDMMYYYY = formatDateToDDMMYYYY(targetDateObj);

      // Fetch checklist tasks to find all templates that already have tasks generated
      const { data: cRows, error: cErr } = await supabase
        .from('Checklist')
        .select('"Task ID", "Name", "Tast Descriptions", "Task Description", "Task Start Date"')
        .order('Task ID', { ascending: false })
        .limit(4000);
      if (cErr) throw cErr;

      const norm = (s) => (s || '').toString().trim().toLowerCase();
      const generatedTodaySet = new Set();
      if (cRows) {
        cRows.forEach(r => {
          const d = r['Tast Descriptions'] || r['Task Description'] || '';
          const n = r['Name'] || '';
          const dt = r['Task Start Date'] || '';
          const p = parseDateString(dt);
          const dtStr = p ? formatDateToDDMMYYYY(p) : dt;
          if (dtStr === targetDateDDMMYYYY) {
            generatedTodaySet.add(`${norm(n)}:::${norm(d)}`);
          }
        });
      }

      // Prepare updates for templates that have tasks in Checklist for target date
      const updates = [];
      templates.forEach(t => {
        const d = t['Task Description'] || t['Tast Descriptions'] || '';
        const n = t['Name'] || '';
        const key = `${norm(n)}:::${norm(d)}`;
        if (generatedTodaySet.has(key)) {
          updates.push({
            id: t['Task ID'],
            dbId: t.id,
            newLastDate: targetDateDDMMYYYY
          });
        }
      });

      if (updates.length > 0) {
        const { updatedCount } = await updateUniqueTemplatesLastDateBatch(updates);
        // Refresh local templates
        const { data: refreshed } = await supabase.from('Unique').select('*').limit(3000);
        if (refreshed) setTemplates(refreshed);
        alert(`✅ Synced 'Last Date' to ${targetDateDDMMYYYY} for ${updatedCount} template(s) already generated in Checklist!`);
      } else {
        alert(`Sabhi templates pehle se hi synced hain (${targetDateDDMMYYYY})!`);
      }
    } catch (err) {
      console.error('Error syncing last dates:', err);
      alert(`Sync failed: ${err.message || err}`);
    } finally {
      setIsSyncingDates(false);
    }
  };

  // Helpers for Last Generated Date Inline Editing
  const ddmmyyyyToIso = (dStr) => {
    if (!dStr) return '';
    const d = parseDateString(dStr);
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isoToDdmmyyyy = (isoStr) => {
    if (!isoStr) return '';
    const [y, m, d] = isoStr.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  };

  const handleUpdateLastGeneratedDate = async (taskId, formattedDate) => {
    setUpdatingDateId(taskId);
    try {
      let res = await supabase
        .from('Unique')
        .update({ 'Last Date': formattedDate })
        .eq('Task ID', taskId);

      if (res.error) {
        // Fallback by id
        await supabase
          .from('Unique')
          .update({ 'Last Date': formattedDate })
          .eq('id', taskId);
      }

      // Update local templates state immediately
      setTemplates(prev =>
        prev.map(item =>
          String(item['Task ID'] ?? item.id) === String(taskId) ? { ...item, 'Last Date': formattedDate } : item
        )
      );
      setEditingTemplateForDate(null);
    } catch (err) {
      console.error('Failed to update Last Date:', err);
      alert(`Failed to update Last Generated date: ${err.message || err}`);
    } finally {
      setUpdatingDateId(null);
    }
  };

  // Delete a recurring template from Unique table
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);

  const handleDeleteTemplate = async (template) => {
    const taskId = template['Task ID'] ?? template.id;
    const desc = template['Task Description'] || template['Tast Descriptions'] || 'This template';
    const assignee = template.Name || 'Unassigned';

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete Recurring Template #${taskId} ("${desc}" assigned to ${assignee}) from Unique table? This template will no longer generate checklist tasks.`
    );
    if (!confirmDelete) return;

    setDeletingTemplateId(taskId);
    try {
      let res = await supabase
        .from('Unique')
        .delete()
        .eq('Task ID', taskId)
        .select();

      if (res.error) {
        // Fallback by id if needed
        res = await supabase
          .from('Unique')
          .delete()
          .eq('id', taskId)
          .select();
      }

      if (res.error) throw res.error;

      // Update local templates state immediately
      setTemplates(prev => prev.filter(t => String(t['Task ID'] ?? t.id) !== String(taskId)));
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert(`Failed to delete template: ${err.message || err}`);
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // =========================================================================
  // MANUAL DATA DUMP TO GOOGLE SHEET
  // =========================================================================
  const addDumpLog = (msg, type = 'info') => {
    setDumpLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: msg, type }]);
  };

  // Test Connection to Google Apps Script & Target Google Sheet
  const handleTestConnection = async () => {
    if (isTestingConnection) return;
    const scriptUrl = (appsScriptUrl || APPS_SCRIPT_URL).trim();
    const targetSpreadsheetId = extractSpreadsheetId(targetSheetUrl);

    if (!scriptUrl) {
      alert('Please enter a Google Apps Script Web App URL first!');
      return;
    }
    if (!targetSpreadsheetId) {
      alert('Please enter or paste a valid Google Sheet URL / ID in the Target Google Sheet field!');
      return;
    }

    setIsTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const formData = new FormData();
      formData.append('action', 'testConnection');
      formData.append('spreadsheetId', targetSpreadsheetId);
      formData.append('spreadsheetUrl', targetSheetUrl);

      const res = await fetch(scriptUrl, { method: 'POST', body: formData });
      if (!res.ok) {
        throw new Error(`Google Apps Script returned HTTP status ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        setConnectionTestResult({
          success: true,
          message: data.message || `Connected to "${data.spreadsheetName || 'Google Sheet'}"`,
          spreadsheetName: data.spreadsheetName,
          spreadsheetId: data.spreadsheetId,
          sheets: data.sheets || []
        });
      } else {
        setConnectionTestResult({
          success: false,
          message: data.error || 'Failed to connect to Google Sheet. Check permissions & ID.'
        });
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionTestResult({
        success: false,
        message: `Connection Failed: ${err.message || err}. Tip: Ensure Apps Script is deployed as "Web App" with access set to "Anyone".`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Fast parallel bulk fetch from Supabase (fetches all 10,000+ rows in parallel pages)
  const fetchAllTableRows = async (tableName) => {
    // 1. Get exact total count from Supabase
    const { count, error: countErr } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;
    const total = count || 0;
    if (total === 0) return [];

    const PAGE_SIZE = 1000;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    
    // Fetch pages in parallel batches
    const allRows = [];
    const CONCURRENT_BATCH = 5;

    for (let i = 0; i < totalPages; i += CONCURRENT_BATCH) {
      const pagePromises = [];
      for (let j = i; j < Math.min(i + CONCURRENT_BATCH, totalPages); j++) {
        const from = j * PAGE_SIZE;
        const to = Math.min((j + 1) * PAGE_SIZE - 1, total - 1);
        pagePromises.push(
          supabase
            .from(tableName)
            .select('*')
            .range(from, to)
        );
      }

      const results = await Promise.all(pagePromises);
      for (const res of results) {
        if (res.error) throw res.error;
        if (res.data) allRows.push(...res.data);
      }
    }

    return allRows;
  };

  const handleDumpToSheet = async (dumpType = 'all') => {
    if (isDumping) return;

    const currentScriptUrl = (appsScriptUrl || APPS_SCRIPT_URL).trim();
    const targetSpreadsheetId = extractSpreadsheetId(targetSheetUrl);

    if (!currentScriptUrl) {
      alert('Please enter or paste your Google Apps Script Web App URL!');
      return;
    }

    if (!targetSpreadsheetId) {
      alert('Please enter or paste a valid Google Sheet URL / ID in the Target Google Sheet field!');
      return;
    }

    // Persist configuration permanently
    localStorage.setItem('dump_apps_script_url', currentScriptUrl);
    localStorage.setItem('dump_target_sheet_url', targetSheetUrl);

    setIsDumping(true);
    setDumpProgress(5);
    setDumpLogs([]);
    setDumpStatusMsg('Starting high-speed data dump to Google Sheet...');
    addDumpLog(`Target Google Sheet ID: ${targetSpreadsheetId}`);
    addDumpLog(`Apps Script Web App: ${currentScriptUrl.slice(0, 40)}...`);
    addDumpLog(`🚀 Starting continuous bulk ${dumpType.toUpperCase()} data dump...`);

    const BATCH_SIZE = 2500; // Optimal reliable batch size

    try {
      // 1. DUMP CHECKLIST DATA
      if (dumpType === 'checklist' || dumpType === 'all') {
        addDumpLog('Fetching ALL Checklist table records from Supabase in bulk...');
        setDumpStatusMsg('Reading Checklist records from Supabase...');
        
        const checklistRows = await fetchAllTableRows('Checklist');
        checklistRows.sort((a, b) => {
          const idA = parseInt(a['Task ID'] ?? a['Task id'] ?? 0, 10) || 0;
          const idB = parseInt(b['Task ID'] ?? b['Task id'] ?? 0, 10) || 0;
          return idA - idB;
        });
        addDumpLog(`⚡ Fetched ALL ${checklistRows.length.toLocaleString()} total records from Checklist table!`);
        setDumpProgress(20);

        const checklistHeaders = [
          'Timestamp', 'Task ID', 'Department', 'Given By', 'Name', 'Tast Descriptions',
          'Task Start Date', 'Freq', 'Enable Reminders', 'Require Attachment', 'Actual',
          'Delay', 'Status', 'Remarks', 'Uploaded Image', 'Admin Done', 'Leave'
        ];

        const formattedChecklistData = checklistRows.map(r => [
          r['Timestamp'] || '',
          r['Task ID'] || '',
          r['Department'] || r['Firm'] || '',
          r['Given By'] || '',
          r['Name'] || '',
          r['Tast Descriptions'] || r['Task Description'] || '',
          r['Task Start Date'] || '',
          r['Freq'] || '',
          r['Enable Reminders'] || '',
          r['Require Attachment'] || '',
          r['Actual'] || '',
          r['Delay'] || '',
          r['Status'] || '',
          r['Remarks'] || '',
          r['Uploaded Image'] || '',
          r['Admin Done'] || '',
          r['Leave'] || ''
        ]);

        addDumpLog(`Writing total ${formattedChecklistData.length.toLocaleString()} Checklist rows to Google Sheet...`);
        setDumpStatusMsg(`Dumping ${formattedChecklistData.length.toLocaleString()} rows to Checklist sheet...`);

        const totalBatches = Math.ceil(formattedChecklistData.length / BATCH_SIZE);
        for (let b = 0; b < totalBatches; b++) {
          const i = b * BATCH_SIZE;
          const chunk = formattedChecklistData.slice(i, i + BATCH_SIZE);
          
          let attempts = 0;
          let batchSuccess = false;
          while (!batchSuccess && attempts < 3) {
            attempts++;
            try {
              const formData = new FormData();
              formData.append('action', 'dumpSheet');
              formData.append('sheetName', 'Checklist');
              formData.append('spreadsheetId', targetSpreadsheetId);
              formData.append('spreadsheetUrl', targetSheetUrl);
              formData.append('headers', JSON.stringify(checklistHeaders));
              formData.append('clearExisting', b === 0 && clearBeforeDump ? 'true' : 'false');
              formData.append('rowData', JSON.stringify(chunk));

              addDumpLog(`Batch ${b + 1}/${totalBatches}: Sending rows ${i + 1} to ${i + chunk.length} of ${formattedChecklistData.length}...`);
              const res = await fetch(currentScriptUrl, { method: 'POST', body: formData });
              if (!res.ok) throw new Error(`HTTP status ${res.status}: ${res.statusText}`);
              const resData = await res.json();
              if (resData && resData.success === false) throw new Error(resData.error || 'Apps Script error');
              batchSuccess = true;
            } catch (err) {
              console.warn(`Checklist Batch ${b + 1} attempt ${attempts} error:`, err);
              if (attempts >= 3) throw err;
              addDumpLog(`⚠️ Retrying Batch ${b + 1} (Attempt ${attempts + 1})...`, 'warning');
              await new Promise(r => setTimeout(r, 1500));
            }
          }

          const pct = Math.round(20 + ((b + 1) / totalBatches) * 40);
          setDumpProgress(pct);
          addDumpLog(`✅ Dumped ${i + chunk.length} / ${formattedChecklistData.length} Checklist rows.`);
        }

        addDumpLog(`🎉 Checklist sheet dump finished successfully (${formattedChecklistData.length.toLocaleString()} rows)!`, 'success');
      }

      // 2. DUMP DELEGATION DATA
      if (dumpType === 'delegation' || dumpType === 'all') {
        addDumpLog('Fetching ALL Delegation & DELEGATION DONE records from Supabase...');
        setDumpStatusMsg('Reading Delegation records from Supabase...');
        setDumpProgress(65);

        const [delRows, doneRows] = await Promise.all([
          fetchAllTableRows('Delegation'),
          fetchAllTableRows('DELEGATION DONE')
        ]);

        if (delRows && delRows.length > 0) {
          delRows.sort((a, b) => {
            const idA = parseInt(a['Task ID'] ?? a['Task id'] ?? 0, 10) || 0;
            const idB = parseInt(b['Task ID'] ?? b['Task id'] ?? 0, 10) || 0;
            return idA - idB;
          });
        }

        const delHeaders = [
          'Timestamp', 'Task ID', 'Department', 'Given By', 'Name', 'Task Description',
          'Task Start Date', 'Freq', 'Enable Reminders', 'Require Attachment',
          'Planned Date', 'Actual', 'Delay', 'Status', 'Remarks',
          'Upload Imgage', 'Update Date', 'Color Code For', 'Color Code', 'Admin Done', 'Filter Condition'
        ];

        if (delRows && delRows.length > 0) {
          const doneByTaskId = new Map();
          if (doneRows && doneRows.length > 0) {
            doneRows.forEach((row) => {
              const rawTaskId = row['Task id'] ?? row['Task ID'] ?? row['taskId'] ?? '';
              const taskIdStr = String(rawTaskId).trim();
              if (taskIdStr) {
                if (!doneByTaskId.has(taskIdStr)) {
                  doneByTaskId.set(taskIdStr, []);
                }
                doneByTaskId.get(taskIdStr).push(row);
              }
            });
          }

          const parseDumpDate = (val) => {
            if (!val) return null;
            if (val instanceof Date && !isNaN(val.getTime())) return val;
            if (typeof val !== 'string') return null;
            val = val.trim();
            if (!val) return null;
            const dmyMatch = val.match(
              /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(am|pm))?)?/i
            );
            if (dmyMatch) {
              const day = parseInt(dmyMatch[1], 10);
              const month = parseInt(dmyMatch[2], 10) - 1;
              const year = parseInt(dmyMatch[3], 10);
              let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
              const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
              const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
              const ampm = dmyMatch[7] ? dmyMatch[7].toLowerCase() : null;
              if (ampm === 'pm' && hours < 12) hours += 12;
              if (ampm === 'am' && hours === 12) hours = 0;
              return new Date(year, month, day, hours, minutes, seconds);
            }
            const ymdMatch = val.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
            if (ymdMatch) {
              return new Date(
                parseInt(ymdMatch[1], 10),
                parseInt(ymdMatch[2], 10) - 1,
                parseInt(ymdMatch[3], 10)
              );
            }
            const parsed = new Date(val);
            if (!isNaN(parsed.getTime())) return parsed;
            return null;
          };

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const formattedDelegation = delRows.map((r) => {
            const rawTaskId = r['Task ID'] ?? r['Task id'] ?? '';
            const taskIdStr = String(rawTaskId).trim();
            const taskDoneList = taskIdStr ? doneByTaskId.get(taskIdStr) || [] : [];
            const doneCount = taskDoneList.length;

            const col17_colorCodeFor = doneCount > 0 ? doneCount : r['Color Code For'] || 1;
            let col18_colorCode = 'Green';
            if (col17_colorCodeFor === 2) {
              col18_colorCode = 'Yellow';
            } else if (col17_colorCodeFor >= 3) {
              col18_colorCode = 'Red';
            }

            const latestDoneRecord =
              taskDoneList.length > 0 ? taskDoneList[taskDoneList.length - 1] : null;

            // Update Date (Col Q / col16): Latest "Next extend date"
            let maxExtendDateObj = null;
            let maxExtendDateStr = '';

            taskDoneList.forEach((doneItem) => {
              const rawExt = doneItem['Next extend date'];
              if (rawExt) {
                const dObj = parseDumpDate(rawExt);
                if (dObj) {
                  if (!maxExtendDateObj || dObj.getTime() > maxExtendDateObj.getTime()) {
                    maxExtendDateObj = dObj;
                    maxExtendDateStr = dObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
                  }
                } else if (!maxExtendDateStr) {
                  maxExtendDateStr = rawExt;
                }
              }
            });

            if (r['Update Date']) {
              const dObj = parseDumpDate(r['Update Date']);
              if (dObj) {
                if (!maxExtendDateObj || dObj.getTime() > maxExtendDateObj.getTime()) {
                  maxExtendDateObj = dObj;
                  maxExtendDateStr = dObj.toLocaleDateString('en-GB');
                }
              } else if (!maxExtendDateStr) {
                maxExtendDateStr = r['Update Date'];
              }
            }

            const col16_updateDate = maxExtendDateStr || '';

            // Planned Date (Col K / col10): IF((G="")*(Q=""), "", IF(G>Q, G, Q))
            const rawStartDate = r['Task Start Date'] || '';
            const gDate = parseDumpDate(rawStartDate);
            const qDate = parseDumpDate(col16_updateDate);

            let col10_plannedDate = '';
            if (gDate && qDate) {
              col10_plannedDate = gDate.getTime() > qDate.getTime() ? (r['Task Start Date'] || '') : col16_updateDate;
            } else if (qDate) {
              col10_plannedDate = col16_updateDate;
            } else if (gDate) {
              col10_plannedDate = rawStartDate;
            } else {
              col10_plannedDate = col16_updateDate || rawStartDate || '';
            }

            // Actual (Col L / col11): VLOOKUP(B&"Done", {'DELEGATION DONE'!B:B & 'DELEGATION DONE'!C:C, 'DELEGATION DONE'!A:A})
            // If the latest status is 'Extend date', Actual is blank so task returns to Pending/Planned
            let col11_actual = '';
            if (latestDoneRecord) {
              const latestSt = String(latestDoneRecord['Status'] || '').trim().toLowerCase();
              if (latestSt === 'done') {
                col11_actual = latestDoneRecord['Timestamp'] || '';
              } else {
                col11_actual = '';
              }
            } else {
              const rowSt = String(r['Status'] || '').trim().toLowerCase();
              if (rowSt === 'done') {
                col11_actual = r['Actual'] || '';
              } else {
                col11_actual = '';
              }
            }

            let col12_delay = '';
            const plannedDateObj = parseDumpDate(col10_plannedDate);
            if (plannedDateObj) {
              if (col11_actual) {
                const actualDateObj = parseDumpDate(col11_actual);
                if (actualDateObj && actualDateObj.getTime() > plannedDateObj.getTime()) {
                  const diffDays =
                    (actualDateObj.getTime() - plannedDateObj.getTime()) / (1000 * 60 * 60 * 24);
                  col12_delay = diffDays.toFixed(4);
                }
              } else {
                const now = new Date();
                if (now.getTime() > plannedDateObj.getTime()) {
                  const diffDays =
                    (now.getTime() - plannedDateObj.getTime()) / (1000 * 60 * 60 * 24);
                  col12_delay = diffDays.toFixed(4);
                }
              }
            }

            // Status (Col N / col13): Latest Status from DELEGATION DONE
            const col13_status = latestDoneRecord
              ? latestDoneRecord['Status'] || ''
              : r['Status'] || '';
            const col14_remarks = latestDoneRecord
              ? latestDoneRecord['Reason'] || latestDoneRecord['Remarks'] || ''
              : r['Remarks'] || '';

            let col15_uploadImage = '';
            if (latestDoneRecord && latestDoneRecord['Upload Image']) {
              col15_uploadImage = latestDoneRecord['Upload Image'];
            } else {
              col15_uploadImage = r['Upload Imgage'] || r['Upload Image'] || '';
            }

            // Admin Done (Col T / col19):
            let col19_adminDone = '';
            const rowAdminDone = String(r['Admin Done'] || '').trim().toLowerCase();
            const rowFilterCond = String(r['Filter Condition'] || '').trim().toLowerCase();
            const latestDoneAdminDone = latestDoneRecord ? String(latestDoneRecord['Admin Done'] || '').trim().toLowerCase() : '';
            const hasAnyDoneAdmin = taskDoneList.some(d => String(d['Admin Done'] || '').trim().toLowerCase() === 'done');

            if (rowAdminDone === 'done' || rowFilterCond === 'done' || latestDoneAdminDone === 'done' || hasAnyDoneAdmin) {
              col19_adminDone = 'Done';
            }

            let col20_filterCondition = '';
            if (!taskIdStr) {
              col20_filterCondition = '';
            } else if (col19_adminDone && col19_adminDone.toLowerCase() === 'done') {
              col20_filterCondition = 'Done';
            } else if (rowFilterCond === 'done') {
              col20_filterCondition = 'Done';
            } else if (!col11_actual) {
              if (plannedDateObj) {
                const pDay = new Date(plannedDateObj);
                pDay.setHours(0, 0, 0, 0);
                if (pDay.getTime() > today.getTime()) {
                  col20_filterCondition = 'Planned';
                } else {
                  col20_filterCondition = 'Pending';
                }
              } else {
                col20_filterCondition = 'Pending';
              }
            } else {
              col20_filterCondition = 'Verify Pending';
            }

            return [
              r['Timestamp'] || '',
              r['Task ID'] || '',
              r['Department'] || '',
              r['Given By'] || '',
              r['Name'] || '',
              r['Task Description'] || '',
              r['Task Start Date'] || '',
              r['Freq'] || '',
              r['Enable Reminders'] || '',
              r['Require Attachment'] || '',
              col10_plannedDate,
              col11_actual,
              col12_delay,
              col13_status,
              col14_remarks,
              col15_uploadImage,
              col16_updateDate,
              col17_colorCodeFor,
              col18_colorCode,
              col19_adminDone,
              col20_filterCondition
            ];
          });

          addDumpLog(
            `Writing total ${formattedDelegation.length.toLocaleString()} rows to DELEGATION Google Sheet...`
          );
          const totalDelBatches = Math.ceil(formattedDelegation.length / BATCH_SIZE);

          for (let b = 0; b < totalDelBatches; b++) {
            const i = b * BATCH_SIZE;
            const chunk = formattedDelegation.slice(i, i + BATCH_SIZE);
            const formData = new FormData();
            formData.append('action', 'dumpSheet');
            formData.append('sheetName', 'DELEGATION');
            formData.append('spreadsheetId', targetSpreadsheetId);
            formData.append('spreadsheetUrl', targetSheetUrl);
            formData.append('headers', JSON.stringify(delHeaders));
            formData.append('clearExisting', b === 0 && clearBeforeDump ? 'true' : 'false');
            formData.append('rowData', JSON.stringify(chunk));

            const res = await fetch(currentScriptUrl, { method: 'POST', body: formData });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          addDumpLog(
            `🎉 DELEGATION sheet dump finished (${formattedDelegation.length.toLocaleString()} rows)!`,
            'success'
          );
        }

        const doneHeaders = [
          'Timestamp', 'Task id', 'Status', 'Next extend date', 'Reason', 'Upload Image',
          'Condition Date', 'Name', 'Task Description', 'Given By', 'Admin Done'
        ];

        if (doneRows && doneRows.length > 0) {
          const formattedDone = doneRows.map(r => [
            r['Timestamp'] || '',
            r['Task id'] || '',
            r['Status'] || '',
            r['Next extend date'] || '',
            r['Reason'] || '',
            r['Upload Image'] || '',
            r['Condition Date'] || '',
            r['Name'] || '',
            r['Task Description'] || '',
            r['Given By'] || '',
            r['Admin Done'] || ''
          ]);

          addDumpLog(`Writing total ${formattedDone.length.toLocaleString()} rows to DELEGATION DONE Google Sheet...`);
          const totalDoneBatches = Math.ceil(formattedDone.length / BATCH_SIZE);

          for (let b = 0; b < totalDoneBatches; b++) {
            const i = b * BATCH_SIZE;
            const chunk = formattedDone.slice(i, i + BATCH_SIZE);
            const formDone = new FormData();
            formDone.append('action', 'dumpSheet');
            formDone.append('sheetName', 'DELEGATION DONE');
            formDone.append('spreadsheetId', targetSpreadsheetId);
            formDone.append('spreadsheetUrl', targetSheetUrl);
            formDone.append('headers', JSON.stringify(doneHeaders));
            formDone.append('clearExisting', b === 0 && clearBeforeDump ? 'true' : 'false');
            formDone.append('rowData', JSON.stringify(chunk));

            const res = await fetch(currentScriptUrl, { method: 'POST', body: formDone });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          addDumpLog(`🎉 DELEGATION DONE sheet dump finished (${formattedDone.length.toLocaleString()} rows)!`, 'success');
        }
      }

      // 3. DUMP WHATSAPP USERS DATA
      if (dumpType === 'whatsapp' || dumpType === 'all') {
        addDumpLog('Fetching Whatsapp Users from Supabase...');
        const whatsappRows = await fetchAllTableRows('Whatsapp');
        if (whatsappRows && whatsappRows.length > 0) {
          const whatsappHeaders = [
            'Department', 'Given By', 'Username', 'password', 'Role', 'Email', 'Number', 'Photo'
          ];

          const formattedWhatsapp = whatsappRows.map(r => [
            r['Department'] || '',
            r['Given By'] || '',
            r['Username'] || '',
            r['password'] || '',
            r['Role'] || '',
            r['Email'] || '',
            r['Number'] || '',
            r['Photo'] || ''
          ]);

          const formW = new FormData();
          formW.append('action', 'dumpSheet');
          formW.append('sheetName', 'Whatsapp');
          formW.append('spreadsheetId', targetSpreadsheetId);
          formW.append('spreadsheetUrl', targetSheetUrl);
          formW.append('headers', JSON.stringify(whatsappHeaders));
          formW.append('clearExisting', clearBeforeDump ? 'true' : 'false');
          formW.append('rowData', JSON.stringify(formattedWhatsapp));

          addDumpLog(`Writing ${formattedWhatsapp.length} rows to Whatsapp Google Sheet...`);
          const res = await fetch(currentScriptUrl, { method: 'POST', body: formW });
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          addDumpLog(`🎉 Whatsapp Users sheet dump finished!`, 'success');
        }
      }

      setDumpProgress(100);
      setDumpStatusMsg('🎉 Data Dump completed successfully!');
      addDumpLog('🎉 All selected sheets have been fully synchronized to Google Sheet!', 'success');
    } catch (err) {
      console.error('Data dump error:', err);
      setDumpStatusMsg(`Dump Failed: ${err.message || err}`);
      addDumpLog(`❌ Error dumping data: ${err.message || err}`, 'error');
    } finally {
      setIsDumping(false);
    }
  };

  // Download Instant CSV Backup
  const handleDownloadCSV = async (tableName) => {
    try {
      addDumpLog(`Exporting ${tableName} table to CSV file...`);
      const { data, error } = await supabase.from(tableName).select('*').limit(5000);
      if (error) throw error;

      if (!data || data.length === 0) {
        alert(`No data found in ${tableName} to export.`);
        return;
      }

      const headers = Object.keys(data[0]);
      const csvRows = [];
      csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

      data.forEach(row => {
        const values = headers.map(header => {
          const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          return `"${val.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      });

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${tableName}_Backup_${todayFormatted.replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addDumpLog(`✅ Downloaded ${tableName} CSV file successfully!`, 'success');
    } catch (err) {
      console.error('CSV Export Error:', err);
      alert(`Export failed: ${err.message || err}`);
    }
  };

  // Computed Values
  const todayObj = new Date();
  const todayFormatted = formatDateToDDMMYYYY(todayObj);

  const isTodayHoliday = useMemo(() => {
    return holidays.find(h => {
      const hd = parseDateString(h.Date);
      return hd && isSameDay(hd, todayObj);
    });
  }, [holidays, todayObj]);

  const isTodayInCalendar = useMemo(() => {
    if (calendarDates.length === 0) return false;
    return calendarDates.some(c => {
      const cd = parseDateString(c.Date);
      return cd && isSameDay(cd, todayObj);
    });
  }, [calendarDates, todayObj]);

  const isWorkingDayToday = !isTodayHoliday && isTodayInCalendar;

  const dueTemplatesCount = useMemo(() => {
    const target = selectedDate ? new Date(selectedDate) : todayObj;
    return templates.filter(t => isTemplateDue(t, target).isDue).length;
  }, [templates, selectedDate, todayObj]);

  // Unique list of all Assignees / Person Names from active users
  const uniqueAssignees = useMemo(() => {
    const names = new Set();
    users.forEach(u => {
      const un = (u.Username || u['User name'] || '').trim();
      const role = (u.Role || '').trim().toLowerCase();
      const status = (u.Status || '').trim().toLowerCase();
      const isDeleted = un.toUpperCase().startsWith('DELETED_') || un.toUpperCase().startsWith('DEL_') || role === 'deleted' || status === 'deleted';
      const isInactive = role === 'inactive' || role === 'in active' || role === 'in-active' || role === 'inactiv' || role === 'in activ' || status === 'inactive';
      if (un && !isDeleted && !isInactive) names.add(un);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [users]);

  // Filtered & Sorted Templates (Natural Numeric Ordering by Task ID)
  const filteredTemplates = useMemo(() => {
    if (currentTab !== 'recurring-templates') return [];
    const target = selectedDate ? new Date(selectedDate) : todayObj;
    const list = templates.filter(t => {
      const taskDesc = (t['Task Description'] || t['Tast Descriptions'] || '').toLowerCase();
      const name = (t.Name || '').toLowerCase();
      const dept = (t.Department || '').toLowerCase();
      const freq = (t.Frequency || t.Freq || '').toLowerCase();
      const taskIdStr = String(t['Task ID'] ?? t.id ?? '').toLowerCase();
      const q = searchTerm.toLowerCase();

      const matchesSearch = !q || taskDesc.includes(q) || name.includes(q) || dept.includes(q) || taskIdStr.includes(q);
      const matchesAssignee = assigneeFilter === 'ALL' || (t.Name || '').trim().toLowerCase() === assigneeFilter.toLowerCase();
      const matchesFreq = freqFilter === 'ALL' || freq === freqFilter.toLowerCase();
      
      const dueInfo = isTemplateDue(t, target);
      let matchesStatus = true;
      if (statusFilter === 'DUE') matchesStatus = dueInfo.isDue;
      if (statusFilter === 'UP_TO_DATE') matchesStatus = !dueInfo.isDue;

      return matchesSearch && matchesAssignee && matchesFreq && matchesStatus;
    });

    // Strictly sort by Task ID numerically (e.g. 1, 2, 44, 59, 237, 379, 382, 434, 632)
    return list.sort((a, b) => {
      const rawA = a['Task ID'] ?? a['id'] ?? 0;
      const rawB = b['Task ID'] ?? b['id'] ?? 0;

      const numA = parseInt(String(rawA).replace(/\D/g, ''), 10);
      const numB = parseInt(String(rawB).replace(/\D/g, ''), 10);

      const valA = isNaN(numA) ? 0 : numA;
      const valB = isNaN(numB) ? 0 : numB;

      if (valA !== valB) {
        return taskIdSortOrder === 'ASC' ? valA - valB : valB - valA;
      }

      return taskIdSortOrder === 'ASC'
        ? String(rawA).localeCompare(String(rawB), undefined, { numeric: true })
        : String(rawB).localeCompare(String(rawA), undefined, { numeric: true });
    });
  }, [templates, searchTerm, assigneeFilter, freqFilter, statusFilter, selectedDate, todayObj, taskIdSortOrder, currentTab]);

  // Synchronized Top Horizontal Scrollbar for Recurring Templates Table
  const topScrollRef = useRef(null);
  const tableScrollRef = useRef(null);
  const isSyncingScroll = useRef(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);

  const handleTopScroll = () => {
    if (isSyncingScroll.current) return;
    if (topScrollRef.current && tableScrollRef.current) {
      isSyncingScroll.current = true;
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      requestAnimationFrame(() => { isSyncingScroll.current = false; });
    }
  };

  const handleTableScroll = () => {
    if (isSyncingScroll.current) return;
    if (topScrollRef.current && tableScrollRef.current) {
      isSyncingScroll.current = true;
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
      requestAnimationFrame(() => { isSyncingScroll.current = false; });
    }
  };

  useEffect(() => {
    if (currentTab !== 'recurring-templates') return;
    const updateScrollWidth = () => {
      if (tableScrollRef.current) {
        setTableScrollWidth(tableScrollRef.current.scrollWidth);
      }
    };
    updateScrollWidth();
    const timer = setTimeout(updateScrollWidth, 80);
    window.addEventListener('resize', updateScrollWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScrollWidth);
    };
  }, [currentTab, filteredTemplates]);

  return (
    <AdminLayout>
      <div className="min-h-screen p-4 md:p-8 space-y-8 bg-slate-50/50">
        
        {/* ========================================================================= */}
        {/* TOP SUB-NAVIGATION BAR (WHEN VIEWING INDIVIDUAL SUB-SECTIONS)             */}
        {/* ========================================================================= */}
        {currentTab !== 'home' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm">
            <Link
              to="/dashboard/settings"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>← Back to Settings Home</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/dashboard/settings#user-management"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'user-management'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>User ID Directory</span>
              </Link>

              <Link
                to="/dashboard/settings#manual-data-dump"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'manual-data-dump'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Google Sheet Dump</span>
              </Link>

              <Link
                to="/dashboard/settings#trigger-console"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'trigger-console'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Trigger Console</span>
              </Link>

              <Link
                to="/dashboard/settings#recurring-templates"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'recurring-templates'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <ListChecks className="h-3.5 w-3.5" />
                <span>Recurring Templates</span>
              </Link>

              <Link
                to="/dashboard/settings/whatsapp-sms"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                <span>Whatsapp Service</span>
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SETTINGS HOME HUB (RENDERED ONLY ON /dashboard/settings WITH NO SUB-HASH) */}
        {/* ========================================================================= */}
        {currentTab === 'home' && (
          <div className="space-y-8">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-2xl border border-slate-800">
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" />
                    Admin Settings & Control Center
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                    ⚙️ Settings & Administration Hub
                  </h1>
                  <p className="text-slate-300 text-sm md:text-base max-w-2xl">
                    Niche diye gaye kisi bhi module par click karke user IDs manage karein, Google Sheet me live data dump karein, task generator trigger run karein, ya WhatsApp SMS settings configure karein.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/dashboard/settings/whatsapp-sms"
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-white shadow-lg transition-all duration-300 bg-emerald-600/40 hover:bg-emerald-600/60 border border-emerald-500/40 hover:shadow-emerald-500/20 active:scale-95 text-xs"
                  >
                    <MessageSquare className="h-4 w-4 text-emerald-300" />
                    <span>💬 WhatsApp SMS & Logs</span>
                  </Link>

                  <button
                    onClick={handleOpenCreateUserModal}
                    className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-white shadow-lg transition-all duration-300 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/25 active:scale-95 text-xs cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>+ Create New User ID</span>
                  </button>

                  <button
                    onClick={() => handleExecuteTrigger()}
                    disabled={isRunningTrigger || loading}
                    className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-white shadow-lg transition-all duration-300 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 hover:shadow-indigo-500/25 active:scale-95 disabled:opacity-50 text-xs cursor-pointer"
                  >
                    <Zap className={`h-4 w-4 ${isRunningTrigger ? 'animate-bounce text-amber-300' : 'text-amber-300 fill-amber-300'}`} />
                    <span>{isRunningTrigger ? 'Generating Tasks...' : '⚡ Run Task Generator'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Overview Stats (Moved to 2nd position) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Stat 1: Checklist */}
              <div className="card-3d-wrapper card-3d-blue">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Checklist Total</span>
                  <div className="crystal-orb-3d crystal-orb-blue">
                    <ListChecks className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl number-3d-text text-slate-800">{checklistCount.toLocaleString()}</div>
                  <p className="text-xs text-slate-500 mt-0.5">Rows in Supabase Checklist</p>
                </div>
              </div>

              {/* Stat 2: Delegation */}
              <div className="card-3d-wrapper card-3d-purple">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Delegation Total</span>
                  <div className="crystal-orb-3d crystal-orb-purple">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl number-3d-text text-purple-700">{delegationCount.toLocaleString()}</div>
                  <p className="text-xs text-slate-500 mt-0.5">Rows in Supabase Delegation</p>
                </div>
              </div>

              {/* Stat 3: Working Calendar */}
              <div className={`card-3d-wrapper ${isWorkingDayToday ? 'card-3d-emerald' : 'card-3d-rose'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Working Calendar</span>
                  <div className={`crystal-orb-3d ${isWorkingDayToday ? 'crystal-orb-emerald' : 'crystal-orb-rose'}`}>
                    <Calendar className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isWorkingDayToday ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isWorkingDayToday ? '🟢 Working Day' : isTodayHoliday ? `🔴 Holiday (${isTodayHoliday.Holiday})` : '🟡 Off Day'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Today: {todayFormatted}</p>
                </div>
              </div>

              {/* Stat 4: Today's Generated */}
              <div className="card-3d-wrapper card-3d-amber">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Generated</span>
                  <div className="crystal-orb-3d crystal-orb-amber">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl number-3d-text text-amber-700">{todayGeneratedCount.toLocaleString()}</div>
                  <p className="text-xs text-slate-500 mt-0.5">Tasks generated today ({todayFormatted})</p>
                </div>
              </div>
            </div>

            {/* The 5 Settings Hub Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* 1. User ID Directory & Management */}
              <div className="bg-white/90 backdrop-blur-xl border-2 border-emerald-100 rounded-3xl p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-emerald-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                      <Users className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      {users.length} Users
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      User ID Directory & Management
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Whatsapp table ke sabhi users ko view karein, naye User ID & password banayein, aur Admin / User roles manage karein.
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Whatsapp Table</span>
                  <Link
                    to="/dashboard/settings#user-management"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Open User Directory</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* 2. Manual Data Dump to Google Sheet */}
              <div className="bg-white/90 backdrop-blur-xl border-2 border-indigo-100 rounded-3xl p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-indigo-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Live Google Sheets
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 group-hover:text-indigo-700 transition-colors">
                      Manual Data Dump to Google Sheet
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Checklist, Delegation aur Whatsapp users ka poora data single click me live Google Sheet me dump / sync karein.
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">
                    {checklistCount.toLocaleString()} Rows
                  </span>
                  <Link
                    to="/dashboard/settings#manual-data-dump"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Open Data Dump</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* 3. Task Generation Trigger Console */}
              <div className="bg-white/90 backdrop-blur-xl border-2 border-purple-100 rounded-3xl p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-purple-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                      <Sliders className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {formatHourLabel(nightlyTriggerHour)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 group-hover:text-purple-700 transition-colors">
                      Task Generation Trigger Console
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Automated Cloud Cron schedule manage karein, manual task triggers execute karein aur live trigger execution logs dekhein.
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">
                    Today: {todayGeneratedCount.toLocaleString()} Tasks
                  </span>
                  <Link
                    to="/dashboard/settings#trigger-console"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Open Trigger Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* 4. Recurring Checklist Templates Inspector */}
              <div className="bg-white/90 backdrop-blur-xl border-2 border-blue-100 rounded-3xl p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-blue-300">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                      <ListChecks className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {templates.length} Templates
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 group-hover:text-blue-700 transition-colors">
                      Recurring Checklist Templates Inspector
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      'Unique' table ke recurring task templates dekhein, Last Generated date update karein aur individual task trigger karein.
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Unique Table</span>
                  <Link
                    to="/dashboard/settings#recurring-templates"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Inspect Templates</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* 5. Whatsapp Service */}
              <div className="bg-white/90 backdrop-blur-xl border-2 border-emerald-200 rounded-3xl p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-emerald-400">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-green-600 text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Maytapi API
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      Whatsapp Service
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Maytapi WhatsApp credentials configure karein, automated task reminder SMS bhejein aur live message delivery logs monitor karein.
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">SMS & Logs</span>
                  <Link
                    to="/dashboard/settings/whatsapp-sms"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Open Whatsapp Service</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* NEW DEDICATED SECTION 1: USER ID MANAGEMENT & CREATION (WHATSAPP TABLE)   */}
        {/* ========================================================================= */}
        {currentTab === 'user-management' && (
          <div id="user-management" className="bg-white/90 backdrop-blur-xl border-2 border-emerald-200/80 rounded-3xl p-6 md:p-8 shadow-md space-y-6 scroll-mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-50">
                  <Users className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
                      User ID Directory &amp; Management
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Whatsapp Table &middot; {users.length} Users
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Naye user IDs create karein, passwords reset karein aur roles (Admin / User) manage karein.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                <button
                  onClick={() => handleDownloadCSV('Whatsapp')}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-95"
                  title="Download all users to CSV"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={handleOpenCreateUserModal}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-95"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Create New User ID</span>
                </button>
              </div>
            </div>

            {/* User Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex w-full flex-1 flex-wrap items-center gap-3 md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search user name, phone, dept..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">🛡️ Admin Only</option>
                  <option value="USER">👤 User Only</option>
                  <option value="INACTIVE">⛔ Inactive Only</option>
                </select>
              </div>

              <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                Showing <span className="text-slate-700">{filteredUsers.length}</span> of {users.length} users
              </span>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/90 backdrop-blur sticky top-0 z-10 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">WhatsApp Mobile Number</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Password</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400 italic">
                        No matching users found in Whatsapp table. Click "+ Create New User ID" to add one.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, idx) => {
                      const role = (user.Role || 'user').toLowerCase();
                      const isInactive = role === 'in active' || role === 'inactive';
                      const isAdmin = role === 'admin';
                      const avatarUrl = user.Photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.Username || 'U')}&background=6366f1&color=fff&bold=true`;

                      return (
                        <tr key={user.Username || idx} className={`hover:bg-slate-50/80 transition-colors ${isInactive ? 'opacity-60 bg-slate-50/50' : ''}`}>
                          
                          {/* User & Avatar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={avatarUrl}
                                alt={user.Username}
                                className="h-8 w-8 rounded-full object-cover border border-slate-200 shadow-sm"
                                onError={(e) => {
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.Username || 'U')}&background=6366f1&color=fff&bold=true`;
                                }}
                              />
                              <div>
                                <span className="font-bold text-slate-800 block">{user.Username}</span>
                                {user.Email && <span className="text-[10px] text-slate-400 block">{user.Email}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Number */}
                          <td className="py-3 px-4 font-mono">
                            {user.Number ? (
                              <a
                                href={`https://wa.me/91${user.Number.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold"
                              >
                                <Phone className="h-3 w-3 text-emerald-600" />
                                <span>{user.Number}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Role */}
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isAdmin ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                              isInactive ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {isAdmin && <Shield className="h-3 w-3" />}
                              {isInactive ? '⛔ Inactive' : isAdmin ? '🛡️ Admin' : '👤 User'}
                            </span>
                          </td>

                          {/* Password */}
                          <td className="py-3 px-4 font-mono text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold">
                              {user.password || '••••••'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {/* Toggle Active / Inactive */}
                              <button
                                onClick={() => handleToggleUserStatus(user)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isInactive 
                                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                    : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                }`}
                                title={isInactive ? 'Activate User' : 'Deactivate User'}
                              >
                                {isInactive ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                              </button>

                              {/* Edit User */}
                              <button
                                onClick={() => handleOpenEditUserModal(user)}
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                title="Edit User ID & Password"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete User */}
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                title="Delete User ID permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CREATE / EDIT USER ID                                              */}
        {/* ========================================================================= */}
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-5 p-6 md:p-8">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">
                      {isEditingUser ? `Edit User: ${userFormData.originalUsername}` : 'Create New User ID'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Stores user credentials directly in Supabase 'Whatsapp' table
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Feedback Alerts */}
              {userFormError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{userFormError}</span>
                </div>
              )}

              {userFormSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{userFormSuccess}</span>
                </div>
              )}

              {/* Form Inputs */}
              <form onSubmit={handleSaveUser} className="space-y-4">
                
                {/* Photo & Name Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 transition-colors">
                    <div className="relative group cursor-pointer">
                      <img
                        src={userPhotoPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(userFormData.Username || 'U')}&background=6366f1&color=fff&bold=true`}
                        alt="Preview"
                        className="h-16 w-16 rounded-full object-cover border-2 border-emerald-500/30"
                      />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera className="h-5 w-5 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1.5 font-medium">Photo (Optional)</span>
                  </div>

                  {/* Username & Password */}
                  <div className="sm:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Username <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rohan Sharma"
                        value={userFormData.Username}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, Username: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rohan@123"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <Key className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    User Role <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setUserFormData(prev => ({ ...prev, Role: 'user' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        userFormData.Role === 'user'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Standard User</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserFormData(prev => ({ ...prev, Role: 'admin' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        userFormData.Role === 'admin'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserFormData(prev => ({ ...prev, Role: 'In Active' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        userFormData.Role === 'In Active'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <UserX className="h-3.5 w-3.5" />
                      <span>In Active</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Number & Email (Optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      WhatsApp Mobile Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={userFormData.Number}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, Number: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Email Address (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="e.g. user@company.com"
                        value={userFormData.Email}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, Email: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    disabled={userFormSubmitting}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={userFormSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {userFormSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Saving User...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{isEditingUser ? 'Update User ID' : 'Save New User ID'}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* NEW DEDICATED SECTION 2: MANUAL DATA DUMP TO GOOGLE SHEET & BACKUP        */}
        {/* ========================================================================= */}
        {currentTab === 'manual-data-dump' && (
          <div id="manual-data-dump" className="bg-white/90 backdrop-blur-xl border-2 border-indigo-200/80 rounded-3xl p-6 md:p-8 shadow-md space-y-6 scroll-mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                    <span>📤 Manual Data Dump to Google Sheet</span>
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Live Sheet Sync
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Checklist, Delegation aur Whatsapp users ka live Supabase data ek click me Google Sheet par dump / sync karein.
                  </p>
                </div>
              </div>

              {/* Overwrite Toggle */}
              <label className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={clearBeforeDump}
                  onChange={(e) => setClearBeforeDump(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-700">Overwrite / Replace Sheet Content</span>
              </label>
            </div>

            {/* Configuration: Apps Script URL & Target Google Sheet URL/ID */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-indigo-100/80 shadow-sm space-y-4">
              
              {/* Field 1: Google Apps Script Web App URL */}
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Google Apps Script Web App URL
                    </label>
                    {isAppsScriptSaved && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold animate-in fade-in">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAppsScriptUrlChange(APPS_SCRIPT_URL)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline self-start sm:self-auto"
                    title="Reset to default deployment script URL"
                  >
                    Reset to Default Script URL
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={appsScriptUrl}
                    onChange={(e) => handleAppsScriptUrlChange(e.target.value)}
                    placeholder="https://script.google.com/macros/s/XXXXX/exec"
                    className="w-full pl-3.5 pr-8 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                  />
                  {appsScriptUrl && (
                    <button
                      type="button"
                      onClick={() => handleAppsScriptUrlChange('')}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1"
                      title="Clear Apps Script URL"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Google Apps Script Web App deployment link (e.g. <code className="text-indigo-700 bg-indigo-50 px-1 rounded">https://script.google.com/macros/s/.../exec</code>). Yahan naya deployed Apps Script URL paste kar sakte hain.
                </p>
              </div>

              {/* Field 2: Target Google Sheet URL / ID */}
              <div className="space-y-1.5 pt-3 border-t border-indigo-100/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Target Google Sheet URL / Spreadsheet ID
                    </label>
                    {isUrlSaved && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold animate-in fade-in">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    )}
                  </div>
                  {extractSpreadsheetId(targetSheetUrl) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                      <span className="text-slate-400">Extracted ID:</span>
                      <span className="font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md truncate max-w-[200px] sm:max-w-[300px]">
                        {extractSpreadsheetId(targetSheetUrl)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={targetSheetUrl}
                      onChange={(e) => handleTargetSheetUrlChange(e.target.value)}
                      placeholder="Paste Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/1r3YHy.../edit) or raw Sheet ID"
                      className="w-full pl-3.5 pr-8 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                    />
                    {targetSheetUrl && (
                      <button
                        type="button"
                        onClick={() => handleTargetSheetUrlChange('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                        title="Clear URL"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {targetSheetUrl && (
                    <a
                      href={targetSheetUrl.startsWith('http') ? targetSheetUrl : `https://docs.google.com/spreadsheets/d/${targetSheetUrl}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                      title="Open Target Google Sheet in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Open Sheet</span>
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Jis Google Sheet me data dump karna hai uska URL ya Sheet ID yahan paste karein.
                </p>
              </div>

              {/* Action Buttons: Save Configuration & Test Connection */}
              <div className="pt-3 border-t border-indigo-100/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveSheetConfig}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Configuration (Permanent)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || !targetSheetUrl || !appsScriptUrl}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/20 active:scale-95 cursor-pointer"
                  >
                    {isTestingConnection ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Testing Connection...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5" />
                        <span>Test Connection (Verify Sheet &amp; Script)</span>
                      </>
                    )}
                  </button>
                </div>

                <span className="text-[11px] text-slate-500 italic">
                  * Ek baar <strong>Save Configuration</strong> kar denge to aage se hamesha isi Sheet me data dump hoga.
                </span>
              </div>

              {/* Save Success Banner */}
              {saveSuccessMsg && (
                <div className="p-3.5 rounded-xl border bg-emerald-50 border-emerald-300 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in shadow-sm">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{saveSuccessMsg}</span>
                </div>
              )}

              {/* Test Connection Result Card */}
              {connectionTestResult && (
                <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                  connectionTestResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {connectionTestResult.success ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold">{connectionTestResult.message}</div>
                    {connectionTestResult.sheets && connectionTestResult.sheets.length > 0 && (
                      <div className="text-[11px] opacity-90">
                        Existing Sheet Tabs: <span className="font-mono font-semibold">{connectionTestResult.sheets.join(', ')}</span>
                      </div>
                    )}
                    {!connectionTestResult.success && (
                      <div className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                        👉 <strong>Checklist for Resolution:</strong><br />
                        1. Google Apps Script me <code className="bg-rose-100 px-1 py-0.5 rounded">apps-script-Code-final.gs</code> ka latest code paste karein.<br />
                        2. <strong>Deploy &gt; New deployment &gt; Select type: Web App</strong> karein.<br />
                        3. <strong>Execute as: Me</strong> aur <strong>Who has access: Anyone</strong> select karein.<br />
                        4. Google Sheet me edit access allow hona chahiye.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Dump Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* 1. Checklist Dump Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border border-indigo-100 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-indigo-600" />
                      Checklist Sheet Dump
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200/60 font-bold text-indigo-800">
                      {checklistCount.toLocaleString()} Rows
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Supabase `Checklist` table ka saara data Google Sheet ke `Checklist` tab me dump karta hai.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleDumpToSheet('checklist')}
                    disabled={isDumping}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <UploadCloud className={`h-4 w-4 ${isDumping ? 'animate-bounce' : ''}`} />
                    <span>Dump Checklist to Google Sheet</span>
                  </button>
                  <button
                    onClick={() => handleDownloadCSV('Checklist')}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl font-semibold text-[11px] text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Checklist CSV</span>
                  </button>
                </div>
              </div>

              {/* 2. Delegation Dump Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/80 to-pink-50/50 border border-purple-100 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-purple-950 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-600" />
                      Delegation Sheet Dump
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200/60 font-bold text-purple-800">
                      {delegationCount.toLocaleString()} Rows
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Supabase `Delegation` aur `DELEGATION DONE` tables ka data Google Sheet me sync karta hai.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleDumpToSheet('delegation')}
                    disabled={isDumping}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <UploadCloud className={`h-4 w-4 ${isDumping ? 'animate-bounce' : ''}`} />
                    <span>Dump Delegation to Google Sheet</span>
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleDownloadCSV('Delegation')}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl font-semibold text-[10px] text-purple-700 bg-white border border-purple-200 hover:bg-purple-50 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>Delegation CSV</span>
                    </button>
                    <button
                      onClick={() => handleDownloadCSV('DELEGATION DONE')}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl font-semibold text-[10px] text-purple-700 bg-white border border-purple-200 hover:bg-purple-50 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>Done CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Full Combined Dump Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white space-y-4 flex flex-col justify-between shadow-lg shadow-emerald-500/20">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      Full Sync (All Sheets)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                      Checklist + Delegation + Users
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100 leading-relaxed">
                    Ek sath Checklist + Delegation + Whatsapp Users ka poora data live Google Sheet par dump karein.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleDumpToSheet('all')}
                    disabled={isDumping}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs text-slate-900 bg-white hover:bg-emerald-50 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Zap className={`h-4 w-4 text-emerald-600 ${isDumping ? 'animate-spin' : ''}`} />
                    <span>{isDumping ? 'Dumping in Progress...' : '🚀 Dump All to Google Sheet'}</span>
                  </button>
                  <a
                    href={targetSheetUrl.startsWith('http') ? targetSheetUrl : `https://docs.google.com/spreadsheets/d/${targetSheetUrl}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl font-semibold text-[11px] text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open Target Google Sheet</span>
                  </a>
                </div>
              </div>

            </div>

            {/* Progress Bar & Live Dump Status (when running) */}
            {(isDumping || dumpProgress > 0) && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2 text-emerald-400 font-mono">
                    <RefreshCw className={`h-3.5 w-3.5 ${isDumping ? 'animate-spin' : ''}`} />
                    {dumpStatusMsg}
                  </span>
                  <span className="font-bold font-mono text-emerald-400">{dumpProgress}%</span>
                </div>

                {/* Progress track */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 rounded-full"
                    style={{ width: `${dumpProgress}%` }}
                  />
                </div>

                {/* Logs terminal */}
                <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px] pt-2 border-t border-slate-800">
                  {dumpLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-slate-500">[{log.time}]</span>
                      <span className={
                        log.type === 'error' ? 'text-rose-400 font-bold' :
                        log.type === 'success' ? 'text-emerald-400 font-bold' :
                        'text-slate-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: TASK GENERATION TRIGGER CONSOLE & AUTOMATION                   */}
        {/* ========================================================================= */}
        {currentTab === 'trigger-console' && (
          <div id="trigger-console" className="grid grid-cols-1 lg:grid-cols-3 gap-8 scroll-mt-6">
            
            {/* Left 2 Cols: Interactive Trigger Console */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 md:p-7 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                      <Sliders className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Task Generation Trigger Console</h2>
                      <p className="text-xs text-slate-500">Run or simulate task generation from Unique templates</p>
                    </div>
                  </div>
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Sync Data
                  </button>
                </div>

                {/* Live Cloud Cron Countdown & Timing Control Banner */}
                <div className="rounded-2xl p-4 md:p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/40 text-white shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left: Schedule Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          Automated Cloud Trigger
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-[10px] font-semibold text-indigo-200">
                          {formatHourLabel(nightlyTriggerHour)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Next Auto-Run: <span className="text-white font-semibold">{countdown.nextDateStr}</span>
                      </p>
                    </div>

                    {/* Right: Live Digital Countdown */}
                    <div className="flex items-center gap-2 bg-black/40 border border-indigo-500/30 rounded-2xl px-4 py-2 self-start md:self-auto shadow-inner">
                      <Clock className="h-5 w-5 text-amber-400 animate-pulse shrink-0" />
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <div className="text-center">
                          <span className="text-lg md:text-xl font-black text-white bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700 shadow">
                            {countdown.hours}
                          </span>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans mt-0.5">Hours</span>
                        </div>
                        <span className="text-amber-400 font-bold text-lg">:</span>
                        <div className="text-center">
                          <span className="text-lg md:text-xl font-black text-white bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700 shadow">
                            {countdown.minutes}
                          </span>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans mt-0.5">Mins</span>
                        </div>
                        <span className="text-amber-400 font-bold text-lg">:</span>
                        <div className="text-center">
                          <span className="text-lg md:text-xl font-black text-amber-300 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700 shadow">
                            {countdown.seconds}
                          </span>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans mt-0.5">Secs</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Change Trigger Timing Control Bar */}
                  <div className="pt-3 border-t border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-indigo-200">
                      <Sliders className="h-4 w-4 text-indigo-400" />
                      <span>Change Automatic Trigger Time:</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={selectedTimingHour}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTimingHour(val);
                          setNightlyTriggerHour(val);
                          localStorage.setItem('nightly_trigger_hour', String(val));
                        }}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                      >
                        {TIMING_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSetupNightlyTrigger(selectedTimingHour)}
                        disabled={isSettingUpNightlyTrigger}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                      >
                        <Zap className={`h-3 w-3 ${isSettingUpNightlyTrigger ? 'animate-spin' : ''}`} />
                        <span>{isSettingUpNightlyTrigger ? 'Updating...' : 'Set Timing'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Trigger Settings Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Target Execution Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Tasks will be dated for this day</p>
                  </div>

                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Calendar Policy
                    </label>
                    <label className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={ignoreCalendarCheck}
                        onChange={(e) => setIgnoreCalendarCheck(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-700 block">Ignore Holiday / Calendar Check</span>
                        <span className="text-slate-400 text-[10px]">Force run even if marked non-working day</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action Trigger Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-purple-50/70 to-pink-50/70 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-indigo-600" />
                      <span>Trigger Ready: {dueTemplatesCount} template(s) due to generate</span>
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Evaluates frequencies (Daily, Weekly, Monthly, Yearly) and automatically prevents duplicate generation.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExecuteTrigger()}
                    disabled={isRunningTrigger || loading}
                    className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isRunningTrigger ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-white" />
                        <span>Execute Trigger</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Execution Output Terminal */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      Live Trigger Terminal Logs
                    </span>
                    {executionLogs.length > 0 && (
                      <button
                        onClick={() => setExecutionLogs([])}
                        className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 font-mono text-xs max-h-56 overflow-y-auto space-y-1.5 border border-slate-800 shadow-inner">
                    {executionLogs.length === 0 ? (
                      <div className="text-slate-500 italic py-3 text-center">
                        Click 'Execute Trigger' or 'Run Task Generator' to initiate live task generation logs.
                      </div>
                    ) : (
                      executionLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-slate-500 select-none">[{log.time}]</span>
                          <span className={
                            log.type === 'error' ? 'text-rose-400 font-semibold' :
                            log.type === 'warning' ? 'text-amber-300' :
                            log.type === 'success' ? 'text-emerald-400 font-semibold' :
                            'text-slate-300'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Result Notification Card if triggered */}
                {lastResult && (
                  <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-3 ${
                    lastResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    {lastResult.success ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">{lastResult.message}</div>
                      <div className="text-[11px] opacity-80 mt-1">
                        Inserted {lastResult.tasksGenerated || 0} tasks into Checklist table in Supabase.
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right 1 Col: Automation & Schedule Settings */}
            <div className="space-y-6">
              
              {/* 🌙 Nightly Cloud Cron Generator Card */}
              <div className="relative overflow-hidden rounded-[28px] p-[1px] bg-gradient-to-br from-indigo-400/40 via-purple-500/20 to-transparent shadow-2xl shadow-indigo-950/40">
                <div className="relative rounded-[27px] bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950/90 text-white p-6 space-y-5 overflow-hidden">
                  {/* Ambient glow accents */}
                  <div className="absolute -top-16 -right-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-20 -left-12 w-52 h-52 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute inset-0 opacity-[0.15] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '22px 22px' }} />

                  {/* Header */}
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-amber-300 shadow-lg shadow-indigo-500/40">
                        <Moon className="h-5 w-5" />
                        <span className="absolute inset-0 rounded-2xl ring-1 ring-white/20" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">Cloud Task Generator</h3>
                        <p className="text-[11px] text-indigo-300/90 font-medium">Serverless Google Cloud Cron</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-400/30 shadow-sm shadow-emerald-500/20">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                      </span>
                      Active
                    </span>
                  </div>

                  {/* Countdown widget */}
                  <div className="relative rounded-2xl bg-black/30 border border-white/10 backdrop-blur-sm p-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-[0.15em] font-bold">Time to Next Trigger</span>
                      <span className="font-bold text-white text-sm mt-0.5 block">{formatHourLabel(nightlyTriggerHour)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      {[
                        { v: countdown.hours, l: 'HRS' },
                        { v: countdown.minutes, l: 'MIN' },
                        { v: countdown.seconds, l: 'SEC' },
                      ].map((seg, i) => (
                        <React.Fragment key={seg.l}>
                          {i > 0 && <span className="text-amber-300/60 font-black text-lg pb-3">:</span>}
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-black text-amber-300 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-white/10 shadow-inner min-w-[2.4rem] text-center tabular-nums">
                              {String(seg.v).padStart(2, '0')}
                            </span>
                            <span className="text-[8px] text-slate-500 font-bold tracking-wider mt-1">{seg.l}</span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="relative space-y-2.5 text-xs leading-relaxed">
                    <div className="flex items-center gap-2 text-slate-200">
                      <span className="text-amber-300">🕒</span>
                      <span><strong className="text-white font-semibold">Schedule:</strong> Every day at <span className="text-amber-300 font-bold">{formatHourLabel(nightlyTriggerHour)}</span></span>
                    </div>
                    <p className="text-[11px] text-slate-400/90 leading-relaxed">
                      Google Apps Script automatically evaluates the <span className="text-indigo-300 font-semibold">Working Calendar</span> &amp; <span className="text-indigo-300 font-semibold">Unique Templates</span> and inserts the new day's tasks directly into Supabase &amp; Sheets without needing any browser open.
                    </p>
                  </div>

                  {nightlyTriggerStatus && (
                    <div className="relative p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{nightlyTriggerStatus}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="relative pt-1 flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSetupNightlyTrigger(selectedTimingHour)}
                      disabled={isSettingUpNightlyTrigger}
                      className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 ring-1 ring-white/10"
                    >
                      <Zap className={`h-3.5 w-3.5 ${isSettingUpNightlyTrigger ? 'animate-spin' : ''}`} />
                      <span>{isSettingUpNightlyTrigger ? 'Configuring Cloud...' : '🌙 Refresh Cloud Trigger'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRunNightlyCloudTest}
                      disabled={isRunningNightlyTest}
                      className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white/5 hover:bg-white/15 text-white text-xs font-semibold rounded-xl border border-white/15 backdrop-blur-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Play className={`h-3.5 w-3.5 fill-current ${isRunningNightlyTest ? 'animate-spin' : ''}`} />
                      <span>{isRunningNightlyTest ? 'Testing...' : 'Test Cloud Run'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Automated Schedule Card */}
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Background Automation</h3>
                    <p className="text-[11px] text-slate-500">Auto-generation preferences</p>
                  </div>
                </div>

                {/* Toggle 1: Auto run on login */}
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-slate-700 block">Auto-Check on Admin Login</span>
                    <span className="text-slate-400 text-[11px] leading-tight block">
                      Silently triggers pending daily tasks whenever an Admin logs into the dashboard.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAutoLogin(!autoTriggerOnLogin)}
                    className={`w-11 h-6 shrink-0 rounded-full transition-colors relative ${
                      autoTriggerOnLogin ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform absolute top-1 ${
                        autoTriggerOnLogin ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Select: Background polling interval */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Active Session Trigger Check
                  </label>
                  <select
                    value={autoScheduleInterval}
                    onChange={(e) => handleChangeInterval(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="15">Every 15 Minutes</option>
                    <option value="30">Every 30 Minutes</option>
                    <option value="60">Every 1 Hour (Recommended)</option>
                    <option value="120">Every 2 Hours</option>
                    <option value="0">Disabled (Manual Only)</option>
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Automatically runs in the background while dashboard remains open.
                  </p>
                </div>
              </div>

              {/* Quick Summary Card */}
              <div className="rounded-3xl p-6 shadow-xl border border-slate-700/80 space-y-4 text-white" style={{ backgroundColor: '#0f172a' }}>
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                  <span className="font-extrabold tracking-wide">Trigger Engine Rules</span>
                </div>
                <div className="space-y-3 text-xs text-slate-200">
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm leading-none">✓</span>
                    <span className="text-slate-200 leading-relaxed"><strong className="text-white font-semibold">Daily:</strong> Evaluates once per working day.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm leading-none">✓</span>
                    <span className="text-slate-200 leading-relaxed"><strong className="text-white font-semibold">Weekly:</strong> Triggers 7 days after last date.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm leading-none">✓</span>
                    <span className="text-slate-200 leading-relaxed"><strong className="text-white font-semibold">Monthly:</strong> Triggers on the corresponding day next month.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-emerald-400 font-bold text-sm leading-none">✓</span>
                    <span className="text-slate-200 leading-relaxed"><strong className="text-white font-semibold">Duplicate Safe:</strong> Automatically updates <code className="text-sky-300 bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">Last Date</code> in <code className="text-sky-300 bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">Unique</code> table to prevent re-inserts.</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BOTTOM SECTION: RECURRING CHECKLIST TEMPLATES INSPECTOR                    */}
        {/* ========================================================================= */}
        {currentTab === 'recurring-templates' && (
          <div id="recurring-templates" className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-4 sm:p-5 md:p-6 shadow-sm space-y-4 scroll-mt-6">
            {/* Tier 1: Header (Title & Subtitle on Left, Action Buttons on Right) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs shrink-0">
                  <ListChecks className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
                      Recurring Checklist Templates Inspector
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[11px]">
                      {templates.length} Templates
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inspect all recurring task definitions from 'Unique' table and their current generation status
                  </p>
                </div>
              </div>

              {/* Action Buttons: Sync Dates & Refresh Data */}
              <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={handleSyncAllLastDates}
                  disabled={isSyncingDates || loading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                  title="Sync Last Date of all templates that already exist in Checklist for selected date"
                >
                  <Zap className={`h-3.5 w-3.5 ${isSyncingDates ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
                  <span>{isSyncingDates ? 'Syncing...' : '⚡ Sync Dates'}</span>
                </button>

                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                  title="Refresh Templates live from Supabase"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-indigo-600'}`} />
                  <span>Refresh Data</span>
                </button>
              </div>
            </div>

            {/* Tier 2: Dedicated Filter & Search Bar */}
            <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-12 gap-2.5 items-center">
                {/* Search: spans 4 cols on large screens */}
                <div className="relative sm:col-span-2 md:col-span-3 xl:col-span-4">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search template / assignee / ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium shadow-2xs"
                  />
                </div>

                {/* Task ID Sort Order: spans 2 cols */}
                <div className="xl:col-span-2">
                  <select
                    value={taskIdSortOrder}
                    onChange={(e) => setTaskIdSortOrder(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none cursor-pointer shadow-2xs"
                    title="Sort by Task ID"
                  >
                    <option value="ASC">🔢 ID: 1 → 999 (Asc)</option>
                    <option value="DESC">🔢 ID: 999 → 1 (Desc)</option>
                  </select>
                </div>

                {/* Assignee Filter: spans 2 cols */}
                <div className="xl:col-span-2">
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer truncate shadow-2xs"
                    title="Filter by Assignee / Person Name"
                  >
                    <option value="ALL">👤 All Assignees ({uniqueAssignees.length})</option>
                    {uniqueAssignees.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Frequency Filter: spans 2 cols */}
                <div className="xl:col-span-2">
                  <select
                    value={freqFilter}
                    onChange={(e) => setFreqFilter(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">All Frequencies</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="FORTNIGHTLY">Fortnightly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="HALF-YEARLY">Half-Yearly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                {/* Status Filter: spans 2 cols */}
                <div className="xl:col-span-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="DUE">⚡ Due Today</option>
                    <option value="UP_TO_DATE">✅ Up to Date</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Top Horizontal Scrollbar */}
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="overflow-x-auto overflow-y-hidden border border-indigo-200/70 rounded-xl bg-slate-50/80 p-0.5 shadow-inner"
              style={{ height: '14px' }}
              title="Scroll horizontally across table columns"
            >
              <div style={{ width: `${Math.max(tableScrollWidth, 1000)}px`, height: '1px' }} />
            </div>

            {/* Table */}
            <div 
              ref={tableScrollRef}
              onScroll={handleTableScroll}
              className="overflow-x-auto rounded-2xl border border-slate-200"
            >
              <table className="w-full text-left text-xs text-slate-600 min-w-[950px]">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 select-none">
                  <tr>
                    <th 
                      className="py-2.5 px-3 w-16 cursor-pointer hover:bg-indigo-50/70 transition-colors select-none group"
                      onClick={() => setTaskIdSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                      title="Click to toggle Task ID sort order (Ascending / Descending)"
                    >
                      <div className="flex items-center gap-1 text-indigo-700 font-extrabold whitespace-nowrap">
                        <span>ID</span>
                        {taskIdSortOrder === 'ASC' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-600 group-hover:scale-110 transition-transform" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-600 group-hover:scale-110 transition-transform" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-2.5 w-24 whitespace-nowrap">Department</th>
                    <th className="py-2.5 px-2.5 w-24 whitespace-nowrap">Assignee</th>
                    <th className="py-2.5 px-2.5">Task Description</th>
                    <th className="py-2.5 px-2 w-20 text-center whitespace-nowrap">Frequency</th>
                    <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">Last Generated</th>
                    <th className="py-2.5 px-2 w-28 text-center whitespace-nowrap" title="Status for Selected Date">Status</th>
                    <th className="py-2.5 px-3 w-28 text-center whitespace-nowrap" title="Actions (Run Trigger / Delete Template)">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTemplates.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400 italic">
                        No matching recurring templates found
                      </td>
                    </tr>
                  ) : (
                    filteredTemplates.map((t) => {
                      const target = selectedDate ? new Date(selectedDate) : todayObj;
                      const dueInfo = isTemplateDue(t, target);
                      const freq = (t.Frequency || t.Freq || 'daily').toUpperCase();

                      return (
                        <tr key={t['Task ID']} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">#{t['Task ID']}</td>
                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px] inline-block max-w-[110px] truncate">
                              {t.Department || 'General'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 font-semibold text-slate-800 whitespace-nowrap">{t.Name || '-'}</td>
                          <td className="py-2.5 px-2.5 max-w-[200px] xl:max-w-[280px] truncate text-slate-700" title={t['Task Description'] || t['Tast Descriptions']}>
                            {t['Task Description'] || t['Tast Descriptions'] || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              freq === 'DAILY' ? 'bg-blue-100 text-blue-700' :
                              freq === 'WEEKLY' ? 'bg-purple-100 text-purple-700' :
                              freq === 'MONTHLY' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {freq}
                            </span>
                          </td>
                          {/* Editable Last Generated Date Button */}
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setEditingTemplateForDate(t)}
                              className="group/editdate inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-all text-left shadow-2xs cursor-pointer active:scale-95"
                              title="Click to open interactive calendar & set date"
                            >
                              <Calendar className="h-3.5 w-3.5 text-indigo-500 group-hover/editdate:scale-110 transition-transform" />
                              <span className={t['Last Date'] ? "text-slate-800 font-bold text-xs font-mono" : "text-slate-400 italic font-medium text-xs"}>
                                {t['Last Date'] || 'Never'}
                              </span>
                              <Edit3 className="h-3 w-3 text-slate-400 group-hover/editdate:text-indigo-600 transition-colors opacity-40 group-hover/editdate:opacity-100" />
                            </button>
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            {dueInfo.isDue ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                <Zap className="h-3 w-3" /> Due Now
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                <CheckCircle2 className="h-3 w-3" /> Up to Date
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              {/* Instant Trigger Run Button */}
                              <button
                                onClick={() => handleExecuteTrigger(t['Task ID'])}
                                disabled={isRunningTrigger || runningRowId === t['Task ID'] || deletingTemplateId === t['Task ID']}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 shadow-xs cursor-pointer active:scale-95"
                                title="Generate a task right now for this template"
                              >
                                {runningRowId === t['Task ID'] ? (
                                 <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3 fill-current" />
                                )}
                                <span>{runningRowId === t['Task ID'] ? 'Running...' : 'Run'}</span>
                              </button>

                              {/* Delete Recurring Template Button */}
                              <button
                                onClick={() => handleDeleteTemplate(t)}
                                disabled={deletingTemplateId === t['Task ID'] || isRunningTrigger}
                                className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-all disabled:opacity-50 cursor-pointer active:scale-95 border border-rose-200/60"
                                title={`Delete Template #${t['Task ID']} permanently`}
                              >
                                {deletingTemplateId === t['Task ID'] ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Interactive Custom Date Picker Modal */}
        <TemplateDatePickerModal
          key={editingTemplateForDate ? (editingTemplateForDate['Task ID'] ?? editingTemplateForDate.id ?? 'active') : 'none'}
          template={editingTemplateForDate}
          isOpen={Boolean(editingTemplateForDate)}
          onClose={() => setEditingTemplateForDate(null)}
          onSave={handleUpdateLastGeneratedDate}
          isSaving={Boolean(updatingDateId)}
        />

      </div>
    </AdminLayout>
  );
}
