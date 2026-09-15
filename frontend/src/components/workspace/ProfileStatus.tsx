import { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import {
  generateProfile,
  getProfileStatus,
  createProfileEventSource,
  deleteProfile,
} from '../../services/api';
import ProfileViewer from './ProfileViewer';

interface ProfileStatusProps {
  workspaceId: string;
  connectionId: string;
  connectionName: string;
}

type Status = 'none' | 'generating' | 'ready' | 'failed' | 'checking';

export default function ProfileStatus({
  workspaceId,
  connectionId,
  connectionName,
}: ProfileStatusProps) {
  const [status, setStatus] = useState<Status>('checking');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const checkedRef = useRef('');

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop any active polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Start polling when profile is generating (handles Cloud Run multi-instance + page navigation)
  const startPolling = useCallback(() => {
    stopPolling();
    setStatus('generating');
    setProgress('Generating data intelligence profile...');

    pollingRef.current = setInterval(() => {
      getProfileStatus(workspaceId, connectionId)
        .then((res) => {
          if (res.status === 'ready') {
            setStatus('ready');
            setProgress('');
            stopPolling();
          } else if (res.status === 'failed') {
            setStatus('failed');
            setError(res.error_message || 'Profile generation failed');
            stopPolling();
          }
          // else still generating — keep polling
        })
        .catch(() => { /* keep polling */ });
    }, 4000); // Poll every 4 seconds
  }, [workspaceId, connectionId, stopPolling]);

  // Check profile status on mount / connection change
  useEffect(() => {
    if (!workspaceId || !connectionId || connectionId === 'mock') return;
    // Avoid re-checking same connection
    const key = `${workspaceId}:${connectionId}`;
    if (checkedRef.current === key) return;
    checkedRef.current = key;

    setStatus('checking');
    getProfileStatus(workspaceId, connectionId)
      .then((res) => {
        const s = res.status as Status;
        if (s === 'ready' || s === 'failed') {
          setStatus(s);
          if (s === 'failed') setError(res.error_message || 'Unknown error');
        } else if (s === 'generating') {
          // Profile is being generated (likely triggered during workspace creation).
          // Start polling since the SSE queue may be on a different instance.
          startPolling();
        } else {
          setStatus('none');
        }
      })
      .catch(() => {
        setStatus('none');
      });

    return () => {
      stopPolling();
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [workspaceId, connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerGenerate = useCallback(async () => {
    if (!workspaceId || !connectionId) return;

    setStatus('generating');
    setProgress('Starting data analysis...');
    setError('');

    try {
      await generateProfile(workspaceId, connectionId);

      // Listen to SSE progress
      if (esRef.current) esRef.current.close();
      const es = createProfileEventSource(workspaceId, connectionId);
      esRef.current = es;

      es.addEventListener('thinking', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setProgress(data.content || data.step || '');
        } catch { /* ignore */ }
      });

      es.addEventListener('done', () => {
        setStatus('ready');
        setProgress('');
        stopPolling();
        es.close();
        esRef.current = null;
      });

      es.addEventListener('error', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setError(data.message || 'Profile generation failed');
        } catch { /* ignore */ }
        setStatus('failed');
        stopPolling();
        es.close();
        esRef.current = null;
      });

      es.onerror = () => {
        // SSE connection lost — fall back to polling
        es.close();
        esRef.current = null;
        startPolling();
      };
    } catch {
      // POST to generate might have succeeded even if SSE failed.
      // Fall back to polling to check.
      startPolling();
    }
  }, [workspaceId, connectionId, startPolling]);

  const handleRefresh = useCallback(async () => {
    try {
      await deleteProfile(workspaceId, connectionId);
    } catch { /* ignore */ }
    checkedRef.current = ''; // Reset so it re-checks
    triggerGenerate();
  }, [workspaceId, connectionId, triggerGenerate]);

  if (connectionId === 'mock' || status === 'checking') {
    return null;
  }

  const statusTone: Record<Status, string> = {
    none: 'bg-navy-50 text-navy-700 ring-navy-200 hover:bg-navy-100',
    checking: 'bg-navy-50 text-navy-600 ring-navy-200',
    generating: 'bg-accent-50 text-accent-700 ring-accent-200',
    ready: 'bg-success-50 text-success-700 ring-success-500/25 hover:bg-emerald-100',
    failed: 'bg-danger-50 text-danger-700 ring-danger-500/25',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${statusTone[status]}`}
    >
      {status === 'none' && (
        <button
          type="button"
          onClick={triggerGenerate}
          className="inline-flex items-center gap-1.5"
          title="Generate data intelligence profile"
        >
          <Brain className="h-3.5 w-3.5" />
          <span>Generate profile</span>
        </button>
      )}

      {status === 'generating' && (
        <>
          <Loader2 className="is-spinner h-3.5 w-3.5" />
          <span className="truncate max-w-[240px]">
            {progress || 'Analyzing data…'}
          </span>
        </>
      )}

      {status === 'ready' && (
        <>
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="inline-flex items-center gap-1.5"
            title="View data profile"
          >
            <Brain className="h-3.5 w-3.5" />
            <span>Data profiled</span>
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            title="Re-analyze data"
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-md hover:bg-success-500/20"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </>
      )}

      {status === 'failed' && (
        <>
          <AlertCircle className="h-3.5 w-3.5" />
          <span title={error}>Profile failed</span>
          <button
            type="button"
            onClick={handleRefresh}
            title="Retry"
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-md hover:bg-danger-500/20"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </>
      )}

      <ProfileViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        workspaceId={workspaceId}
        connectionId={connectionId}
        connectionName={connectionName}
      />
    </div>
  );
}
