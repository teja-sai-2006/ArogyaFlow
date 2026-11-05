import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DemoUser } from '../types';
import {
  ShieldAlert, User, Bell, Radio, LogOut, ChevronDown, CheckCircle2,
  Hospital, Stethoscope, FlaskConical, Droplet, Store, UserCheck
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, demoUsers, notifications, wsConnected, switchUser, logout, markNotificationRead, clearNotifications } = useAuth();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
    HOSP_ADMIN: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    HOSP_MGMT: 'bg-blue-100 text-blue-800 border-blue-300',
    DOCTOR: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    LAB_TECH: 'bg-teal-100 text-teal-800 border-teal-300',
    BLOOD_BANK: 'bg-rose-100 text-rose-800 border-rose-300',
    PHARMACY: 'bg-amber-100 text-amber-800 border-amber-300',
    PATIENT: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return <ShieldAlert className="w-4 h-4 text-purple-600" />;
      case 'HOSP_ADMIN': return <Hospital className="w-4 h-4 text-indigo-600" />;
      case 'HOSP_MGMT': return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'DOCTOR': return <Stethoscope className="w-4 h-4 text-emerald-600" />;
      case 'LAB_TECH': return <FlaskConical className="w-4 h-4 text-teal-600" />;
      case 'BLOOD_BANK': return <Droplet className="w-4 h-4 text-rose-600" />;
      case 'PHARMACY': return <Store className="w-4 h-4 text-amber-600" />;
      default: return <User className="w-4 h-4 text-cyan-600" />;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            🏥
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                ArogyaFlow
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                ఆరోగ్యఫ్లో
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Integrated Triage, Resource & Emergency Network
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center space-x-3">
          
          {/* WebSocket Status Indicator */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              wsConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={wsConnected ? 'Real-Time WebSocket Bus Connected' : 'Connecting to WebSocket...'}
          >
            <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'animate-pulse text-emerald-600' : 'text-amber-600'}`} />
            <span className="hidden md:inline">{wsConnected ? 'Live Bus' : 'Connecting'}</span>
          </div>

          {/* Quick Demo Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              <span>⚡ Switch Role ({user?.role || 'Guest'})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Seeded Demo Account (1-Click Switch)
                </div>
                {demoUsers.map((u) => {
                  const isCurrent = user?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u);
                        setShowRoleDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start space-x-2.5 hover:bg-slate-50 transition ${
                        isCurrent ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <span className="mt-0.5">{getRoleIcon(u.role)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-800 truncate">{u.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${roleColors[u.role] || ''}`}>
                            {u.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                        {u.uhid && <p className="text-[10px] font-mono text-cyan-600 font-semibold">{u.uhid} ({u.blood_group})</p>}
                      </div>
                      {isCurrent && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 self-center" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Real-time Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 relative text-slate-600 transition"
              title="Real-time alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800">Live Cross-Portal Alerts</span>
                    <span className="text-[10px] bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded-full">
                      {notifications.length}
                    </span>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    No alerts received yet. Actions across tabs (Emergency SOS, Attendance flip, Lab uploads) will appear here live!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-3 text-xs transition cursor-pointer ${
                          n.read ? 'bg-white opacity-70' : 'bg-rose-50/50 hover:bg-rose-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">{n.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Current User Chip & Logout */}
          {user && (
            <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[130px]">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate max-w-[130px]">
                  {user.org_name || user.role}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};
