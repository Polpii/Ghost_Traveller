'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageResult {
  stage: string;
  status: string;
  started_at: number | null;
  finished_at: number | null;
  duration_s: number | null;
  artifact_count: number;
  message: string;
  details: Record<string, unknown>;
  progress: number;
}

interface GpuStatus {
  gpu_available: boolean;
  device_name?: string;
  vram_total_gb?: number;
  vram_used_gb?: number;
  vram_used_pct?: number;
  gpu_utilization_pct?: number | null;
}

interface TrainingJob {
  job_id: string;
  name: string;
  stage: string;
  created_at: number;
  updated_at: number;
  pdf_filename: string;
  pdf_pages: number;
  total_regions: number;
  total_words: number;
  clean_words: number;
  training_epoch: number;
  training_epochs_target: number;
  training_loss: number;
  model_path: string;
  error: string;
  stage_results: Record<string, StageResult>;
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  pdf_ingestion: 'A. PDF Ingestion',
  region_extraction: 'B. Region Extraction',
  word_segmentation: 'C. Word Segmentation',
  ocr_labeling: 'D. OCR Labeling',
  dataset_cleaning: 'E. Dataset Cleaning',
  hwt_export: 'F. HWT Export',
  finetuning: 'G. Fine-tuning',
  evaluation: 'H. Evaluation',
  ready: 'Ready',
  paused: 'Paused',
  failed: 'Failed',
};

const STAGE_ORDER = [
  'queued',
  'pdf_ingestion',
  'region_extraction',
  'word_segmentation',
  'ocr_labeling',
  'dataset_cleaning',
  'hwt_export',
  'finetuning',
  'evaluation',
  'ready',
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrainingPanel() {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null);
  const [samples, setSamples] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobName, setJobName] = useState('');
  const [epochs, setEpochs] = useState(500);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [generateText, setGenerateText] = useState('');
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [gpuStatus, setGpuStatus] = useState<GpuStatus | null>(null);
  const [pauseLoading, setPauseLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpuPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Fetch jobs ---
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/training/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch {
      // silent
    }
  }, []);

  // --- Fetch GPU status ---
  const fetchGpuStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/training/gpu-status');
      if (res.ok) {
        setGpuStatus(await res.json());
      }
    } catch {
      // silent
    }
  }, []);

  // --- Fetch single job ---
  const fetchJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/training/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedJob(data);
        return data as TrainingJob;
      }
    } catch {
      // silent
    }
    return null;
  }, []);

  // --- Fetch samples ---
  const fetchSamples = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/training/jobs/${jobId}/samples`);
      if (res.ok) {
        const data = await res.json();
        setSamples(data);
      }
    } catch {
      // silent
    }
  }, []);

  // --- Poll selected job ---
  useEffect(() => {
    fetchJobs();
    fetchGpuStatus();

    // On mount, check if any job was paused (e.g. after server restart)
    // and auto-detect interrupted finetuning jobs
    fetch('/api/training/jobs')
      .then((r) => r.ok ? r.json() : [])
      .then((allJobs: TrainingJob[]) => {
        // Mark any job that was 'finetuning' but server restarted as paused
        // (handled server-side, but refresh the list)
        setJobs(allJobs);
      })
      .catch(() => {});
  }, [fetchJobs, fetchGpuStatus]);

  // --- GPU polling (every 5s when a job is active) ---
  useEffect(() => {
    const isActive = selectedJob && !['ready', 'failed', 'paused'].includes(selectedJob.stage);
    if (!isActive) {
      if (gpuPollRef.current) clearInterval(gpuPollRef.current);
      gpuPollRef.current = null;
      return;
    }
    fetchGpuStatus();
    gpuPollRef.current = setInterval(fetchGpuStatus, 5000);
    return () => {
      if (gpuPollRef.current) clearInterval(gpuPollRef.current);
    };
  }, [selectedJob?.job_id, selectedJob?.stage, fetchGpuStatus]);

  useEffect(() => {
    if (!selectedJob) return;
    const isActive = !['ready', 'failed', 'paused'].includes(selectedJob.stage);
    if (!isActive) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = () => {
      fetchJob(selectedJob.job_id).then((j) => {
        if (j) fetchSamples(j.job_id);
      });
    };
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedJob?.job_id, selectedJob?.stage, fetchJob, fetchSamples]);

  // --- Create job ---
  const createJob = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', pdfFile);
    if (jobName.trim()) formData.append('name', jobName.trim());
    formData.append('epochs', String(epochs));

    try {
      const res = await fetch('/api/training/jobs', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Failed to create job.');

      setPdfFile(null);
      setJobName('');
      await fetchJobs();
      const job = await fetchJob(data.job_id);
      if (job) {
        setSelectedJob(job);
        fetchSamples(job.job_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job.');
    } finally {
      setUploading(false);
    }
  };

  // --- Generate from model ---
  const generateFromModel = async () => {
    if (!selectedJob || !generateText.trim()) return;
    setGenerating(true);
    setGenerateResult(null);

    const formData = new FormData();
    formData.append('text', generateText);
    formData.append('job_id', selectedJob.job_id);

    try {
      const res = await fetch('/api/generate-from-model', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Generation failed.' }));
        throw new Error(body.error ?? body.detail ?? 'Generation failed.');
      }
      const blob = await res.blob();
      setGenerateResult(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  // --- Select a job ---
  const selectJob = async (job: TrainingJob) => {
    setSelectedJob(job);
    setGenerateResult(null);
    setGenerateText('');
    await fetchJob(job.job_id);
    await fetchSamples(job.job_id);
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
        <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-widest text-stone-500">
          Start a training job
        </h3>
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
            <label className="block font-sans text-xs text-stone-500">Job name</label>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="My handwriting"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
          <div className="space-y-2">
            <label className="block font-sans text-xs text-stone-500">Epochs <span className="text-stone-400">(recommended: 200+)</span></label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={epochs}
                min={50}
                max={10000}
                onChange={(e) => setEpochs(Math.max(50, Number(e.target.value)))}
                className="w-24 rounded-lg border border-stone-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
              <button
                onClick={createJob}
                disabled={!pdfFile || uploading}
                className="rounded-lg bg-stone-800 px-4 py-2 text-xs font-medium text-white shadow transition-colors hover:bg-stone-900 disabled:opacity-40"
              >
                {uploading ? 'Uploading...' : 'Train'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---- Jobs List ---- */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-widest text-stone-500">
            Training jobs
          </h3>
          <button onClick={fetchJobs} className="mb-3 text-xs text-stone-400 underline hover:text-stone-600">
            Refresh
          </button>
          {jobs.length === 0 ? (
            <p className="text-xs text-stone-400">No training jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => (
                <button
                  key={j.job_id}
                  onClick={() => selectJob(j)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedJob?.job_id === j.job_id
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <p className="text-xs font-medium truncate">{j.name}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        j.stage === 'ready'
                          ? 'bg-green-500'
                          : j.stage === 'failed'
                            ? 'bg-red-500'
                            : j.stage === 'paused'
                              ? 'bg-blue-500'
                              : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    <span className={selectedJob?.job_id === j.job_id ? 'text-stone-300' : 'text-stone-400'}>
                      {STAGE_LABELS[j.stage] ?? j.stage}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---- Job Detail ---- */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          {!selectedJob ? (
            <p className="text-center text-sm text-stone-400 py-10">
              Select a job to view progress
            </p>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-sans text-base font-semibold text-stone-800">
                    {selectedJob.name}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {selectedJob.pdf_filename} &middot; {formatDate(selectedJob.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      selectedJob.stage === 'ready'
                        ? 'bg-green-100 text-green-700'
                        : selectedJob.stage === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : selectedJob.stage === 'paused'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {STAGE_LABELS[selectedJob.stage] ?? selectedJob.stage}
                  </span>
                  {selectedJob.stage !== 'finetuning' && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete job "${selectedJob.name}"? This cannot be undone.`)) return;
                        try {
                          const res = await fetch(`/api/training/jobs/${selectedJob.job_id}`, { method: 'DELETE' });
                          if (!res.ok) {
                            const body = await res.json().catch(() => ({ error: 'Delete failed.' }));
                            setError(body.error ?? 'Delete failed.');
                            return;
                          }
                          setSelectedJob(null);
                          setSamples([]);
                          await fetchJobs();
                        } catch { setError('Cannot reach service.'); }
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100"
                      title="Delete this job"
                    >
                      ✕ Delete
                    </button>
                  )}
                </div>
              </div>

              {/* GPU Status */}
              {gpuStatus && (
                <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
                  gpuStatus.gpu_available
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    gpuStatus.gpu_available ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  {gpuStatus.gpu_available ? (
                    <>
                      <span className="font-medium text-emerald-800">
                        GPU: {gpuStatus.device_name}
                      </span>
                      <span className="text-emerald-600">
                        VRAM: {gpuStatus.vram_used_gb ?? '?'} / {gpuStatus.vram_total_gb ?? '?'} GB
                        ({gpuStatus.vram_used_pct ?? 0}%)
                      </span>
                      {gpuStatus.gpu_utilization_pct != null && (
                        <span className="text-emerald-600">
                          Load: {gpuStatus.gpu_utilization_pct}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-medium text-red-700">GPU not available — using CPU</span>
                  )}
                </div>
              )}

              {/* Error */}
              {selectedJob.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {selectedJob.error}
                </div>
              )}

              {/* Progress pipeline */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                  Pipeline progress
                </p>
                <div className="space-y-1.5">
                  {STAGE_ORDER.map((s) => {
                    const sr = selectedJob.stage_results[s];
                    const isCurrent = selectedJob.stage === s;
                    let statusColor = 'text-stone-400';
                    let bgColor = 'bg-stone-50';
                    let barColor = 'bg-stone-300';
                    let progress = 0;

                    if (sr?.status === 'done' || (s === 'ready' && selectedJob.stage === 'ready')) {
                      statusColor = 'text-green-700';
                      bgColor = 'bg-green-50';
                      barColor = 'bg-green-500';
                      progress = 100;
                    } else if (sr?.status === 'running' || isCurrent) {
                      statusColor = 'text-amber-700';
                      bgColor = 'bg-amber-50';
                      barColor = 'bg-amber-500';
                      progress = sr?.progress ?? 0;
                    } else if (sr?.status === 'paused') {
                      statusColor = 'text-blue-700';
                      bgColor = 'bg-blue-50';
                      barColor = 'bg-blue-500';
                      progress = sr?.progress ?? 0;
                    } else if (sr?.status === 'failed') {
                      statusColor = 'text-red-700';
                      bgColor = 'bg-red-50';
                      barColor = 'bg-red-500';
                      progress = sr?.progress ?? 0;
                    }

                    return (
                      <div key={s} className={`rounded-lg px-3 py-1.5 ${bgColor}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-medium ${statusColor}`}>
                            {STAGE_LABELS[s] ?? s}
                            {(sr?.status === 'running' || isCurrent) && sr?.status !== 'done' && sr?.status !== 'paused' && (
                              <span className="ml-1 animate-pulse">●</span>
                            )}
                            {sr?.status === 'paused' && (
                              <span className="ml-1">⏸</span>
                            )}
                          </span>
                          <span className={`text-[10px] ${statusColor}`}>
                            {sr?.status === 'done'
                              ? `✓ ${sr.duration_s != null ? formatDuration(sr.duration_s) : ''}`
                              : sr?.status === 'running'
                                ? `${Math.round(progress)}%`
                                : sr?.status === 'paused'
                                  ? `⏸ ${Math.round(progress)}%`
                                  : sr?.status === 'failed'
                                    ? '✗'
                                    : ''}
                          </span>
                        </div>
                        {(sr?.status === 'running' || sr?.status === 'done' || sr?.status === 'failed' || sr?.status === 'paused') && (
                          <div className="mt-1 h-1.5 w-full rounded-full bg-white/60">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                        {sr?.message && sr.status === 'running' && (
                          <p className="mt-0.5 text-[10px] text-stone-500 truncate">{sr.message}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Pages', selectedJob.pdf_pages],
                  ['Regions', selectedJob.total_regions],
                  ['Words', selectedJob.total_words],
                  ['Clean', selectedJob.clean_words],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-stone-50 p-3 text-center">
                    <p className="text-lg font-semibold text-stone-800">{value}</p>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Training progress */}
              {(selectedJob.stage === 'finetuning' || selectedJob.stage === 'paused' || selectedJob.training_epoch > 0) && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                      Training
                    </p>
                    <div className="flex items-center gap-2">
                      {selectedJob.stage === 'finetuning' && (
                        <button
                          onClick={async () => {
                            setPauseLoading(true);
                            try {
                              const res = await fetch(`/api/training/jobs/${selectedJob.job_id}?action=pause`, { method: 'POST' });
                              if (!res.ok) {
                                const body = await res.json().catch(() => ({ error: 'Pause failed.' }));
                                setError(body.error ?? 'Pause failed.');
                              }
                            } catch { setError('Cannot reach service.'); }
                            finally { setPauseLoading(false); }
                          }}
                          disabled={pauseLoading}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-40"
                        >
                          {pauseLoading ? 'Pausing...' : '⏸ Pause'}
                        </button>
                      )}
                      {selectedJob.stage === 'paused' && (
                        <button
                          onClick={async () => {
                            setPauseLoading(true);
                            try {
                              const res = await fetch(`/api/training/jobs/${selectedJob.job_id}?action=resume-training`, { method: 'POST' });
                              if (!res.ok) {
                                const body = await res.json().catch(() => ({ error: 'Resume failed.' }));
                                setError(body.error ?? 'Resume failed.');
                              } else {
                                // Refresh job
                                await fetchJob(selectedJob.job_id);
                              }
                            } catch { setError('Cannot reach service.'); }
                            finally { setPauseLoading(false); }
                          }}
                          disabled={pauseLoading}
                          className="rounded-lg border border-green-300 bg-green-50 px-3 py-1 text-[11px] font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-40"
                        >
                          {pauseLoading ? 'Resuming...' : '▶ Resume'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-full bg-stone-100 h-2">
                      <div
                        className="h-2 rounded-full bg-stone-700 transition-all"
                        style={{
                          width: `${
                            selectedJob.training_epochs_target > 0
                              ? Math.min(
                                  100,
                                  (selectedJob.training_epoch / selectedJob.training_epochs_target) * 100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-stone-500">
                      {selectedJob.training_epoch} / {selectedJob.training_epochs_target} epochs
                    </span>
                  </div>
                  {selectedJob.training_loss > 0 && (
                    <p className="text-[10px] text-stone-400">
                      Loss: {selectedJob.training_loss.toFixed(4)}
                    </p>
                  )}
                  {/* Edit epochs — only when paused, ready, or failed */}
                  {['paused', 'ready', 'failed'].includes(selectedJob.stage) && (
                    <div className="flex items-center gap-2 mt-1">
                      <label className="text-[11px] text-stone-500">Target epochs:</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        defaultValue={selectedJob.training_epochs_target}
                        className="w-20 rounded border border-stone-200 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300"
                        onBlur={async (e) => {
                          const val = Number(e.target.value);
                          if (!val || val === selectedJob.training_epochs_target) return;
                          const fd = new FormData();
                          fd.append('epochs', String(val));
                          try {
                            const res = await fetch(`/api/training/jobs/${selectedJob.job_id}`, { method: 'PATCH', body: fd });
                            if (res.ok) { await fetchJob(selectedJob.job_id); }
                            else {
                              const body = await res.json().catch(() => ({ error: 'Update failed.' }));
                              setError(body.error ?? 'Update failed.');
                            }
                          } catch { setError('Cannot reach service.'); }
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Samples gallery */}
              {samples.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                    Samples ({samples.length})
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {samples.map((filename) => (
                      <div key={filename} className="rounded-lg bg-stone-50 p-2">
                        <p className="mb-1 text-[10px] text-stone-400 truncate">{filename}</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/training/jobs/${selectedJob.job_id}/samples/${encodeURIComponent(filename)}`}
                          alt={filename}
                          className="w-full rounded bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate from model */}
              {selectedJob.stage === 'ready' && (
                <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-green-700">
                    Generate with this model
                  </p>
                  <textarea
                    value={generateText}
                    onChange={(e) => setGenerateText(e.target.value)}
                    placeholder="Type the text to render in this handwriting style..."
                    className="h-20 w-full resize-none rounded-lg border border-green-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                  <button
                    onClick={generateFromModel}
                    disabled={!generateText.trim() || generating}
                    className="rounded-lg bg-green-700 px-4 py-2 text-xs font-medium text-white shadow hover:bg-green-800 disabled:opacity-40"
                  >
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                  {generateResult && (
                    <div className="rounded-lg bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={generateResult} alt="Generated handwriting" className="w-full" />
                    </div>
                  )}
                </div>
              )}

              {/* Stage details */}
              {Object.keys(selectedJob.stage_results).length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium uppercase tracking-widest text-stone-400">
                    Stage details
                  </summary>
                  <div className="mt-2 space-y-1">
                    {Object.entries(selectedJob.stage_results).map(([key, sr]) => (
                      <div key={key} className="flex gap-2 rounded bg-stone-50 px-2 py-1">
                        <span className="font-medium text-stone-600 w-40 truncate">
                          {STAGE_LABELS[key] ?? key}
                        </span>
                        <span className={
                          sr.status === 'done' ? 'text-green-600'
                            : sr.status === 'running' ? 'text-amber-600'
                            : sr.status === 'failed' ? 'text-red-600'
                            : 'text-stone-400'
                        }>
                          {sr.status}
                        </span>
                        {sr.duration_s != null && (
                          <span className="text-stone-400">{formatDuration(sr.duration_s)}</span>
                        )}
                        <span className="text-stone-400 truncate flex-1">{sr.message}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
