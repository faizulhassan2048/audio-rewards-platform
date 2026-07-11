'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Mail, Calendar, LogOut, Settings, Edit, Lock,
  ShieldCheck, FileText, Phone, MessageCircle, ChevronRight, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

const CONTACT_EMAIL = 'awaisealtaf@gmail.com';
const CONTACT_WHATSAPP = '923267886564'; // country code + number, no leading 0 or +
const PROFILE_CACHE_KEY = 'profile_cache';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Hydrate instantly from the cached snapshot (if any) so this page
    // paints immediately instead of showing a blank spinner on every
    // visit — the fresh network request below still runs in the
    // background and silently replaces this data when it arrives.
    let hadCache = false;
    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setUser(parsed.user);
        setNewName(parsed.newName || '');
        setLoading(false);
        hadCache = true;
      }
    } catch { /* corrupt/missing cache — fall back to normal spinner load */ }

    loadProfile(hadCache);
  }, []);

  const loadProfile = async (isBackgroundRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      const nextUser = { ...user, ...profile };
      const nextNewName = profile?.full_name || '';

      setUser(nextUser);
      setNewName(nextNewName);

      // Cache a snapshot so the NEXT time this page mounts, we can paint
      // instantly from cache instead of showing a blank spinner while
      // network requests are in flight.
      try {
        sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
          user: nextUser,
          newName: nextNewName,
        }));
      } catch { /* sessionStorage can fail in private mode — non-fatal */ }
    } catch (error) {
      if (!isBackgroundRefresh) console.error('Profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    try { sessionStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* non-fatal */ }
    router.push('/');
  };

  // Update Name
  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: newName })
        .eq('id', user.id);

      if (error) throw error;

      const updatedUser = { ...user, full_name: newName };
      setUser(updatedUser);
      try {
        sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
          user: updatedUser,
          newName,
        }));
      } catch { /* non-fatal */ }
      toast.success('Name updated successfully!');
      setShowNameModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update name');
    } finally {
      setUpdating(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setUpdating(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        setUpdating(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto p-4 space-y-4">

        {/* Avatar */}
        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full flex items-center justify-center mx-auto text-white text-3xl font-bold">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          <h2 className="text-xl font-bold mt-3">{user?.full_name || 'User'}</h2>
          <p className="text-gray-500 text-sm">@{user?.username || 'user'}</p>
          <span className="inline-block mt-1 px-3 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
            {user?.role || 'User'}
          </span>
        </div>

        {/* Info Cards */}
        <div className="bg-white rounded-2xl shadow divide-y divide-gray-100">
          <div className="flex items-center gap-3 p-4">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Joined</p>
              <p className="text-sm font-medium">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-PK', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                }) : 'Today'}
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Policy / Terms of Use / Contact */}
        <div className="bg-white rounded-2xl shadow overflow-hidden divide-y divide-gray-100">
          <Link
            href="/privacy-policy"
            className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>

          <Link
            href="/terms"
            className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">Terms of Use</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>

          <div>
            <button
              onClick={() => setShowContact(!showContact)}
              className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-800">Contact</span>
              </div>
              {showContact ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showContact && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="w-full flex items-center gap-3 p-4 hover:bg-purple-50 transition"
                >
                  <Mail className="w-5 h-5 text-purple-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Email Us</p>
                    <p className="text-xs text-gray-400">{CONTACT_EMAIL}</p>
                  </div>
                </a>
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 p-4 hover:bg-purple-50 transition"
                >
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-800">WhatsApp Us</p>
                    <p className="text-xs text-gray-400">+{CONTACT_WHATSAPP}</p>
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Settings Panel — kept last */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">Settings</span>
            </div>
            <span className="text-gray-400 text-sm">{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {/* Change Name */}
              <button
                onClick={() => setShowNameModal(true)}
                className="w-full flex items-center gap-3 p-4 hover:bg-purple-50 transition"
              >
                <Edit className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Change Name</p>
                  <p className="text-xs text-gray-400">Update your full name</p>
                </div>
              </button>

              {/* Reset Password */}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center gap-3 p-4 hover:bg-purple-50 transition"
              >
                <Lock className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Reset Password</p>
                  <p className="text-xs text-gray-400">Update your password</p>
                </div>
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition"
              >
                <LogOut className="w-5 h-5 text-red-600" />
                <div className="text-left">
                  <p className="font-medium text-red-600">Logout</p>
                  <p className="text-xs text-gray-400">Sign out of your account</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold mb-2">Change Name</h3>
            <p className="text-sm text-gray-500 mb-4">Update your full name</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowNameModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateName}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold mb-2">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">Update your account password</p>
            <div className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}