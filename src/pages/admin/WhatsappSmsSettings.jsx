"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, AlertCircle, RefreshCw, Key, Shield, 
  Smartphone, Database, Sliders, ExternalLink, Copy, Check, Eye, EyeOff, 
  Trash2, Download, Search, Filter, Sparkles, Clock, User, Phone, CheckCircle, 
  AlertTriangle, FileText, Settings, ArrowRight, X, Play, Zap, Radio
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { 
  getWhatsappConfig, 
  saveWhatsappConfig, 
  sendWhatsappSMS,
  sendMaytapiSMS,
  sendAisensySMS,
  sendDelegationTaskSMS,
  sendDelegationDoneSMS,
  getWhatsappLogs, 
  clearWhatsappLogs, 
  generateDelegationMessage,
  generateDelegationDoneMessage,
  formatPhoneNumber,
  DEFAULT_TEMPLATE,
  DEFAULT_TASK_DONE_TEMPLATE
} from '../../utils/whatsappService';

const SQL_SETUP_SCRIPT = `-- ==============================================================================
-- SUPABASE SQL SETUP FOR WHATSAPP SMS & LOGS (Maytapi & AiSensy Support)
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Create whatsapp_logs table to store full message delivery logs
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    task_id TEXT,
    recipient_name TEXT,
    recipient_phone TEXT,
    allocated_by TEXT,
    message TEXT,
    status TEXT DEFAULT 'Sent',
    response JSONB,
    error TEXT
);

-- Enable RLS and add public access policies
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for public on whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "Allow all operations for public on whatsapp_logs" ON public.whatsapp_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. Create whatsapp_settings table to store Maytapi & AiSensy credentials centrally
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    product_id TEXT,
    phone_id TEXT,
    token TEXT,
    api_url TEXT DEFAULT 'https://api.maytapi.com/api',
    enabled BOOLEAN DEFAULT true,
    template TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add public access policies
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for public on whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Allow all operations for public on whatsapp_settings" ON public.whatsapp_settings FOR ALL USING (true) WITH CHECK (true);

-- Grant table privileges
GRANT ALL ON TABLE public.whatsapp_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_settings TO anon, authenticated, service_role;
`;

export default function WhatsappSmsSettings() {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'logs'
  const [templateTab, setTemplateTab] = useState('assigned'); // 'assigned' | 'done'
  const [testType, setTestType] = useState('assigned'); // 'assigned' | 'done'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // WhatsApp Configuration State (Supports Maytapi & AiSensy)
  const [config, setConfig] = useState({
    provider: 'maytapi', // 'maytapi' | 'aisensy'
    // Maytapi
    productId: '',
    phoneId: '',
    token: '',
    apiUrl: 'https://api.maytapi.com/api',
    // AiSensy
    aisensyApiKey: '',
    aisensyCampaignName: '',
    aisensyDoneCampaignName: '',
    aisensyApiUrl: 'https://backend.aisensy.com/campaign/t1/api/v2',
    // Global
    enabled: true,
    template: '',
    templateTaskDone: '',
  });

  const [showToken, setShowToken] = useState(false);
  const [showAisensyKey, setShowAisensyKey] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Test SMS State
  const [testNumber, setTestNumber] = useState('');
  const [testRecipientName, setTestRecipientName] = useState('Rajesh Kumar');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // WhatsApp Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('ALL'); // 'ALL' | 'Sent' | 'Failed'
  const [selectedLogForModal, setSelectedLogForModal] = useState(null);

  // Load initial config and logs
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const currentConfig = await getWhatsappConfig();
        setConfig({
          ...currentConfig,
          template: (!currentConfig.template || currentConfig.template === 'test' || currentConfig.template === 'Default Template') 
            ? DEFAULT_TEMPLATE 
            : currentConfig.template,
          templateTaskDone: (!currentConfig.templateTaskDone || currentConfig.templateTaskDone === 'test')
            ? DEFAULT_TASK_DONE_TEMPLATE
            : currentConfig.templateTaskDone,
        });
        const logData = await getWhatsappLogs();
        setLogs(logData);
      } catch (err) {
        console.error('Error initializing WhatsApp settings:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      if (config.enabled) {
        if (config.provider === 'aisensy') {
          if (!config.aisensyApiKey || !config.aisensyCampaignName) {
            throw new Error('Please fill in both AiSensy API Key and Campaign Name before enabling.');
          }
        } else {
          if (!config.productId || !config.phoneId || !config.token) {
            throw new Error('Please fill in Maytapi Product ID, Phone ID, and Secret Token before enabling.');
          }
        }
      }

      await saveWhatsappConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Save configuration error:', err);
      setSaveError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestSMS = async () => {
    const cleanNumber = (testNumber || '').trim();
    if (!cleanNumber) {
      alert('Please enter a valid phone number for testing!');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    const cleanConfig = {
      ...config,
      productId: (config.productId || '').trim(),
      phoneId: (config.phoneId || '').trim(),
      token: (config.token || '').trim(),
      apiUrl: (config.apiUrl || 'https://api.maytapi.com/api').trim(),
      aisensyApiKey: (config.aisensyApiKey || '').trim(),
      aisensyCampaignName: (config.aisensyCampaignName || '').trim(),
      aisensyDoneCampaignName: (config.aisensyDoneCampaignName || '').trim(),
      aisensyApiUrl: (config.aisensyApiUrl || 'https://backend.aisensy.com/campaign/t1/api/v2').trim(),
    };

    const dummyTask = {
      'Task ID': 'TEST-999',
      'Given By': testType === 'done' ? (testRecipientName || 'Director') : 'Piramal Director',
      Name: testType === 'done' ? 'Rajesh Kumar' : (testRecipientName || 'Rajesh Kumar'),
      'Task Description': 'Complete GST Reconciliation and upload invoice verification sheet',
      'Task Start Date': new Date().toLocaleDateString('en-GB'),
      'Completion Date': new Date().toLocaleDateString('en-GB'),
      Remarks: 'Invoice verification verified successfully',
      Attachment: 'https://res.cloudinary.com/sample/image/upload/v1/invoice_proof.jpg',
    };

    try {
      let res;
      if (testType === 'done') {
        // Send Task Completed notification to Given By
        const previewMsg = generateDelegationDoneMessage(dummyTask, cleanConfig.templateTaskDone);
        res = await sendDelegationDoneSMS({
          ...dummyTask,
          'Given By Phone': cleanNumber,
          configOverride: cleanConfig,
        });
      } else {
        // Send Task Assigned notification to Doer
        const previewMsg = generateDelegationMessage(dummyTask, cleanConfig.template);
        res = await sendDelegationTaskSMS({
          ...dummyTask,
          Number: cleanNumber,
          configOverride: cleanConfig,
        });
      }

      setTestResult(res);

      // Refresh logs
      const updatedLogs = await getWhatsappLogs();
      setLogs(updatedLogs);
    } catch (err) {
      setTestResult({ success: false, error: err.message || String(err) });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRefreshLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await getWhatsappLogs();
      setLogs(data);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all WhatsApp SMS logs?')) return;
    await clearWhatsappLogs();
    setLogs([]);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadCsv = () => {
    if (logs.length === 0) {
      alert('No logs available to export');
      return;
    }

    const headers = ['Time (UTC/IST)', 'Provider', 'Task ID', 'Recipient', 'Phone Number', 'Allocated By', 'Status', 'Message', 'Error Details'];
    const rows = logs.map(l => [
      `"${l.created_at || ''}"`,
      `"${l.provider || 'Maytapi'}"`,
      `"${l.task_id || ''}"`,
      `"${(l.recipient_name || '').replace(/"/g, '""')}"`,
      `"${l.recipient_phone || ''}"`,
      `"${(l.allocated_by || '').replace(/"/g, '""')}"`,
      `"${l.status || ''}"`,
      `"${(l.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(l.error || (l.response ? JSON.stringify(l.response) : '')).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WhatsApp_SMS_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const q = logSearchQuery.toLowerCase();
      const matchSearch = !q || 
        (l.task_id && String(l.task_id).toLowerCase().includes(q)) ||
        (l.recipient_name && l.recipient_name.toLowerCase().includes(q)) ||
        (l.recipient_phone && l.recipient_phone.includes(q)) ||
        (l.allocated_by && l.allocated_by.toLowerCase().includes(q)) ||
        (l.message && l.message.toLowerCase().includes(q)) ||
        (l.provider && l.provider.toLowerCase().includes(q));

      const matchStatus = logStatusFilter === 'ALL' || (l.status || '').toLowerCase() === logStatusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [logs, logSearchQuery, logStatusFilter]);

  // Sample live template preview
  const sampleTask = {
    'Task ID': '1042',
    'Given By': 'Piramal Director',
    Name: 'Rajesh Kumar',
    'Task Description': 'Complete GST Reconciliation and upload invoice verification sheet',
    'Task Start Date': '15/10/2026',
    'Completion Date': new Date().toLocaleDateString('en-GB'),
    Remarks: 'Reconciliation uploaded to portal',
    Attachment: 'https://res.cloudinary.com/sample/image/upload/v1/invoice_proof.jpg',
  };

  const livePreviewText = templateTab === 'done'
    ? generateDelegationDoneMessage(sampleTask, config.templateTaskDone || DEFAULT_TASK_DONE_TEMPLATE)
    : generateDelegationMessage(sampleTask, config.template || DEFAULT_TEMPLATE);

  const isMaytapiConfigured = Boolean(config.productId && config.phoneId && config.token);
  const isAisensyConfigured = Boolean(config.aisensyApiKey && config.aisensyCampaignName);
  const isConfigured = config.provider === 'aisensy' ? isAisensyConfigured : isMaytapiConfigured;

  return (
    <AdminLayout>
      <div className="min-h-screen p-4 md:p-8 space-y-8 bg-slate-50/50">
        
        {/* Top Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-6 md:p-8 text-white shadow-2xl border border-emerald-900/30">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp SMS Automation (Maytapi & AiSensy)
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                <span>WhatsApp SMS & Logs</span>
                {isConfigured && config.enabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active ({config.provider === 'aisensy' ? 'AiSensy' : 'Maytapi'})
                  </span>
                ) : !isConfigured ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <AlertTriangle className="h-3.5 w-3.5" /> {config.provider === 'aisensy' ? 'AiSensy' : 'Maytapi'} Unconfigured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    ⛔ Disabled
                  </span>
                )}
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl">
                Automatically send instant WhatsApp notifications to assignees upon task assignment, and notify <strong>Given By / Allocator</strong> when a Delegation Task is completed.
              </p>
            </div>

            {/* Quick Links & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/dashboard/settings#user-management"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <User className="h-3.5 w-3.5 text-emerald-300" />
                <span>User Directory</span>
              </Link>
              <Link
                to="/dashboard/settings#manual-data-dump"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5 text-cyan-300" />
                <span>Data Dump</span>
              </Link>
              <Link
                to="/dashboard/settings#trigger-console"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <Sliders className="h-3.5 w-3.5 text-amber-300" />
                <span>Trigger Console</span>
              </Link>
              <Link
                to="/dashboard/settings#recurring-templates"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <Settings className="h-3.5 w-3.5 text-indigo-300" />
                <span>Templates Inspector</span>
              </Link>
              <button
                onClick={() => setShowSqlModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-200 font-bold text-xs backdrop-blur-md transition-all border border-emerald-500/40 whitespace-nowrap"
              >
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span>Database SQL</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="relative z-10 flex items-center gap-2 mt-8 pt-6 border-t border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Key className="h-4 w-4" />
              <span>Provider Credentials & Templates</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>WhatsApp Delivery Logs</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'logs' ? 'bg-slate-950 text-emerald-300' : 'bg-white/20 text-white'
              }`}>
                {logs.length}
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: CREDENTIALS & TEMPLATES CONFIGURATION                              */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Credentials Form */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Form Alert */}
              {saveSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>WhatsApp SMS credentials & templates saved successfully!</span>
                </div>
              )}
              {saveError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2 shadow-sm">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Card: WhatsApp Provider & Credentials */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-6">
                
                {/* Header & Master Toggle */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                      <Key className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-800">
                        WhatsApp SMS Provider
                      </h2>
                      <p className="text-xs text-slate-400">
                        Choose active provider (Maytapi or AiSensy) and configure API credentials
                      </p>
                    </div>
                  </div>

                  {/* Master Toggle */}
                  <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-700">
                      {config.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>
                </div>

                {/* Provider Selector Tabs */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Select Active SMS Provider:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, provider: 'maytapi' }))}
                      className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        config.provider === 'maytapi'
                          ? 'bg-white text-emerald-700 shadow-md border border-emerald-200/60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${config.provider === 'maytapi' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                      <span>Maytapi API</span>
                      {isMaytapiConfigured && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 ml-auto" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, provider: 'aisensy' }))}
                      className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        config.provider === 'aisensy'
                          ? 'bg-white text-indigo-700 shadow-md border border-indigo-200/60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${config.provider === 'aisensy' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></span>
                      <span>AiSensy API</span>
                      {isAisensyConfigured && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 ml-auto" />
                      )}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-4">
                  
                  {/* ========================================================= */}
                  {/* MAYTAPI FIELDS (shown when provider === 'maytapi')         */}
                  {/* ========================================================= */}
                  {config.provider === 'maytapi' && (
                    <div className="space-y-4 p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-100/60">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          <span className="text-xs font-extrabold text-emerald-900">Maytapi Credentials</span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-medium">Standard WhatsApp Instance</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product ID */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Product ID <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 5xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            value={config.productId}
                            onChange={(e) => setConfig(prev => ({ ...prev, productId: e.target.value.trim() }))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            required={config.enabled && config.provider === 'maytapi'}
                          />
                        </div>

                        {/* Phone ID */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Phone ID <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 109164"
                            value={config.phoneId}
                            onChange={(e) => setConfig(prev => ({ ...prev, phoneId: e.target.value.trim() }))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            required={config.enabled && config.provider === 'maytapi'}
                          />
                        </div>
                      </div>

                      {/* Secret Token */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          Secret Token (x-maytapi-key) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showToken ? "text" : "password"}
                            placeholder="Enter Maytapi Secret Token..."
                            value={config.token}
                            onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value.trim() }))}
                            className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            required={config.enabled && config.provider === 'maytapi'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          >
                            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* API Base URL */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          Maytapi API Base URL
                        </label>
                        <input
                          type="text"
                          value={config.apiUrl || 'https://api.maytapi.com/api'}
                          onChange={(e) => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* AISENSY FIELDS (shown when provider === 'aisensy')         */}
                  {/* ========================================================= */}
                  {config.provider === 'aisensy' && (
                    <div className="space-y-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-100/60">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                          <span className="text-xs font-extrabold text-indigo-900">AiSensy Official WhatsApp Business API</span>
                        </div>
                        <span className="text-[11px] text-indigo-700 font-medium">Campaign API v2</span>
                      </div>

                      {/* API Key */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          AiSensy API Key (API Campaign Key) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showAisensyKey ? "text" : "password"}
                            placeholder="Enter AiSensy API Campaign Key (from Manage > API Key)..."
                            value={config.aisensyApiKey}
                            onChange={(e) => setConfig(prev => ({ ...prev, aisensyApiKey: e.target.value.trim() }))}
                            className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            required={config.enabled && config.provider === 'aisensy'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAisensyKey(!showAisensyKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          >
                            {showAisensyKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          AiSensy Dashboard me <strong>API Campaign Key</strong> tab se copy karein
                        </p>
                      </div>

                      {/* Campaign Name 1: Task Assignment */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Task Assigned Campaign Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. task_delegation_reminder"
                            value={config.aisensyCampaignName}
                            onChange={(e) => setConfig(prev => ({ ...prev, aisensyCampaignName: e.target.value.trim() }))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            required={config.enabled && config.provider === 'aisensy'}
                          />
                          <p className="text-[10px] text-slate-400">
                            Task allocate hone par Doer ko SMS bhejne wali campaign
                          </p>
                        </div>

                        {/* Campaign Name 2: Task Completion */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Task Completed Campaign Name <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. task_completed_notification (optional)"
                            value={config.aisensyDoneCampaignName}
                            onChange={(e) => setConfig(prev => ({ ...prev, aisensyDoneCampaignName: e.target.value.trim() }))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          />
                          <p className="text-[10px] text-slate-400">
                            Khali chhodne par upar wali main campaign use hogi
                          </p>
                        </div>
                      </div>

                      {/* API Base URL */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          AiSensy API Endpoint
                        </label>
                        <input
                          type="text"
                          value={config.aisensyApiUrl || 'https://backend.aisensy.com/campaign/t1/api/v2'}
                          onChange={(e) => setConfig(prev => ({ ...prev, aisensyApiUrl: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                      </div>

                      {/* Template Variable Mapping Info */}
                      <div className="p-3 bg-white rounded-xl border border-indigo-100 text-slate-700 space-y-2 text-xs">
                        <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-indigo-600" />
                          <span>AiSensy Meta Template Parameters Mapping:</span>
                        </p>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-800 tracking-wider block">1. Task Assignment Template (To Doer):</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-mono text-slate-600">
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{1}}`}</code> &rarr; Recipient Name</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{2}}`}</code> &rarr; Task ID</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{3}}`}</code> &rarr; Allocated By</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{4}}`}</code> &rarr; Task Description</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100 col-span-full"><code>{`{{5}}`}</code> &rarr; Deadline (Start Date)</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider block">2. Task Completed Template (To Given By / Creator):</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-mono text-slate-600">
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{1}}`}</code> &rarr; Given By (Creator Name)</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{2}}`}</code> &rarr; Task ID</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{3}}`}</code> &rarr; Completed By (Doer Name)</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{4}}`}</code> &rarr; Task Description</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100"><code>{`{{5}}`}</code> &rarr; Completion Date</span>
                            <span className="p-1 rounded bg-slate-50 border border-slate-100 col-span-full"><code>{`{{6}}`}</code> &rarr; Attachment Link ($(Attachment))</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* MESSAGE TEMPLATES SECTION (Dual Tab: Assign vs Completed) */}
                  {/* ========================================================= */}
                  <div className="space-y-2 pt-2">
                    
                    {/* Template Switcher Tabs */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTemplateTab('assigned')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                            templateTab === 'assigned'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          1. Task Assigned (To Doer)
                        </button>

                        <button
                          type="button"
                          onClick={() => setTemplateTab('done')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                            templateTab === 'done'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          2. Task Completed (To Given By)
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (templateTab === 'done') {
                            setConfig(prev => ({ ...prev, templateTaskDone: DEFAULT_TASK_DONE_TEMPLATE }));
                          } else {
                            setConfig(prev => ({ ...prev, template: DEFAULT_TEMPLATE }));
                          }
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                      >
                        Reset to Skyler World Template
                      </button>
                    </div>

                    {/* Textarea for Selected Template */}
                    {templateTab === 'assigned' ? (
                      <div className="space-y-1.5">
                        <textarea
                          rows={8}
                          value={config.template}
                          onChange={(e) => setConfig(prev => ({ ...prev, template: e.target.value }))}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all leading-relaxed"
                          placeholder="Enter Task Assignment WhatsApp template..."
                        />
                        {/* Placeholder badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 mr-1">Available Tags:</span>
                          {['$(Name)', '$(Task ID)', '$(Given By)', '$(Task Description)', '$(Task Start Date)'].map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setConfig(prev => ({ ...prev, template: `${prev.template} ${tag}` }))}
                              className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 font-mono text-[10px] font-bold transition-all cursor-pointer"
                            >
                              + {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <textarea
                          rows={8}
                          value={config.templateTaskDone}
                          onChange={(e) => setConfig(prev => ({ ...prev, templateTaskDone: e.target.value }))}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all leading-relaxed"
                          placeholder="Enter Task Completed WhatsApp template..."
                        />
                        {/* Placeholder badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 mr-1">Available Tags:</span>
                          {['$(Given By)', '$(Name)', '$(Task ID)', '$(Task Description)', '$(Completion Date)', '$(Remarks)', '$(Attachment)'].map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setConfig(prev => ({ ...prev, templateTaskDone: `${prev.templateTaskDone} ${tag}` }))}
                              className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 font-mono text-[10px] font-bold transition-all cursor-pointer"
                            >
                              + {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Saving Credentials & Templates...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Save {config.provider === 'aisensy' ? 'AiSensy' : 'Maytapi'} Credentials & Templates</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Card: Test SMS Sender */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600">
                      <Send className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">
                        Send Test WhatsApp Message
                      </h3>
                      <p className="text-xs text-slate-400">
                        Verify your connection by sending a live test notification
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    config.provider === 'aisensy'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    via {config.provider === 'aisensy' ? 'AiSensy' : 'Maytapi'}
                  </span>
                </div>

                {/* Test Notification Type Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Choose Notification to Test:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setTestType('assigned'); setTemplateTab('assigned'); }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        testType === 'assigned'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Task Assigned (To Doer)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTestType('done'); setTemplateTab('done'); }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        testType === 'done'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Task Completed (To Given By)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Recipient Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210 (10 digits)"
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">
                      {testType === 'done' ? 'Given By Name (Receiver)' : 'Doer Name (Receiver)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={testRecipientName}
                      onChange={(e) => setTestRecipientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendTestSMS}
                  disabled={isSendingTest || !isConfigured}
                  className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Sending Test WhatsApp Message...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send Live Test WhatsApp ({testType === 'done' ? 'Task Completed' : 'Task Assigned'})</span>
                    </>
                  )}
                </button>

                {/* Test Feedback */}
                {testResult && (
                  <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 border ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 overflow-hidden">
                      <p className="font-extrabold">
                        {testResult.success ? '🎉 Test Message Sent Successfully!' : '❌ Failed to Send Test Message'}
                      </p>
                      {testResult.error && (
                        <p className="font-mono text-[11px] text-rose-700 font-normal break-all">
                          {testResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Phone Mockup & Template Preview */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* WhatsApp Message Preview Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                    <span>Live WhatsApp Notification Preview</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                    {templateTab === 'done' ? 'Task Completed' : 'Task Assigned'}
                  </span>
                </div>

                {/* WhatsApp Chat Bubble Mockup */}
                <div className="p-4 rounded-3xl bg-[#e5ddd5] border border-slate-300/60 shadow-inner relative overflow-hidden">
                  <div className="max-w-[92%] bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-slate-800 space-y-1 border border-black/5">
                    <p className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap font-sans text-slate-900">
                      {livePreviewText}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-medium pt-1">
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <Check className="h-3 w-3 text-sky-500 stroke-[2.5]" />
                    </div>
                  </div>
                </div>

                {/* Instruction Notes */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs space-y-2 leading-relaxed">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>How Automated WhatsApp Notifications Work:</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-1.5 text-[11px]">
                    <li><strong>Task Assigned:</strong> Jab Admin naya Delegation Task assign karta hai, assigned Doer ko instant WhatsApp reminder chala jata hai.</li>
                    <li><strong>Task Completed:</strong> Jab task <strong>Done / Admin Done</strong> ho jata hai, task dene wale (<strong>Given By / Allocator</strong>) ko task complete hone ka automated WhatsApp notification chala jata hai.</li>
                    <li>Both notifications active provider (<strong>{config.provider === 'aisensy' ? 'AiSensy' : 'Maytapi'}</strong>) ke through dispatch hote hain aur delivery logs me record hote hain.</li>
                  </ul>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WHATSAPP DELIVERY LOGS                                             */}
        {/* ========================================================================= */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            
            {/* Logs Toolbar */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Task ID, Recipient Name, Phone Number, Provider, or Message..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setLogStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logStatusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All ({logs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogStatusFilter('Sent')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logStatusFilter === 'Sent' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Sent ({logs.filter(l => (l.status || '').toLowerCase() === 'sent').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogStatusFilter('Failed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logStatusFilter === 'Failed' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Failed ({logs.filter(l => (l.status || '').toLowerCase() === 'failed').length})
                  </button>
                </div>

                {/* Actions */}
                <button
                  type="button"
                  onClick={handleRefreshLogs}
                  disabled={loadingLogs}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
                
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200/60 transition-all cursor-pointer"
                  title="Export Logs to CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer border border-rose-200/60"
                  title="Clear All Logs"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Provider</th>
                      <th className="py-3.5 px-4">Date & Time</th>
                      <th className="py-3.5 px-4">Task ID</th>
                      <th className="py-3.5 px-4">Recipient</th>
                      <th className="py-3.5 px-4">Phone Number</th>
                      <th className="py-3.5 px-4">Allocated By</th>
                      <th className="py-3.5 px-4">Message Content</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 space-y-2">
                          <MessageSquare className="h-8 w-8 mx-auto text-slate-300" />
                          <p className="font-bold text-slate-500">No WhatsApp SMS logs found</p>
                          <p className="text-xs text-slate-400">
                            {logSearchQuery ? 'Try adjusting your search criteria.' : 'Logs will appear here automatically when delegation tasks are assigned or completed.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log, idx) => {
                        const isSuccess = (log.status || '').toLowerCase() === 'sent';
                        const createdDate = log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-';
                        const isAiSensy = (log.provider || '').toLowerCase() === 'aisensy';

                        return (
                          <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            
                            {/* Status */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isSuccess
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                {isSuccess ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-rose-600" />
                                )}
                                <span>{log.status || (isSuccess ? 'Sent' : 'Failed')}</span>
                              </span>
                            </td>

                            {/* Provider */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isAiSensy
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {isAiSensy ? 'AiSensy' : 'Maytapi'}
                              </span>
                            </td>

                            {/* Timestamp */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {createdDate}
                            </td>

                            {/* Task ID */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-[11px] border border-indigo-200/50">
                                #{log.task_id || '-'}
                              </span>
                            </td>

                            {/* Recipient */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-800">
                              {log.recipient_name || '-'}
                            </td>

                            {/* Phone */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                              {log.recipient_phone ? (
                                <span className="text-slate-600">{log.recipient_phone}</span>
                              ) : (
                                <span className="text-slate-300 italic">None</span>
                              )}
                            </td>

                            {/* Allocated By */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                              {log.allocated_by || '-'}
                            </td>

                            {/* Message Preview */}
                            <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 font-sans" title={log.message}>
                              {log.message ? log.message.slice(0, 70) + (log.message.length > 70 ? '...' : '') : '-'}
                            </td>

                            {/* Action: View Modal */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedLogForModal(log)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                View Details
                              </button>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: LOG DETAILS VIEWER                                                 */}
        {/* ========================================================================= */}
        {selectedLogForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-4 p-6 md:p-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    (selectedLogForModal.status || '').toLowerCase() === 'sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      WhatsApp Delivery Details
                    </h3>
                    <p className="text-xs text-slate-400">
                      Task ID: #{selectedLogForModal.task_id || 'N/A'} &bull; Provider: {selectedLogForModal.provider || 'Maytapi'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLogForModal(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px]">Recipient:</span>
                  <span className="font-bold text-slate-800">{selectedLogForModal.recipient_name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px]">Phone Number:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedLogForModal.recipient_phone || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px]">Allocated By:</span>
                  <span className="font-bold text-slate-800">{selectedLogForModal.allocated_by || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px]">Status:</span>
                  <span className={`font-bold ${
                    (selectedLogForModal.status || '').toLowerCase() === 'sent' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {selectedLogForModal.status || 'Sent'}
                  </span>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Message Dispatched:</span>
                <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedLogForModal.message || 'No message recorded'}
                </div>
              </div>

              {/* API Response / Error Details */}
              {(selectedLogForModal.error || selectedLogForModal.response) && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">API Response / Debug Trace:</span>
                  <pre className="p-3 rounded-2xl bg-slate-100 text-slate-700 font-mono text-[10px] overflow-x-auto max-h-36">
                    {selectedLogForModal.error 
                      ? selectedLogForModal.error 
                      : JSON.stringify(selectedLogForModal.response, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLogForModal(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: SUPABASE SQL SCHEMA SETUP                                          */}
        {/* ========================================================================= */}
        {showSqlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-4 p-6 md:p-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      Supabase SQL Setup for WhatsApp Logs & Settings
                    </h3>
                    <p className="text-xs text-slate-400">
                      Create `whatsapp_logs` & `whatsapp_settings` tables in your Supabase project
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">SQL Commands:</span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200 transition-all cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative max-h-72 overflow-y-auto rounded-2xl bg-slate-900 p-4 border border-slate-800">
                  <pre className="font-mono text-[11px] text-emerald-300 leading-relaxed whitespace-pre-wrap">
                    {SQL_SETUP_SCRIPT}
                  </pre>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-bold">Instructions:</span> Open your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5">Supabase SQL Editor <ExternalLink className="h-3 w-3" /></a>, paste the SQL above and click <strong>Run</strong>.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
