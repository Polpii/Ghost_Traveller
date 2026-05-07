'use client';

import { useState, type CSSProperties } from 'react';
import GhostForm, { type GhostInputs } from './components/GhostForm';
import GhostPostcard, { type GhostCardData } from './components/GhostPostcard';
import HandwritingCapture, { type HandwritingEngine } from './components/HandwritingCapture';
import { useIsMobile } from './hooks/useIsMobile';

type Step = 'welcome' | 'intro' | 'questions' | 'handwriting' | 'generating' | 'card';

const EMPTY: GhostInputs = {
  city: '',
  place: '',
  interests: [],
  customInterest: '',
  sensation: '',
  customSensation: '',
  need: '',
  customNeed: '',
  divergence: '',
  customDivergence: '',
  name: '',
};

const PROMPTED_SENTENCE = 'Dear ghost traveller, how are you?';

// ── Inline-styled buttons (bulletproof against Tailwind v4 arbitrary-color quirks) ──
const PRIMARY_BTN_STYLE: CSSProperties = {
  backgroundColor: '#7c1418',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '15px',
  padding: '12px 32px',
  borderRadius: '9999px',
  border: 'none',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  textAlign: 'center',
  lineHeight: 1.25,
};

const PRIMARY_BTN_DISABLED_STYLE: CSSProperties = {
  ...PRIMARY_BTN_STYLE,
  backgroundColor: '#b08a8c',
  cursor: 'not-allowed',
  boxShadow: 'none',
};

const SECONDARY_BTN_STYLE: CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#1f1f1f',
  fontWeight: 500,
  fontSize: '14px',
  padding: '10px 24px',
  borderRadius: '9999px',
  border: '1.5px solid #6b6b6b',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
};

function PrimaryButton({
  children,
  disabled,
  onClick,
  style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  style?: CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const base = disabled ? PRIMARY_BTN_DISABLED_STYLE : PRIMARY_BTN_STYLE;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...base,
        ...(hover && !disabled ? { backgroundColor: '#5e0f12' } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...SECONDARY_BTN_STYLE,
        ...(hover ? { backgroundColor: '#f0eee9' } : {}),
      }}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<Step>('welcome');
  const [inputs, setInputs] = useState<GhostInputs>(EMPTY);
  const [handwritingFile, setHandwritingFile] = useState<File | null>(null);
  const [engine, setEngine] = useState<HandwritingEngine>('cursive');
  const [cardData, setCardData] = useState<GhostCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');

  // Resolved values: free text overrides chip selection if provided
  const resolvedSensation = inputs.customSensation.trim() || inputs.sensation;
  const resolvedNeed = inputs.customNeed.trim() || inputs.need;
  const resolvedDivergence = inputs.customDivergence.trim() || inputs.divergence;
  const resolvedInterests = inputs.customInterest.trim()
    ? [...inputs.interests, inputs.customInterest.trim()]
    : inputs.interests;

  const isFormValid =
    inputs.city.trim().length > 0 &&
    inputs.name.trim().length > 0 &&
    resolvedSensation.length > 0 &&
    resolvedNeed.length > 0;

  const generate = async () => {
    setError(null);
    setStep('generating');

    try {
      // 0. If user provided handwriting, convert it to base64 so GPT can OCR it
      let handwritingDataUrl: string | null = null;
      if (handwritingFile) {
        setProgressMsg('Reading your handwritten note...');
        handwritingDataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error('Failed to read handwriting file'));
          r.readAsDataURL(handwritingFile);
        });
      }

      // 1. Generate the GPT message (with OCR if image was sent)
      setProgressMsg('Composing the message...');
      const msgRes = await fetch('/api/ghost-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: inputs.city,
          place: inputs.place,
          interests: resolvedInterests,
          sensation: resolvedSensation,
          need: resolvedNeed,
          divergence: resolvedDivergence,
          name: inputs.name,
          handwritingDataUrl,
        }),
      });
      const msgData = (await msgRes.json()) as {
        message?: string;
        error?: string;
        handwrittenNote?: string | null;
      };
      if (!msgRes.ok || !msgData.message) {
        throw new Error(msgData.error ?? 'Failed to generate message');
      }
      const message = msgData.message;
      if (msgData.handwrittenNote) {
        console.info('[OCR] User wrote:', msgData.handwrittenNote);
      }

      // 2. Render in handwriting if a sample is provided
      let handwritingImageUrl: string | null = null;
      if (handwritingFile && engine !== 'cursive') {
        try {
          setProgressMsg(
            engine === 'diffusionpen'
              ? 'Painting your handwriting (DiffusionPen)...'
              : 'Tracing your handwriting (HWT)...',
          );
          const fd = new FormData();
          fd.append('text', message);
          fd.append('style_images', handwritingFile);

          const endpoint =
            engine === 'diffusionpen' ? '/api/generate-diffusionpen' : '/api/generate-handwriting';
          const hwRes = await fetch(endpoint, { method: 'POST', body: fd });

          if (hwRes.ok) {
            const blob = await hwRes.blob();
            handwritingImageUrl = URL.createObjectURL(blob);
          } else {
            const errBody = await hwRes.json().catch(() => ({}));
            console.warn('Handwriting render failed, using fallback:', errBody);
          }
        } catch (hwErr) {
          console.warn('Handwriting service unreachable, using fallback:', hwErr);
        }
      }

      setCardData({
        city: inputs.city,
        place: inputs.place,
        message,
        date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-').slice(0, 8),
        handwritingImageUrl,
      });
      setStep('card');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setStep('handwriting');
    } finally {
      setProgressMsg('');
    }
  };

  const reset = () => {
    setStep('welcome');
    setInputs(EMPTY);
    setHandwritingFile(null);
    setEngine('hwt');
    setCardData(null);
    setError(null);
  };

  const downloadPng = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-ghost-card] canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    const safe = inputs.city.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'ghost';
    a.download = `ghost-postcard-${safe}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        overflowX: 'hidden',
        overflowY: isMobile ? 'auto' : 'hidden',
        height: isMobile ? 'auto' : '100vh',
        backgroundColor: '#f3f3f3',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'center',
        padding: isMobile ? '24px 16px 40px' : '12px',
        boxSizing: 'border-box',
      }}
    >
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '10px 16px',
            borderRadius: 12,
            fontSize: 14,
            border: '1px solid #fecaca',
            maxWidth: 480,
          }}
        >
          {error}
        </div>
      )}

      {/* ── 1. Welcome (PERFECTLY centered) ────────────────────────── */}
      {step === 'welcome' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 48 : 80, marginTop: isMobile ? '30vh' : 0 }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 400,
              color: '#1a1a1a',
              textAlign: 'center',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Welcome to Ghost Traveller
          </h1>
          <PrimaryButton onClick={() => setStep('intro')}>Start Your Journey</PrimaryButton>
        </div>
      )}

      {/* ── 2. Intro ───────────────────────────────────────────────── */}
      {step === 'intro' && (
        <div style={{ maxWidth: 640, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 24 : 40, marginTop: isMobile ? 24 : 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(15px, 1.6vw, 18px)',
              lineHeight: 1.55,
              color: '#1f1f1f',
            }}
          >
            <p style={{ marginBottom: 16 }}>
              Your Ghost Traveller didn&apos;t just keep your memories, but kept growing.
            </p>
            <p style={{ marginBottom: 16 }}>
              They have continued along the path you once left behind, noticing new details,
              collecting small moments, and carrying the feelings you may have forgotten.
            </p>
            <p style={{ marginBottom: 16 }}>
              Now they are writing back, to remind you of something you might need to hear right now.
            </p>
            <p>
              The interaction is designed around 3 main questions that can be completed in under 2 minutes.
              You will receive a printed postcard: a physical artifact from a parallel universe, written back to you.
            </p>
          </div>
          <PrimaryButton onClick={() => setStep('questions')}>
            Receive a Postcard from
            <br />
            your Ghost
          </PrimaryButton>
        </div>
      )}

      {/* ── 3. Questions ───────────────────────────────────────────── */}
      {step === 'questions' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
            maxWidth: 1200,
            ...(isMobile ? { paddingTop: 16 } : { height: '100%', justifyContent: 'center' }),
          }}
        >
          <GhostForm values={inputs} onChange={setInputs} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexShrink: 0 }}>
            <SecondaryButton onClick={() => setStep('intro')}>Back</SecondaryButton>
            <PrimaryButton onClick={() => setStep('handwriting')} disabled={!isFormValid}>
              Continue
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── 4. Handwriting ─────────────────────────────────────────── */}
      {step === 'handwriting' && (
        <div
          style={{
            width: '100%',
            maxWidth: 720,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            marginTop: isMobile ? 24 : 0,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(26px, 3.5vw, 38px)',
              fontWeight: 400,
              color: '#1a1a1a',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Please Write One Sentence by Hand.
          </h2>

          <HandwritingCapture
            prompt={PROMPTED_SENTENCE}
            engine={engine}
            onEngineChange={setEngine}
            onCapture={setHandwritingFile}
          />

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <SecondaryButton onClick={() => setStep('questions')}>Back</SecondaryButton>
            <PrimaryButton onClick={generate} disabled={!handwritingFile}>
              Send
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── 5. Generating ──────────────────────────────────────────── */}
      {step === 'generating' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60, textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 400,
              color: '#1a1a1a',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Your Ghost Traveller is writing to you...
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: '#7c1418',
                    animation: `bounce 1.4s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
            {progressMsg && (
              <p style={{ fontSize: 13, color: '#6b6b6b', margin: 0 }}>{progressMsg}</p>
            )}
            <style>{`
              @keyframes bounce {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
                40% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* ── 6. Postcard ────────────────────────────────────────────── */}
      {step === 'card' && cardData && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            width: '100%',
            maxWidth: 1280,
            ...(isMobile ? { paddingTop: 16 } : { height: '100%', justifyContent: 'center' }),
          }}
        >
          <div
            data-ghost-card
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              ...(isMobile ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } : {}),
            }}
          >
            <GhostPostcard data={cardData} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            <PrimaryButton onClick={downloadPng}>Download .png</PrimaryButton>
            <SecondaryButton onClick={reset}>Start over</SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
