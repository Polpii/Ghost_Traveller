'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StylePack {
  pack_id: string;
  name: string;
  pdf_filename: string;
  created_at: number;
  total_pages: number;
  total_regions: number;
  total_words: number;
  clean_words: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StylePackPanel() {
  const [packs, setPacks] = useState<StylePack[]>([]);
  const [selectedPack, setSelectedPack] = useState<StylePack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [packName, setPackName] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [generateText, setGenerateText] = useState('');
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const previewCacheRef = useRef<Record<string, string>>({});

  // --- Fetch all packs ---
  const fetchPacks = useCallback(async () => {
    try {
      const res = await fetch('/api/style-packs');
      if (res.ok) {
        const data = await res.json();
        setPacks(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  // --- Create style pack ---
  const createPack = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', pdfFile);
    if (packName.trim()) formData.append('name', packName.trim());

    try {
      const res = await fetch('/api/style-packs', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Failed to extract style.');

      setPdfFile(null);
      setPackName('');
      await fetchPacks();
      setSelectedPack(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract style.');
    } finally {
      setUploading(false);
    }
  };

  // --- Delete style pack ---
  const deletePack = async (packId: string) => {
    if (!confirm('Delete this style pack? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/style-packs/${packId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Delete failed.' }));
        setError(body.error ?? 'Delete failed.');
        return;
      }
      if (selectedPack?.pack_id === packId) {
        setSelectedPack(null);
        setGenerateResult(null);
      }
      // Clean up preview cache
      if (previewCacheRef.current[packId]) {
        URL.revokeObjectURL(previewCacheRef.current[packId]);
        delete previewCacheRef.current[packId];
      }
      await fetchPacks();
    } catch {
      setError('Cannot reach service.');
    }
  };

  // --- Get preview URL ---
  const getPreviewUrl = (packId: string) => {
    return `/api/style-packs/${packId}/preview`;
  };

  // --- Generate from style pack ---
  const generateFromPack = async () => {
    if (!selectedPack || !generateText.trim()) return;
    setGenerating(true);
    setGenerateResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('text', generateText);
    formData.append('pack_id', selectedPack.pack_id);

    try {
      const res = await fetch('/api/generate-from-style', { method: 'POST', body: formData });
      const contentType = res.headers.get('content-type') ?? '';

      // Glyph engine may return JSON for errors/quality-gate refusals
      if (contentType.includes('application/json')) {
        const data = await res.json();
        const msg = data.error || data.message || data.detail || 'Generation failed.';
        throw new Error(msg);
      }

      if (!res.ok) {
        throw new Error('Generation failed.');
      }

      const blob = await res.blob();
      setGenerateResult(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  // --- Select a pack ---
  const selectPack = (pack: StylePack) => {
    setSelectedPack(pack);
    setGenerateResult(null);
    setGenerateText('');
    setError(null);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* ---- Upload Section ---- */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 font-sans text-sm font-semibold uppercase tracking-widest text-stone-500">
          Extract a style pack
        </h3>
        <p className="mb-4 font-sans text-xs text-stone-400">
          Upload a PDF of someone&apos;s handwriting. Word crops will be extracted and used as style references for the AI model.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="block font-sans text-xs text-stone-500">PDF file</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs text-stone-600 hover:border-stone-500 hover:bg-stone-50">
              {pdfFile ? pdfFile.name : '+ Select PDF'}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="space-y-2">
            <label className="block font-sans text-xs text-stone-500">Name</label>
            <input
              type="text"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              placeholder="e.g. Grandma's handwriting"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={createPack}
              disabled={!pdfFile || uploading}
              className="rounded-lg bg-stone-800 px-4 py-2 text-xs font-medium text-white shadow transition-colors hover:bg-stone-900 disabled:opacity-40"
            >
              {uploading ? 'Extracting...' : 'Extract style'}
            </button>
          </div>
        </div>
        {uploading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            Rendering PDF, detecting regions, segmenting words...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---- Packs List ---- */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-widest text-stone-500">
            Style packs
          </h3>
          <button onClick={fetchPacks} className="mb-3 text-xs text-stone-400 underline hover:text-stone-600">
            Refresh
          </button>
          {packs.length === 0 ? (
            <p className="text-xs text-stone-400">No style packs yet. Upload a PDF above.</p>
          ) : (
            <div className="space-y-2">
              {packs.map((p) => (
                <button
                  key={p.pack_id}
                  onClick={() => selectPack(p)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedPack?.pack_id === p.pack_id
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className={selectedPack?.pack_id === p.pack_id ? 'text-stone-300' : 'text-stone-400'}>
                      {p.clean_words} word crops
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---- Pack Detail ---- */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          {!selectedPack ? (
            <p className="text-center text-sm text-stone-400 py-10">
              Select a style pack to view details and generate text
            </p>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-sans text-base font-semibold text-stone-800">
                    {selectedPack.name}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {selectedPack.pdf_filename} &middot; {formatDate(selectedPack.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => deletePack(selectedPack.pack_id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100"
                  title="Delete this style pack"
                >
                  ✕ Delete
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ['Pages', selectedPack.total_pages],
                  ['Regions', selectedPack.total_regions],
                  ['Total words', selectedPack.total_words],
                  ['Clean crops', selectedPack.clean_words],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-stone-50 p-3 text-center">
                    <p className="text-lg font-semibold text-stone-800">{value}</p>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                  Word crops preview
                </p>
                <div className="rounded-lg bg-stone-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPreviewUrl(selectedPack.pack_id)}
                    alt="Word crops preview"
                    className="w-full rounded bg-white"
                  />
                </div>
              </div>

              {/* Generate */}
              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-600">
                  Generate with this style
                </p>
                <textarea
                  value={generateText}
                  onChange={(e) => setGenerateText(e.target.value)}
                  placeholder="Type the text to render in this handwriting style..."
                  className="h-20 w-full resize-none rounded-lg border border-stone-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <button
                  onClick={generateFromPack}
                  disabled={!generateText.trim() || generating}
                  className="rounded-lg bg-stone-800 px-4 py-2 text-xs font-medium text-white shadow hover:bg-stone-900 disabled:opacity-40"
                >
                  {generating ? 'Generating...' : 'Generate handwriting'}
                </button>
                {generateResult && (
                  <div className="rounded-lg bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={generateResult} alt="Generated handwriting" className="w-full" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
