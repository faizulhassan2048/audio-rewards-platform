'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Headphones, Plus, Edit, Trash2, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Audio {
  id: string;
  title: string;
  description: string;
  duration_seconds: number;
  reward_coins: number;
  category: string;
  is_active: boolean;
  play_count: number;
  completion_count: number;
  created_at: string;
}

export default function AdminAudioPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [audios, setAudios] = useState<Audio[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    reward_coins: 50,
    category: 'Education',
    file: null as File | null,
  });

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userData || userData.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setIsAdmin(true);
      await loadAudios();
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadAudios = async () => {
    const { data, error } = await supabase
      .from('audios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error loading audios');
    } else {
      setAudios(data || []);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file) {
      toast.error('Please select an audio file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', form.file);
      formData.append('title', form.title);
      formData.append('rewardCoins', String(form.reward_coins));
      formData.append('category', form.category);
      if (form.description) formData.append('description', form.description);

      const res = await fetch('/api/admin/audio', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Audio uploaded successfully!');
        setShowUpload(false);
        setForm({ title: '', description: '', reward_coins: 50, category: 'Education', file: null });
        await loadAudios();
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await supabase
        .from('audios')
        .update({ is_active: !current })
        .eq('id', id);
      toast.success('Audio updated');
      await loadAudios();
    } catch {
      toast.error('Update failed');
    }
  };

  const deleteAudio = async (id: string) => {
    if (!confirm('Delete this audio?')) return;
    try {
      await supabase.from('audios').delete().eq('id', id);
      toast.success('Audio deleted');
      await loadAudios();
    } catch {
      toast.error('Delete failed');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-purple-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Audio Management</h1>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" /> Upload Audio
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Form */}
        {showUpload && (
          <div className="bg-white rounded-2xl shadow p-6 mb-6 border">
            <h2 className="text-lg font-bold mb-4">Upload New Audio</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reward Coins *</label>
                  <input
                    type="number"
                    value={form.reward_coins}
                    onChange={(e) => setForm({ ...form, reward_coins: Number(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option>Education</option>
                    <option>Entertainment</option>
                    <option>News</option>
                    <option>Music</option>
                    <option>Podcast</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Audio File *</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload Audio'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Audio List */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Title</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Duration</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Reward</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Plays</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      <Headphones className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      No audios uploaded yet
                    </td>
                  </tr>
                ) : (
                  audios.map((audio) => (
                    <tr key={audio.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-700">{audio.title}</p>
                          {audio.description && (
                            <p className="text-sm text-gray-400 truncate max-w-xs">{audio.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatTime(audio.duration_seconds)}</td>
                      <td className="px-6 py-4 text-sm text-purple-600 font-semibold">{audio.reward_coins} 🪙</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{audio.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{audio.play_count || 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          audio.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {audio.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/audio/${audio.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="View"
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={() => toggleActive(audio.id, audio.is_active)}
                            className={`p-1.5 rounded-lg transition ${
                              audio.is_active
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={audio.is_active ? 'Disable' : 'Enable'}
                          >
                            {audio.is_active ? '🔇' : '🔊'}
                          </button>
                          <button
                            onClick={() => deleteAudio(audio.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}