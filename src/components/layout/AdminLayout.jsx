"use client"

import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { CheckSquare, ClipboardList, Home, LogOut, Menu, Database, ChevronDown, ChevronRight, Zap, FileText, X, Play, Pause, KeyRound, Video, Settings, User, Edit3, Upload } from 'lucide-react'

import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "../../lib/supabaseClient"
import { uploadImageToCloudinary } from "../../lib/cloudinary"

const TypingText = ({ text }) => {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + text.charAt(index));
        setIndex((prev) => prev + 1);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setDisplayed("");
        setIndex(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [index, text]);

  return (
    <span className="font-semibold inline-flex items-center">
      {displayed}
      <span className="ml-1 w-0.5 h-4 bg-slate-700 animate-pulse inline-block"></span>
    </span>
  );
};

export default function AdminLayout({ children, darkMode, toggleDarkMode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDataSubmenuOpen, setIsDataSubmenuOpen] = useState(false)
  const [isSettingsSubmenuOpen, setIsSettingsSubmenuOpen] = useState(false)
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [userRole, setUserRole] = useState("")
  const [userEmail, setUserEmail] = useState("")

  // Profile photo (DP) shown in the top header bar, moved here from the Dashboard
  // page so it appears consistently across all admin pages. Initialized from a
  // sessionStorage cache so it renders instantly on every page switch instead of
  // flashing blank/placeholder while the Supabase fetch completes again.
  const [userProfileImage, setUserProfileImage] = useState(() => sessionStorage.getItem('profile_photo_url') || null)
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [showImageViewModal, setShowImageViewModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)


  // Check authentication on component mount
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username')
    const storedRole = sessionStorage.getItem('role')
    const storedEmail = sessionStorage.getItem('email')

    if (!storedUsername) {
      // Redirect to login if not authenticated
      navigate("/login")
      return
    }

    setUsername(storedUsername)
    setUserRole(storedRole || "user")
    setUserEmail(storedEmail || "")
  }, [navigate])

  // Converts a raw Photo URL (Google Drive share link, Cloudinary URL, etc.) stored
  // in the Whatsapp table into a directly displayable image URL.
  const getDisplayableImageUrl = (url) => {
    if (!url) return null;

    if (
      url.includes("cloudinary.com") ||
      url.includes("ui-avatars.com") ||
      url.startsWith("blob:") ||
      url.startsWith("data:") ||
      (!url.includes("drive.google.com") && (url.startsWith("http://") || url.startsWith("https://")))
    ) {
      return url;
    }

    try {
      const ucExportMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (ucExportMatch && ucExportMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${ucExportMatch[1]}&sz=w150`;
      }

      const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (directMatch && directMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${directMatch[1]}&sz=w150`;
      }

      const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
      if (openMatch && openMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w150`;
      }

      if (url.includes("thumbnail?id=")) {
        return url;
      }

      const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
      if (anyIdMatch && anyIdMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w150`;
      }

      const cacheBuster = Date.now();
      return url.includes("?") ? `${url}&cb=${cacheBuster}` : `${url}?cb=${cacheBuster}`;
    } catch (e) {
      console.error("Error processing image URL:", url, e);
      return url;
    }
  };

  // Fetch the user's profile photo from the Whatsapp table.
  useEffect(() => {
    const fetchProfilePhoto = async () => {
      const storedUsername = sessionStorage.getItem('username');
      if (!storedUsername) return;
      try {
        const { data, error } = await supabase.from('Whatsapp').select('*');
        if (error) throw error;
        const userRow = (data || []).find(r => (r['User name'] || r.Username || '').toLowerCase() === storedUsername.toLowerCase());
        const photo = userRow && (userRow.Photo || userRow.Image);
        if (photo) {
          const displayUrl = getDisplayableImageUrl(photo);
          setUserProfileImage(displayUrl);
          sessionStorage.setItem('profile_photo_url', displayUrl);
        }
      } catch (error) {
        console.error("Error fetching profile photo from Supabase:", error);
      }
    };
    fetchProfilePhoto();
  }, [])

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadImageAndUpdateWhatsApp = async () => {
    if (!selectedFile) {
      alert('Please select an image first');
      return;
    }

    try {
      setUploadingImage(true);
      const storedUsername = sessionStorage.getItem('username');

      if (!storedUsername) {
        throw new Error('Username not found in session');
      }

      // 1. Upload photo directly to Cloudinary
      const uploadedUrl = await uploadImageToCloudinary(selectedFile);
      if (!uploadedUrl) {
        throw new Error('Could not get image URL from Cloudinary upload');
      }

      // 2. Update Photo in Supabase Whatsapp table
      const { error: updateErr } = await supabase
        .from('Whatsapp')
        .update({ Photo: uploadedUrl })
        .ilike('Username', storedUsername.trim());

      if (updateErr) throw updateErr;

      // 3. Update local state with the new image
      setUserProfileImage(uploadedUrl);
      sessionStorage.setItem('profile_photo_url', uploadedUrl);

      // 4. Close modal and reset
      setShowImageUploadModal(false);
      setSelectedFile(null);

      alert('Profile photo (DP) uploaded and updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload profile photo: ' + (error.message || error));
    } finally {
      setUploadingImage(false);
    }
  };



  // Handle logout
  const handleLogout = () => {
    sessionStorage.clear()
    localStorage.removeItem('checklist_page_cache_v1')
    localStorage.removeItem('delegation_page_cache_v1')
    localStorage.removeItem('dashboard_page_cache_checklist')
    localStorage.removeItem('dashboard_page_cache_delegation')
    navigate("/login")
  }


  // Filter dataCategories based on user role
  const dataCategories = [
    //{ id: "main", name: "PURAB", link: "/dashboard/data/main" },
    { id: "sales", name: "Checklist", link: "/dashboard/data/sales" },
    // { id: "service", name: "Service", link: "/dashboard/data/service" },
    //{ id: "account", name: "RKL", link: "/dashboard/data/account" },
    //{ id: "warehouse", name: "REFRASYNTH", link: "/dashboard/data/warehouse" },
    //{ id: "delegation", name: "Delegation", link: "/dashboard/data/delegation" },
    //{ id: "purchase", name: "Slag Crusher", link: "/dashboard/data/purchase" },
    //{ id: "director", name: "Hr", link: "/dashboard/data/director" },
    //{ id: "managing-director", name: "PURAB", link: "/dashboard/data/managing-director" },
    // { id: "coo", name: "COO", link: "/dashboard/data/coo" },
    // { id: "jockey", name: "Jockey", link: "/dashboard/data/jockey" },
  ]

  // Update the routes array based on user role
  const routes = [
    {
      href: "/dashboard/admin",
      label: "Dashboard",
      icon: Database,
      active: location.pathname === "/dashboard/admin",
      showFor: ["admin", "user"] // Show for both roles
    },
    {
      href: "/dashboard/assign-task",
      label: "Assign Task",
      icon: CheckSquare,
      active: location.pathname === "/dashboard/assign-task",
      showFor: ["admin"] // Only show for admin
    },
    {
      href: "/dashboard/delegation",
      label: "Delegation",
      icon: ClipboardList,
      active: location.pathname === "/dashboard/delegation",
      showFor: ["admin", "user"] // Only show for admin
    },
    {
      href: "/dashboard/data/sales",
      label: "Checklist",
      icon: Database,
      active: location.pathname === "/dashboard/data/sales",
      showFor: ["admin", "user"] // Show for both roles
    },
    {
      href: "/dashboard/quick-task",
      label: "Unique Task",
      icon: Zap,
      active: location.pathname === "/dashboard/quick-task",
      showFor: ["admin", "user"] // Only show for admin
    },
    {
      href: "/dashboard/traning-video",
      label: "Training Video",
      icon: Video,
      active: location.pathname === "/dashboard/traning-video",
      showFor: ["admin", "user"] //  show both
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      icon: Settings,
      active: location.pathname.startsWith("/dashboard/settings"),
      showFor: ["admin"],
      submenu: true,
      submenuType: "settings",
      submenuItems: [
        { name: "User ID Directory & Management", link: "/dashboard/settings#user-management" },
        { name: "Manual Data Dump to Google Sheet", link: "/dashboard/settings#manual-data-dump" },
        { name: "Task Generation Trigger Console", link: "/dashboard/settings#trigger-console" },
        { name: "Recurring Checklist Templates Inspector", link: "/dashboard/settings#recurring-templates" },
        { name: "Whatsapp Service", link: "/dashboard/settings/whatsapp-sms" },
      ]
    },
  ]

  const getAccessibleDepartments = () => {
    const userRole = sessionStorage.getItem('role') || 'user'
    return dataCategories.filter(cat =>
      !cat.showFor || cat.showFor.includes(userRole)
    )
  }

  // Filter routes based on user role
  const getAccessibleRoutes = () => {
    const userRole = sessionStorage.getItem('role') || 'user'
    return routes.filter(route =>
      route.showFor.includes(userRole)
    )
  }

  // Check if the current path is a data category page
  const isDataPage = location.pathname.includes("/dashboard/data/")

  // If it's a data page, expand the submenu by default
  useEffect(() => {
    if (isDataPage && !isDataSubmenuOpen) {
      setIsDataSubmenuOpen(true)
    }
  }, [isDataPage, isDataSubmenuOpen])

  // Get accessible routes and departments
  const accessibleRoutes = getAccessibleRoutes()
  const accessibleDepartments = getAccessibleDepartments()

  // License Modal Component
  const LicenseModal = () => {
    // Function to convert YouTube URL to embed URL
    const getYouTubeEmbedUrl = (url) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11
        ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0`
        : url;
    };


  }

  return (
    <div
      className={`flex h-screen overflow-hidden`}
      style={{ background: 'linear-gradient(135deg, #e8e0f0 0%, #d5cce0 25%, #c9c2d4 50%, #d0cad8 75%, #e2dce8 100%)' }}
    >
      {/* Sidebar for desktop */}
      <aside className="hidden w-64 flex-shrink-0 md:flex md:flex-col m-3 mr-0 rounded-2xl shadow-lg" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
        <div className="flex h-16 items-center justify-center px-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.4)' }}>
          <Link
            to="/dashboard/admin"
            className="flex items-center gap-2.5 select-none group py-1 px-1 transition-transform"
          >
            {/* Luxury 3D Monogram Crest */}
            <div className="relative w-9 h-9 rounded-xl p-[1.5px] bg-gradient-to-br from-[#F5D061] via-[#E6AF2E] to-[#7C4700] shadow-[0_4px_12px_rgba(124,71,0,0.28)] group-hover:scale-105 transition-transform duration-300">
              <div className="w-full h-full rounded-[10px] bg-gradient-to-br from-[#2E1408] via-[#1B0B04] to-[#0E0502] flex items-center justify-center relative overflow-hidden border border-[#F5D061]/40">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none" />
                <span 
                  className="font-serif font-black text-lg tracking-tight leading-none"
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

            {/* Premium Typography */}
            <div className="flex flex-col justify-center text-left">
              <span
                className="text-base font-black tracking-[0.14em] uppercase leading-tight"
                style={{
                  background: 'linear-gradient(180deg, #3B1706 0%, #240C02 65%, #150600 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.9)) drop-shadow(0 2px 3px rgba(45,22,9,0.25))',
                }}
              >
                ROMA
              </span>
              <span
                className="text-[9px] font-black tracking-[0.36em] uppercase -mt-0.5"
                style={{
                  background: 'linear-gradient(90deg, #B87C24 0%, #E2AB44 50%, #9E6414 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.6))',
                }}
              >
                FOODS
              </span>
            </div>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {accessibleRoutes.map((route) => (
              <li key={route.label}>
                {route.submenu ? (
                  <div>
                    {route.submenuType === "settings" ? (
                      <>
                        <button
                          onClick={() => setIsSettingsSubmenuOpen(!isSettingsSubmenuOpen)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${route.active
                            ? "bg-slate-800 text-white shadow-md"
                            : "text-slate-600 hover:bg-white/60"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <route.icon
                              className={`h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                                }`}
                            />
                            {route.label}
                          </div>
                          {isSettingsSubmenuOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {isSettingsSubmenuOpen && (
                          <ul className="mt-1.5 ml-4 space-y-1 border-l-2 border-slate-200/60 pl-3">
                            {(route.submenuItems || []).map((subItem) => {
                              const isSubActive = (location.pathname + location.hash === subItem.link) || 
                                (subItem.link.includes('#') && location.pathname === '/dashboard/settings' && location.hash === `#${subItem.link.split('#')[1]}`) ||
                                (!subItem.link.includes('#') && location.pathname === subItem.link);

                              return (
                                <li key={subItem.link}>
                                  <Link
                                    to={subItem.link}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 ${isSubActive
                                      ? "bg-slate-700 text-white font-bold shadow-sm"
                                      : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                                      }`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                  >
                                    {subItem.name}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsDataSubmenuOpen(!isDataSubmenuOpen)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${route.active
                            ? "bg-slate-800 text-white shadow-md"
                            : "text-slate-600 hover:bg-white/60"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <route.icon
                              className={`h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                                }`}
                            />
                            {route.label}
                          </div>
                          {isDataSubmenuOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {isDataSubmenuOpen && (
                          <ul className="mt-1.5 ml-4 space-y-1 border-l-2 border-slate-200/60 pl-3">
                            {accessibleDepartments.map((category) => (
                              <li key={category.id}>
                                <Link
                                  to={
                                    category.link ||
                                    `/dashboard/data/${category.id}`
                                  }
                                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${location.pathname ===
                                    (category.link ||
                                      `/dashboard/data/${category.id}`)
                                    ? "bg-slate-700 text-white font-medium shadow-sm"
                                    : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                                    }`}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  {category.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <Link
                    to={route.href}
                    className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${route.active
                      ? "text-white"
                      : "text-slate-600 hover:bg-white/60"
                      }`}
                  >
                    {route.active && (
                      <motion.div
                        layoutId="sidebar-active-pill-desktop"
                        className="absolute inset-0 rounded-xl bg-slate-800 shadow-md"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <route.icon
                      className={`relative z-10 h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                        }`}
                    />
                    <span className="relative z-10">{route.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>


          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                <span className="text-sm font-semibold text-white">
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {username || "User"} {userRole === "admin" ? "(Admin)" : ""}
                </p>
                <p className="text-xs text-slate-400">
                  {userEmail ||
                    (username
                      ? `${username.toLowerCase()}@example.com`
                      : "user@example.com")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* <button
                onClick={() => setIsLicenseModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                title="License & Help"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium">License</span>
              </button> */}
              {toggleDarkMode && (
                <button
                  onClick={toggleDarkMode}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
                >
                  {darkMode ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  )}
                  <span className="sr-only">
                    {darkMode ? "Light mode" : "Dark mode"}
                  </span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden absolute left-4 top-[22px] z-50 text-slate-600 p-2 rounded-xl hover:bg-white/60 transition-all duration-200"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </button>

      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/30"
            style={{ backdropFilter: 'blur(4px)' }}
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="fixed inset-y-0 left-0 w-72 shadow-2xl rounded-r-2xl" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div className="flex h-16 items-center justify-center px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
              <Link
                to="/dashboard/admin"
                className="flex items-center gap-2.5 select-none py-1"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {/* Luxury 3D Monogram Crest */}
                <div className="relative w-9 h-9 rounded-xl p-[1.5px] bg-gradient-to-br from-[#F5D061] via-[#E6AF2E] to-[#7C4700] shadow-[0_4px_12px_rgba(124,71,0,0.28)]">
                  <div className="w-full h-full rounded-[10px] bg-gradient-to-br from-[#2E1408] via-[#1B0B04] to-[#0E0502] flex items-center justify-center relative overflow-hidden border border-[#F5D061]/40">
                    <span 
                      className="font-serif font-black text-lg tracking-tight leading-none"
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

                {/* Premium Typography */}
                <div className="flex flex-col justify-center text-left">
                  <span
                    className="text-base font-black tracking-[0.14em] uppercase leading-tight"
                    style={{
                      background: 'linear-gradient(180deg, #3B1706 0%, #240C02 65%, #150600 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.9)) drop-shadow(0 2px 3px rgba(45,22,9,0.25))',
                    }}
                  >
                    ROMA
                  </span>
                  <span
                    className="text-[9px] font-black tracking-[0.36em] uppercase -mt-0.5"
                    style={{
                      background: 'linear-gradient(90deg, #B87C24 0%, #E2AB44 50%, #9E6414 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    FOODS
                  </span>
                </div>
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1.5">
                {accessibleRoutes.map((route) => (
                  <li key={route.label}>
                    {route.submenu ? (
                      <div>
                        {route.submenuType === "settings" ? (
                          <>
                            <button
                              onClick={() => setIsSettingsSubmenuOpen(!isSettingsSubmenuOpen)}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${route.active
                                ? "bg-slate-800 text-white shadow-md"
                                : "text-slate-600 hover:bg-white/60"
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <route.icon
                                  className={`h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                                    }`}
                                />
                                {route.label}
                              </div>
                              {isSettingsSubmenuOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            {isSettingsSubmenuOpen && (
                              <ul className="mt-1.5 ml-4 space-y-1 border-l-2 border-slate-200/60 pl-3">
                                {(route.submenuItems || []).map((subItem) => {
                                  const isSubActive = (location.pathname + location.hash === subItem.link) || 
                                    (subItem.link.includes('#') && location.pathname === '/dashboard/settings' && location.hash === `#${subItem.link.split('#')[1]}`) ||
                                    (!subItem.link.includes('#') && location.pathname === subItem.link);

                                  return (
                                    <li key={subItem.link}>
                                      <Link
                                        to={subItem.link}
                                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 ${isSubActive
                                          ? "bg-slate-700 text-white font-bold shadow-sm"
                                          : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                                          }`}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                      >
                                        {subItem.name}
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setIsDataSubmenuOpen(!isDataSubmenuOpen)
                              }
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${route.active
                                ? "bg-slate-800 text-white shadow-md"
                                : "text-slate-600 hover:bg-white/60"
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <route.icon
                                  className={`h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                                    }`}
                                />
                                {route.label}
                              </div>
                              {isDataSubmenuOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            {isDataSubmenuOpen && (
                              <ul className="mt-1.5 ml-4 space-y-1 border-l-2 border-slate-200/60 pl-3">
                                {accessibleDepartments.map((category) => (
                                  <li key={category.id}>
                                    <Link
                                      to={
                                        category.link ||
                                        `/dashboard/data/${category.id}`
                                      }
                                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${location.pathname ===
                                        (category.link ||
                                          `/dashboard/data/${category.id}`)
                                        ? "bg-slate-700 text-white font-medium shadow-sm"
                                        : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                                        }`}
                                      onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                      {category.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <Link
                        to={route.href}
                        className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${route.active
                          ? "text-white"
                          : "text-slate-600 hover:bg-white/60"
                          }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {route.active && (
                          <motion.div
                            layoutId="sidebar-active-pill-mobile"
                            className="absolute inset-0 rounded-xl bg-slate-800 shadow-md"
                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          />
                        )}
                        <route.icon
                          className={`relative z-10 h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                            }`}
                        />
                        <span className="relative z-10">{route.label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>


              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                  >
                    <span className="text-sm font-semibold text-white">
                      {username ? username.charAt(0).toUpperCase() : "U"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {username || "User"}{" "}
                      {userRole === "admin" ? "(Admin)" : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      {userEmail ||
                        (username
                          ? `${username.toLowerCase()}@example.com`
                          : "user@example.com")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* <button
                    onClick={() => setIsLicenseModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1"
                    title="License & Help"
                  >
                    <FileText className="h-3 w-3" />
                    <span className="text-xs font-medium">License</span>
                  </button>
                  */}
                  {toggleDarkMode && (
                    <button
                      onClick={toggleDarkMode}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
                    >
                      {darkMode ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                      )}
                      <span className="sr-only">
                        {darkMode ? "Light mode" : "Dark mode"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">Log out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* License Modal */}
      {isLicenseModalOpen && <LicenseModal />}

      {/* Profile Photo View Modal (lightbox) */}
      {showImageViewModal && userProfileImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageViewModal(false)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageViewModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-slate-200"
            >
              <X className="h-7 w-7" />
              <span className="sr-only">Close</span>
            </button>
            <img
              src={userProfileImage}
              alt="Profile"
              className="w-full aspect-square rounded-2xl object-cover shadow-2xl border-4 border-white"
              style={{ backgroundColor: "#f3f4f6" }}
              onError={(e) => {
                const originalUrl = userProfileImage
                  .replace("thumbnail?", "uc?export=view&")
                  .replace("&sz=w150", "");
                e.target.src = originalUrl;
              }}
            />
            <button
              onClick={() => {
                setShowImageViewModal(false);
                setShowImageUploadModal(true);
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-white text-slate-700 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:bg-slate-50 transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              Change Photo
            </button>
          </div>
        </div>
      )}

      {/* Profile Photo Upload Modal */}
      {showImageUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Profile Image
              </h3>
              <button
                onClick={() => {
                  setShowImageUploadModal(false);
                  setSelectedFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Image File
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: JPG, PNG, GIF (Max 10MB)
                </p>
              </div>

              {selectedFile && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Upload className="h-5 w-5 text-purple-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowImageUploadModal(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadImageAndUpdateWhatsApp}
                  disabled={!selectedFile || uploadingImage}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {uploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    "Upload Image"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 items-center justify-between gap-2 px-3 sm:px-4 md:px-6 m-3 mb-0 rounded-2xl shadow-sm py-2" style={{ background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.5)' }}>
          <div className="flex md:hidden w-8 shrink-0"></div>
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-sm md:text-lg font-bold">
            <span className="min-w-0 truncate text-slate-700">
              {(() => {
                const hour = new Date().getHours()
                let greeting = "Good Morning"
                if (hour >= 12 && hour < 18) greeting = "Good Afternoon"
                else if (hour >= 18) greeting = "Good Evening"

                return (
                  <>
                    {greeting}, {username ? username.toUpperCase() : "USER"}
                    <span className="hidden sm:inline">! Welcome On Board</span>
                  </>
                )
              })()}
            </span>
            <span className="animate-bounce inline-block shrink-0">👋</span>
          </h1>

          {/* Profile DP + user details */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-bold text-slate-700">{username ? username.toUpperCase() : "USER"}</p>
              <p className="text-xs font-medium text-slate-500 capitalize">{userRole || "user"}{userEmail ? ` · ${userEmail}` : ""}</p>
            </div>
            <div className="relative group shrink-0">
              {userProfileImage ? (
                <div className="relative">
                  <img
                    src={userProfileImage}
                    alt="Profile"
                    className="h-9 w-9 sm:h-11 sm:w-11 rounded-full object-cover border-2 border-white cursor-pointer transition-all duration-200 group-hover:brightness-75 shadow-md"
                    style={{ backgroundColor: "#f3f4f6", objectPosition: "center" }}
                    onClick={() => setShowImageViewModal(true)}
                    title="View profile photo"
                    onError={(e) => {
                      const originalUrl = userProfileImage
                        .replace("thumbnail?", "uc?export=view&")
                        .replace("&sz=w150", "");
                      e.target.src = originalUrl;
                    }}
                  />
                  {/* Purely visual dim-on-hover, does not intercept clicks so the image's own view-modal click keeps working */}
                  <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-30 pointer-events-none" />
                  {/* Small edit badge: separate click target so "view" and "edit" don't fight over the same click */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowImageUploadModal(true);
                    }}
                    className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-purple-600 border-2 border-white shadow-sm hover:bg-purple-700 transition-colors"
                    title="Change profile photo"
                  >
                    <Edit3 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div
                    className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-purple-500 flex items-center justify-center border-2 border-white cursor-pointer transition-all duration-200 group-hover:brightness-75 shadow-md"
                    onClick={() => setShowImageUploadModal(true)}
                  >
                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-30 rounded-full cursor-pointer"
                    onClick={() => setShowImageUploadModal(true)}
                  >
                    <Edit3 className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/*<button
            onClick={() => setIsLicenseModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            title="License & Help"
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">License</span>
          </button>
          */}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {children}
          </motion.div>
          <style>{`
            @keyframes shine-text {
              0% { background-position: 200% center; }
              100% { background-position: -200% center; }
            }
          `}</style>
          <div className="fixed md:left-[280px] md:right-3 left-0 right-0 bottom-0 py-1.5 px-4 z-10 flex items-center justify-center rounded-t-2xl shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.8)', borderLeft: '1px solid rgba(255,255,255,0.5)', borderRight: '1px solid rgba(255,255,255,0.5)' }}>
            <div 
              className="text-[10px] sm:text-[11px] font-black tracking-[0.15em] text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #022c22 0%, #064e3b 35%, #10b981 50%, #064e3b 65%, #022c22 100%)',
                backgroundSize: '200% auto',
                animation: 'shine-text 3s linear infinite',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
              }}
            >
              <TypingText text="DEVELOPED BY DEEPAK SAHU" />
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}
