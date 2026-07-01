'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', 'Test Audio');
    formData.append('rewardCoins', '50');
    formData.append('category', 'Education');

    try {
      const res = await fetch('/api/admin/audio', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      
      if (res.ok) {
        alert('✅ Upload successful!');
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Upload Audio</h1>
      
      <input
        type="file"
        accept=".mp3,.wav,.m4a,.ogg,.mpeg"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4 block"
      />
      
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="bg-purple-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Uploading...' : 'Upload'}
      </button>
      
      {result && (
        <pre className="mt-4 bg-gray-100 p-4 rounded text-sm overflow-auto">
          {result}
        </pre>
      )}
    </div>
  );
}