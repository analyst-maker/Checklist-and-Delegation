"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  ClipboardCheck, 
  Clock, 
  Zap,
  Activity,
  Layers,
  Database,
  Users,
  Check
} from "lucide-react";

const TypingText = ({ text }) => {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + text.charAt(index));
        setIndex((prev) => prev + 1);
      }, 85);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setDisplayed("");
        setIndex(0);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [index, text]);

  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#24150D] border border-[#7A3614]/40 shadow-sm backdrop-blur-md">
      <span className="flex h-2 w-2 relative shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>
      <span className="text-[10px] sm:text-[11px] font-black tracking-widest text-[#ECC3A3] font-mono uppercase">
        {displayed || "DEVELOPED BY DEEPAK SAHU"}
      </span>
      <span className="w-1 h-3 bg-amber-400 animate-pulse rounded-xs"></span>
    </div>
  );
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [masterData, setMasterData] = useState({
    userCredentials: {},
    userRoles: {},
    userEmails: {},
  });
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState("");

  // Check if role is inactive
  const isInactiveRole = (role) => {
    if (!role) return false;
    const normalizedRole = String(role).toLowerCase().trim();
    return (
      normalizedRole === "inactive" ||
      normalizedRole === "in active" ||
      normalizedRole === "inactiv" ||
      normalizedRole === "in activ"
    );
  };

  // Fetch master data on component mount
  useEffect(() => {
    const fetchMasterData = async () => {
      const CACHE_TTL = 60 * 60 * 1000; // 1 Hour TTL

      const cachedDataStr = localStorage.getItem("masterDataCache");
      const cachedTimeStr = localStorage.getItem("masterDataCacheTime");
      let hasCache = false;
      let isCacheValid = false;

      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          setMasterData(cachedData);
          setIsDataLoading(false);
          hasCache = true;

          const cachedTime = Number(cachedTimeStr || 0);
          if (cachedTime && Date.now() - cachedTime < CACHE_TTL) {
            isCacheValid = true;
          }
        } catch (e) {
          console.error("Failed to parse cache", e);
        }
      }

      if (isCacheValid) return;

      try {
        if (!hasCache) {
          setIsDataLoading(true);
        }

        const { data, error } = await supabase.from('Whatsapp').select('*');
        if (error) throw error;

        const userCredentials = {};
        const userRoles = {};
        const userEmails = {};

        if (data && data.length > 0) {
          data.forEach(row => {
            const username = (row['Username'] || row['User name']) ? String(row['Username'] || row['User name']).trim().toLowerCase() : "";
            const password = (row['password'] || row['Password']) ? String(row['password'] || row['Password']).trim() : "";
            const role = row['Role'] ? String(row['Role']).trim() : "user";
            const email = (row['Email'] || row['ID']) ? String(row['Email'] || row['ID']).trim() : "";

            if (username && password && password.trim() !== "") {
              if (isInactiveRole(role)) return;
              const normalizedRole = role.toLowerCase();
              userCredentials[username] = password;
              userRoles[username] = normalizedRole;
              userEmails[username] = email;
            }
          });
        }

        const newMasterData = { userCredentials, userRoles, userEmails };
        setMasterData(newMasterData);
        
        try {
          localStorage.setItem("masterDataCache", JSON.stringify(newMasterData));
          localStorage.setItem("masterDataCacheTime", Date.now().toString());
        } catch(e) {
          console.warn('Cache storage warning');
        }

      } catch (error) {
        console.error("Error Fetching Master Data:", error);
        if (!hasCache) {
          showToast(`Network error: ${error.message}. Please try again later.`, "error");
        }
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchMasterData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoginLoading(true);

    try {
      const trimmedUsername = formData.username.trim().toLowerCase();
      const trimmedPassword = formData.password.trim();

      if (trimmedUsername in masterData.userCredentials) {
        const correctPassword = masterData.userCredentials[trimmedUsername];
        const userRole = masterData.userRoles[trimmedUsername];
        const userEmail = masterData.userEmails[trimmedUsername] || "";

        if (correctPassword === trimmedPassword) {
          sessionStorage.setItem("username", trimmedUsername);
          sessionStorage.setItem("email", userEmail);
          setLoggedInUsername(trimmedUsername);

          const isAdmin = userRole === "admin";
          sessionStorage.setItem("role", isAdmin ? "admin" : "user");

          if (isAdmin) {
            sessionStorage.setItem("department", "all");
            sessionStorage.setItem("isAdmin", "true");
          } else {
            sessionStorage.setItem("department", trimmedUsername);
            sessionStorage.setItem("isAdmin", "false");
          }

          try {
            if (typeof window !== 'undefined' && typeof window.clearAllSheetCaches === 'function') {
              window.clearAllSheetCaches();
            }
            const keysToKeep = [
              'masterDataCache', 
              'masterDataCacheTime', 
              'theme', 
              'dump_target_sheet_url', 
              'dump_apps_script_url', 
              'nightly_trigger_hour', 
              'auto_trigger_on_login', 
              'auto_trigger_interval', 
              'task_trigger_history'
            ];
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && !keysToKeep.includes(key) && (key.startsWith('app_cache_') || key.includes('page_cache_') || key.startsWith('whatsapp_user_cache_'))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
          } catch(e) {
            console.error("Failed to clear cache on login", e);
          }

          setShowSuccessPopup(true);

          setTimeout(() => {
            setShowSuccessPopup(false);
            navigate("/dashboard/admin");
          }, 1800);

          showToast(`Login successful. Welcome, ${trimmedUsername}!`, "success");
          return;
        } else {
          showToast("Username or password is incorrect. Please try again.", "error");
        }
      } else {
        showToast("Username or password is incorrect. Please try again.", "error");
      }
    } catch (error) {
      console.error("Login Error:", error);
      showToast(`Login failed: ${error.message}. Please try again.`, "error");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 5000);
  };

  const togglePasswordVisibility = () => {
    setVisible(!visible);
  };

  return (
    <div className="min-h-screen w-full bg-[#F6EEE5] p-3 sm:p-6 md:p-10 flex items-center justify-center font-sans antialiased selection:bg-[#54250E] selection:text-white relative overflow-hidden">
      
      {/* Top Right Dark Mocha Organic Shape (Matching reference image) */}
      <div 
        className="absolute -top-16 -right-16 w-80 h-80 sm:w-[28rem] sm:h-[28rem] bg-[#54250E] rounded-[45%_55%_65%_35%/50%_60%_40%_50%] pointer-events-none opacity-95"
      />
      
      {/* Bottom Left Dark Mocha Organic Shape (Matching reference image) */}
      <div 
        className="absolute -bottom-20 -left-20 w-80 h-80 sm:w-[28rem] sm:h-[28rem] bg-[#54250E] rounded-[55%_45%_35%_65%/60%_50%_50%_40%] pointer-events-none opacity-95"
      />

      {/* Main Floating White Split Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[1140px] bg-white rounded-[2.25rem] sm:rounded-[2.75rem] shadow-[0_30px_90px_rgba(84,37,14,0.12)] p-4 sm:p-6 md:p-7 flex flex-col lg:flex-row gap-6 lg:gap-8 relative z-10"
      >
        
        {/* ========================================================================= */}
        {/* LEFT PANEL: Warm Mocha Liquid Wave & Team Bubbles                         */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[49%] rounded-[2rem] sm:rounded-[2.25rem] bg-gradient-to-b from-[#FFFDF9] via-[#FAF1E6] to-[#F1E0CE] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden min-h-[480px] lg:min-h-[560px]">
          
          {/* Organic Mocha Wavy Splash SVG Graphic in Top Right (Exact reference art) */}
          <div className="absolute -top-6 right-0 w-[80%] h-[45%] pointer-events-none">
            <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover">
              <defs>
                <linearGradient id="waveGradientMocha" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7A3614" />
                  <stop offset="60%" stopColor="#54250E" />
                  <stop offset="100%" stopColor="#3E1A09" />
                </linearGradient>
              </defs>
              <path 
                d="M100 0C160 60 130 140 190 170C250 200 310 130 400 190V0H100Z" 
                fill="url(#waveGradientMocha)" 
              />
              <path 
                d="M170 0C210 50 190 100 250 130C310 160 350 90 400 140V0H170Z" 
                fill="#9A4F23" 
                opacity="0.35" 
              />
            </svg>
          </div>

          {/* Top Brand Logo */}
          <div className="relative z-10 flex items-center justify-start">
            <img 
              src="/skyler-logo.png" 
              alt="Skyler" 
              className="h-8 sm:h-9 w-auto object-contain" 
            />
          </div>

          {/* Center Content: Exact Headline Typography */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.25 }}
            className="relative z-10 mt-12 sm:mt-16 lg:mt-20 mb-auto py-4 text-center max-w-sm mx-auto"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-[#1E110A] tracking-tight leading-tight">
              Welcome to Checklist &amp; Delegation
            </h2>
            <p className="text-xs sm:text-sm text-[#5C4538] font-medium mt-4 leading-relaxed">
              We are a team, together managing thousands of checklist tasks &amp; automated delegations every single day.
            </p>
          </motion.div>

          {/* Floating Circle Visual Badges with Pure White Ring Borders */}
          <div className="relative z-10 space-y-4">
            <div className="relative h-24 sm:h-28 flex items-center justify-center">
              
              {/* Left Circle: Mocha Checklist Badge */}
              <motion.div 
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.15 }}
                className="absolute left-3 sm:left-7 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-[0_12px_28px_rgba(84,37,14,0.38)] ring-4 ring-white overflow-hidden cursor-pointer group"
              >
                <div className="w-full h-full bg-gradient-to-tr from-[#3E1A09] via-[#54250E] to-[#7A3614] flex items-center justify-center relative">
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent rounded-t-full pointer-events-none" />
                  <ClipboardCheck className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] stroke-[2.2] group-hover:scale-110 transition-transform" />
                </div>
              </motion.div>

              {/* Top Middle Circle: Radiant Amber Bolt */}
              <motion.div 
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                whileHover={{ scale: 1.15 }}
                className="absolute top-0 w-12 h-12 sm:w-13 sm:h-13 rounded-full shadow-[0_10px_22px_rgba(245,158,11,0.38)] ring-4 ring-white overflow-hidden cursor-pointer group"
              >
                <div className="w-full h-full bg-gradient-to-tr from-[#d97706] via-[#f59e0b] to-[#fbbf24] flex items-center justify-center relative">
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent rounded-t-full pointer-events-none" />
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] group-hover:scale-110 transition-transform" />
                </div>
              </motion.div>

              {/* Bottom Middle Circle: Indigo Workflow Layers */}
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                whileHover={{ scale: 1.15 }}
                className="absolute bottom-0 w-12 h-12 sm:w-13 sm:h-13 rounded-full shadow-[0_10px_22px_rgba(99,102,241,0.38)] ring-4 ring-white overflow-hidden cursor-pointer group"
              >
                <div className="w-full h-full bg-gradient-to-tr from-[#4338ca] via-[#6366f1] to-[#818cf8] flex items-center justify-center relative">
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent rounded-t-full pointer-events-none" />
                  <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] stroke-[2.2] group-hover:scale-110 transition-transform" />
                </div>
              </motion.div>

              {/* Right Circle: Azure Shield Security */}
              <motion.div 
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                whileHover={{ scale: 1.15 }}
                className="absolute right-3 sm:right-7 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-[0_12px_28px_rgba(2,132,199,0.35)] ring-4 ring-white overflow-hidden cursor-pointer group"
              >
                <div className="w-full h-full bg-gradient-to-tr from-[#0369a1] via-[#0284c7] to-[#38bdf8] flex items-center justify-center relative">
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent rounded-t-full pointer-events-none" />
                  <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] stroke-[2.2] group-hover:scale-110 transition-transform" />
                </div>
              </motion.div>

            </div>

            {/* Pagination Dots (Matching reference style) */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <span className="w-4 h-1.5 rounded-full bg-[#54250E]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#CBB09E]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#E4D1C3]"></span>
            </div>

            {/* Bottom Motion Badge: DEVELOPED BY DEEPAK SAHU */}
            <div className="pt-1 flex justify-center">
              <TypingText text="DEVELOPED BY DEEPAK SAHU" />
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: Get Started Clean Form                                       */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 md:px-12 py-6 sm:py-10">
          
          <div className="max-w-md w-full mx-auto space-y-7">
            
            {/* Header: Get Started */}
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
                Get Started
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                Already have account? <span className="text-[#54250E] hover:text-[#7A3614] font-bold cursor-pointer transition-colors">Sign In</span>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              
              {/* Username Input with Light Blue-Tinted Box Background */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 block">
                  Name / Username
                </label>
                <input
                  type="text"
                  name="username"
                  placeholder="Enter your username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-[#EEF4FF] border border-blue-100/60 rounded-xs text-sm sm:text-base font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#54250E] transition-all"
                />
              </div>

              {/* Password Input with Light Blue-Tinted Box Background & Eye Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={visible ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 pr-10 bg-[#EEF4FF] border border-blue-100/60 rounded-xs text-sm sm:text-base font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#54250E] transition-all"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#54250E] transition-colors cursor-pointer"
                  >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Chocolate Button */}
              <motion.button
                type="submit"
                disabled={isLoginLoading || isDataLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-4 py-3.5 px-6 bg-[#54250E] hover:bg-[#431D0A] text-white rounded-xl font-bold text-sm sm:text-base tracking-wide shadow-md shadow-[#54250E]/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoginLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying Credentials...</span>
                  </>
                ) : isDataLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Connecting to Directory...</span>
                  </>
                ) : (
                  <span>Sign Up / Sign In</span>
                )}
              </motion.button>
            </form>

            {/* Bottom "Or sign up with" social circles */}
            <div className="pt-2">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400">Or sign up with</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                
                {/* Google Icon Circle */}
                <motion.div 
                  whileHover={{ scale: 1.08 }}
                  className="w-10 h-10 rounded-full border border-slate-100 shadow-sm flex items-center justify-center bg-white cursor-pointer"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                  </svg>
                </motion.div>

                {/* Twitter Icon Circle */}
                <motion.div 
                  whileHover={{ scale: 1.08 }}
                  className="w-10 h-10 rounded-full border border-slate-100 shadow-sm flex items-center justify-center bg-white cursor-pointer text-sky-400"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                  </svg>
                </motion.div>

                {/* Facebook Icon Circle */}
                <motion.div 
                  whileHover={{ scale: 1.08 }}
                  className="w-10 h-10 rounded-full border border-slate-100 shadow-sm flex items-center justify-center bg-white cursor-pointer text-blue-600"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                  </svg>
                </motion.div>

              </div>
            </div>

          </div>

        </div>

      </motion.div>

      {/* ========================================================================= */}
      {/* Toast Notification with AnimatePresence                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed top-6 right-6 z-50"
          >
            <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl backdrop-blur-md border text-xs font-semibold ${
              toast.type === "success"
                ? "bg-emerald-950/95 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/95 border-rose-500/40 text-rose-200"
            }`}>
              {toast.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <p>{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Success Modal Popup with AnimatePresence                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showSuccessPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-slate-950/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-sm w-full mx-4 bg-white rounded-3xl p-8 text-center shadow-2xl border border-slate-100"
            >
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-700 mb-4 shadow-inner">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">
                Authentication Approved
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Welcome, <strong className="text-emerald-700 font-bold">{loggedInUsername}</strong>. Redirecting to Dashboard...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default LoginPage;
