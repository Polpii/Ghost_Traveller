'use client';

import { useState, type CSSProperties } from 'react';
import GhostPostcard, { type GhostCardData } from './components/GhostPostcard';
import HandwritingCapture, { type HandwritingEngine } from './components/HandwritingCapture';
import { useIsMobile } from './hooks/useIsMobile';

// ─── Step machine ────────────────────────────────────────────────────────────
type Step =
  | 'welcome'
  | 'intro'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'q5'
  | 'handwriting'
  | 'generating'
  | 'card';

// ─── Form state ──────────────────────────────────────────────────────────────
interface GhostInputs {
  city: string;
  place: string;
  interests: string[];
  customInterest: string;
  sensation: string;
  customSensation: string;
  need: string;
  customNeed: string;
  divergence: string;
  customDivergence: string;
  name: string;
}

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

// ─── Theme constants ─────────────────────────────────────────────────────────
const C = {
  bg: '#EAD9BC',
  bgAlt: '#E8D5B7',
  paper: '#F4ECD8',
  ink: '#3A1A06',
  sepia: '#5C2E0A',
  sepiaSoft: '#6B4422',
  gold: '#9B6E3A',
  goldLight: '#B8905A',
  red: '#8B1A1A',
  redDeep: '#6e1414',
  rule: 'rgba(155, 110, 58, 0.4)',
  ruleSoft: 'rgba(155, 110, 58, 0.22)',
};

const F = {
  display: "var(--font-display), 'Playfair Display', Georgia, serif",
  serif: "var(--font-serif), 'Cormorant Garamond', Georgia, serif",
  hand: "var(--font-hand), 'Klee One', cursive",
};

const PROMPTED_SENTENCE = 'Dear ghost traveller, how are you?';

// ─── Option lists ────────────────────────────────────────────────────────────
const INTERESTS = [
  'Art & museums',
  'Nightlife',
  'Street food',
  'Nature & hiking',
  'Local culture',
  'Architecture',
  'Music',
  'Adventure sports',
];

const SENSATIONS = [
  'The cold & stillness',
  'Warm strangers',
  'Being nobody',
  'Wild landscapes',
  'Street sounds & chaos',
  'Slow mornings',
  'Walking alone at night',
  'The taste of something new',
];

const NEEDS = [
  'Courage to make a change',
  'Permission to slow down',
  'A reminder of who I am',
  'Comfort in uncertainty',
];

const DIVERGENCES = [
  'Stayed instead of leaving',
  'Said yes when I said no',
  'Kept the door open',
  'Followed the stranger\u2019s voice',
  'Took the slower road',
  'Trusted the silence',
];

// ─── Shared UI atoms ─────────────────────────────────────────────────────────
function WaxSeal({
  children,
  onClick,
  size = 82,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1.07)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 38% 32%, #c0382b 0%, #8B1A1A 52%, #4a0e0e 100%)',
        border: '2px solid #6e1414',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow:
          'inset 0 2px 5px rgba(255,180,160,.15), inset 0 -2px 7px rgba(0,0,0,.45), 0 3px 12px rgba(0,0,0,.25)',
        transition: 'transform .15s',
        position: 'relative',
        padding: 0,
        fontFamily: F.hand,
        color: '#f5dfc8',
        textAlign: 'center',
        lineHeight: 1.5,
        letterSpacing: '0.04em',
        fontSize: Math.round(size * 0.115),
      }}
    >
      <span style={{ position: 'relative', zIndex: 1, opacity: 0.92 }}>{children}</span>
    </button>
  );
}

function NextButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: F.serif,
        fontSize: 13,
        letterSpacing: '0.14em',
        color: disabled ? C.goldLight : C.ink,
        textTransform: 'uppercase',
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${C.rule}`,
        padding: '6px 0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: hover && !disabled ? 14 : 8,
        transition: 'gap 0.2s, color 0.2s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: F.serif,
        fontSize: 12,
        letterSpacing: '0.14em',
        color: C.gold,
        textTransform: 'uppercase',
        background: 'transparent',
        border: 'none',
        padding: '6px 0',
        cursor: 'pointer',
      }}
    >
      ← Back
    </button>
  );
}

function Pill({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: F.hand,
        fontSize: 13,
        color: selected ? '#F5E8D0' : C.sepia,
        border: `1px solid ${selected ? C.sepia : C.rule}`,
        padding: '7px 16px',
        borderRadius: 20,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: selected ? C.sepia : 'transparent',
        transition: 'all .18s',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function ProgressDots({ active, total = 5 }: { active: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 'clamp(16px, 3vh, 32px)' }}>
      {Array.from({ length: total }).map((_, i) => {
        const state = i < active ? 'done' : i === active ? 'active' : 'idle';
        return (
          <div
            key={i}
            style={{
              width: 32,
              height: 2,
              background:
                state === 'active' ? C.ink : state === 'done' ? C.gold : 'rgba(92,46,10,.2)',
              borderRadius: 2,
              transition: 'background .3s',
            }}
          />
        );
      })}
    </div>
  );
}

function QuestionShell({
  children,
  progressIndex,
  onBack,
}: {
  children: React.ReactNode;
  progressIndex: number;
  onBack?: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        background: C.bg,
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(20px, 4vh, 48px) clamp(16px, 4vw, 24px)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column' }}>
        <ProgressDots active={progressIndex} />
        {children}
        {onBack && (
          <div style={{ marginTop: 16 }}>
            <BackLink onClick={onBack} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Field helpers ───────────────────────────────────────────────────────────
const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontFamily: F.serif,
  fontSize: 10,
  letterSpacing: '0.22em',
  color: C.gold,
  textTransform: 'uppercase',
  marginBottom: 8,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${C.rule}`,
  padding: '8px 2px',
  fontFamily: F.hand,
  fontSize: 14,
  color: C.ink,
  outline: 'none',
};

const qNum: CSSProperties = {
  fontFamily: F.serif,
  fontSize: 11,
  letterSpacing: '0.22em',
  color: C.gold,
  textTransform: 'uppercase',
  marginBottom: 8,
};

const qTitle: CSSProperties = {
  fontFamily: F.display,
  fontSize: 'clamp(20px, 2.6vw, 30px)',
  fontWeight: 400,
  color: C.ink,
  marginBottom: 4,
  lineHeight: 1.2,
};

const qSub: CSSProperties = {
  fontFamily: F.serif,
  fontSize: 14,
  color: C.gold,
  fontStyle: 'italic',
  marginBottom: 'clamp(14px, 2.5vh, 24px)',
};

const qHint: CSSProperties = {
  fontFamily: F.serif,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: C.gold,
  textTransform: 'uppercase',
  marginBottom: 10,
  opacity: 0.85,
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function Home() {
  const isMobile = useIsMobile(900);
  const [step, setStep] = useState<Step>('welcome');
  const [inputs, setInputs] = useState<GhostInputs>(EMPTY);
  const [handwritingFile, setHandwritingFile] = useState<File | null>(null);
  const [engine, setEngine] = useState<HandwritingEngine>('cursive');
  const [cardData, setCardData] = useState<GhostCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const set = (patch: Partial<GhostInputs>) => setInputs((prev) => ({ ...prev, ...patch }));

  const toggleInterest = (item: string) => {
    const has = inputs.interests.includes(item);
    if (has) set({ interests: inputs.interests.filter((i) => i !== item) });
    else if (inputs.interests.length < 3) set({ interests: [...inputs.interests, item] });
  };

  const resolvedSensation = inputs.customSensation.trim() || inputs.sensation;
  const resolvedNeed = inputs.customNeed.trim() || inputs.need;
  const resolvedDivergence = inputs.customDivergence.trim() || inputs.divergence;
  const resolvedInterests = inputs.customInterest.trim()
    ? [...inputs.interests, inputs.customInterest.trim()]
    : inputs.interests;

  const canQ1 = inputs.city.trim().length > 0;
  const canQ2 = resolvedSensation.length > 0;
  const canQ3 = resolvedNeed.length > 0;
  const canQ4 = resolvedDivergence.length > 0;
  const canQ5 = inputs.name.trim().length > 0;

  const generate = async () => {
    setError(null);
    setStep('generating');

    try {
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

      // Kick off the scene illustration in parallel with the handwriting render
      setProgressMsg('Painting your postcard scene...');
      const sceneReq = fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          city: inputs.city,
          place: inputs.place,
        }),
      })
        .then(async (r) => {
          if (!r.ok) return null;
          const data = (await r.json()) as { imageDataUrl?: string };
          return data.imageDataUrl ?? null;
        })
        .catch(() => null);

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

      const sceneImageUrl = await sceneReq;

      setCardData({
        city: inputs.city,
        place: inputs.place,
        message,
        date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-').slice(0, 8),
        handwritingImageUrl,
        sceneImageUrl,
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
    setEngine('cursive');
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

  const errorBanner = error && (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 14,
        border: '1px solid #fecaca',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 100,
      }}
    >
      {error}
    </div>
  );

  // ── SCREEN 1: WELCOME ─────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <>
        {errorBanner}
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '100dvh',
            background: C.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <svg
            viewBox="0 0 700 520"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}
          >
            <g stroke="#6B3A10" fill="none">
              <line x1="350" y1="260" x2="20" y2="30" strokeWidth="1.1" />
              <line x1="350" y1="260" x2="130" y2="5" strokeWidth=".9" />
              <line x1="350" y1="260" x2="260" y2="0" strokeWidth=".8" />
              <line x1="350" y1="260" x2="400" y2="0" strokeWidth=".8" />
              <line x1="350" y1="260" x2="540" y2="10" strokeWidth=".9" />
              <line x1="350" y1="260" x2="660" y2="60" strokeWidth="1" />
              <line x1="350" y1="260" x2="700" y2="180" strokeWidth="1.1" />
              <line x1="350" y1="260" x2="700" y2="320" strokeWidth="1" />
              <line x1="350" y1="260" x2="660" y2="440" strokeWidth=".9" />
              <line x1="350" y1="260" x2="540" y2="510" strokeWidth=".9" />
              <line x1="350" y1="260" x2="380" y2="520" strokeWidth=".8" />
              <line x1="350" y1="260" x2="220" y2="515" strokeWidth=".9" />
              <line x1="350" y1="260" x2="80" y2="490" strokeWidth=".9" />
              <line x1="350" y1="260" x2="10" y2="400" strokeWidth="1" />
              <line x1="350" y1="260" x2="0" y2="260" strokeWidth="1.1" />
              <line x1="350" y1="260" x2="10" y2="130" strokeWidth="1" />
              <g strokeDasharray="3,5" strokeWidth=".65" opacity=".8">
                <line x1="240" y1="155" x2="185" y2="108" />
                <line x1="185" y1="190" x2="118" y2="182" />
                <line x1="175" y1="235" x2="105" y2="248" />
                <line x1="185" y1="285" x2="108" y2="310" />
                <line x1="210" y1="350" x2="148" y2="395" />
                <line x1="275" y1="410" x2="240" y2="462" />
                <line x1="360" y1="430" x2="360" y2="488" />
                <line x1="430" y1="395" x2="478" y2="448" />
                <line x1="490" y1="330" x2="562" y2="360" />
                <line x1="510" y1="248" x2="584" y2="228" />
                <line x1="472" y1="172" x2="528" y2="130" />
                <line x1="415" y1="118" x2="448" y2="68" />
                <line x1="348" y1="96" x2="348" y2="44" />
                <line x1="278" y1="118" x2="252" y2="66" />
                <line x1="218" y1="152" x2="180" y2="100" />
              </g>
              <circle cx="350" cy="260" r="5" fill="#5C2E0A" stroke="none" />
              <circle
                cx="350"
                cy="260"
                r="12"
                strokeWidth=".8"
                strokeDasharray="2,4"
                opacity=".5"
              />
            </g>
          </svg>

          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 24px',
            }}
          >
            <div
              style={{
                fontFamily: F.serif,
                fontSize: 12,
                letterSpacing: '0.32em',
                color: C.gold,
                textTransform: 'uppercase',
                fontWeight: 300,
                marginBottom: 16,
              }}
            >
              Postcards from elsewhere
            </div>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 'clamp(42px, 6vw, 64px)',
                fontWeight: 400,
                color: C.ink,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1.05,
                marginBottom: 18,
              }}
            >
              Ghost
              <br />
              Traveller
            </div>
            <div
              style={{
                fontFamily: F.serif,
                fontSize: 15,
                color: C.sepiaSoft,
                fontStyle: 'italic',
                fontWeight: 300,
                letterSpacing: '0.14em',
              }}
            >
              Postcards from a parallel universe
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: isMobile ? 24 : 32,
              right: isMobile ? 24 : 40,
            }}
          >
            <WaxSeal size={82} onClick={() => setStep('intro')}>
              Start Your
              <br />
              Journey
            </WaxSeal>
          </div>
        </div>
      </>
    );
  }

  // ── SCREEN 2: INTRO POSTCARD ──────────────────────────────────────────────
  if (step === 'intro') {
    const lines = [
      "Your Ghost Traveller didn't just keep your memories,",
      'but kept growing.',
      'They have continued along the path you once left behind,',
      'noticing new details, collecting small moments,',
      'and carrying the feelings you may have forgotten.',
      'Now they are writing back,',
      'to remind you of something you might need to hear right now.',
    ];
    return (
      <>
        {errorBanner}
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '100dvh',
            background: C.bgAlt,
            display: 'grid',
            placeItems: 'center',
            padding: 'clamp(20px, 3vh, 40px) clamp(16px, 4vw, 32px)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'absolute', top: 16, left: 20 }}>
            <BackLink onClick={() => setStep('welcome')} />
          </div>
          <div
            style={{
              width: 'min(660px, 100%)',
              background: C.paper,
              border: `1px solid ${C.ruleSoft}`,
              boxShadow: '0 4px 40px rgba(60,20,0,.11)',
              padding: 'clamp(28px, 4vh, 48px) clamp(24px, 6vw, 64px) clamp(60px, 8vh, 90px)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontFamily: F.serif,
                fontSize: 9,
                letterSpacing: '0.3em',
                color: C.goldLight,
                textTransform: 'uppercase',
                opacity: 0.6,
                marginBottom: 'clamp(14px, 2.5vh, 32px)',
              }}
            >
              This space for writing messages
            </div>
            <div
              style={{
                fontFamily: F.hand,
                fontSize: 13,
                color: C.sepiaSoft,
                opacity: 0.82,
                width: '100%',
              }}
            >
              {lines.map((line, i) => (
                <span
                  key={i}
                  style={{
                    display: 'block',
                    borderBottom: `1px solid ${C.ruleSoft}`,
                    paddingBottom: 8,
                    marginBottom: 8,
                    lineHeight: 1.45,
                    textAlign: 'center',
                  }}
                >
                  {line}
                </span>
              ))}
            </div>
            <div
              style={{
                fontFamily: F.serif,
                fontSize: 13,
                fontStyle: 'italic',
                color: C.gold,
                opacity: 0.7,
                letterSpacing: '0.08em',
                marginTop: 20,
              }}
            >
              — Ghost Traveller
            </div>
            <div style={{ position: 'absolute', bottom: 20, right: 24 }}>
              <WaxSeal size={64} onClick={() => setStep('q1')}>
                Receive
                <br />
                your
                <br />
                Postcard
              </WaxSeal>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── SCREENS 3-7: QUESTIONS ────────────────────────────────────────────────
  if (step === 'q1') {
    return (
      <>
        {errorBanner}
        <QuestionShell progressIndex={0} onBack={() => setStep('intro')}>
          <div style={qNum}>1 — Where</div>
          <div style={qTitle}>Where is your Ghost Traveller?</div>
          <div style={qSub}>Locate them in the world, then zoom in</div>
          <div style={{ marginBottom: 22 }}>
            <label style={fieldLabelStyle}>City, Country</label>
            <input
              type="text"
              value={inputs.city}
              onChange={(e) => set({ city: e.target.value })}
              placeholder="Tromsø, Norway"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={fieldLabelStyle}>A specific place they keep returning to</label>
            <input
              type="text"
              value={inputs.place}
              onChange={(e) => set({ place: e.target.value })}
              placeholder="A cafe, a park, a rooftop, a trail…"
              style={inputStyle}
            />
          </div>
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
            <NextButton onClick={() => setStep('q2')} disabled={!canQ1}>
              Next →
            </NextButton>
          </div>
        </QuestionShell>
      </>
    );
  }

  if (step === 'q2') {
    return (
      <>
        {errorBanner}
        <QuestionShell progressIndex={1} onBack={() => setStep('q1')}>
          <div style={qNum}>2 — Who</div>
          <div style={qTitle}>Who is your Ghost?</div>
          <div style={qSub}>Shape their personality and what they hold onto</div>

          <div style={qHint}>Pick up to 3 — What do they care about?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {INTERESTS.map((item) => {
              const selected = inputs.interests.includes(item);
              const disabled = !selected && inputs.interests.length >= 3;
              return (
                <Pill
                  key={item}
                  label={item}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => toggleInterest(item)}
                />
              );
            })}
          </div>
          <input
            type="text"
            value={inputs.customInterest}
            onChange={(e) => set({ customInterest: e.target.value })}
            placeholder="Or something else they care about…"
            style={{ ...inputStyle, marginBottom: 24 }}
          />

          <div style={qHint}>Pick one — A feeling they never let go of</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {SENSATIONS.map((item) => (
              <Pill
                key={item}
                label={item}
                selected={inputs.sensation === item}
                onClick={() =>
                  set({
                    sensation: inputs.sensation === item ? '' : item,
                    customSensation: '',
                  })
                }
              />
            ))}
          </div>
          <input
            type="text"
            value={inputs.customSensation}
            onChange={(e) =>
              set({
                customSensation: e.target.value,
                sensation: e.target.value ? '' : inputs.sensation,
              })
            }
            placeholder="Or another feeling they hold onto…"
            style={inputStyle}
          />

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
            <NextButton onClick={() => setStep('q3')} disabled={!canQ2}>
              Next →
            </NextButton>
          </div>
        </QuestionShell>
      </>
    );
  }

  if (step === 'q3') {
    return (
      <>
        {errorBanner}
        <QuestionShell progressIndex={2} onBack={() => setStep('q2')}>
          <div style={qNum}>3 — What you need</div>
          <div style={qTitle}>What do you need to hear right now?</div>
          <div style={qSub}>Your Ghost has something to tell you</div>
          <div style={qHint}>Pick one</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {NEEDS.map((item) => (
              <Pill
                key={item}
                label={item}
                selected={inputs.need === item}
                onClick={() =>
                  set({
                    need: inputs.need === item ? '' : item,
                    customNeed: '',
                  })
                }
              />
            ))}
          </div>
          <input
            type="text"
            value={inputs.customNeed}
            onChange={(e) =>
              set({
                customNeed: e.target.value,
                need: e.target.value ? '' : inputs.need,
              })
            }
            placeholder="Or something else you need to hear…"
            style={inputStyle}
          />
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
            <NextButton onClick={() => setStep('q4')} disabled={!canQ3}>
              Next →
            </NextButton>
          </div>
        </QuestionShell>
      </>
    );
  }

  if (step === 'q4') {
    return (
      <>
        {errorBanner}
        <QuestionShell progressIndex={3} onBack={() => setStep('q3')}>
          <div style={qNum}>4 — The fork in the road</div>
          <div style={qTitle}>What choice did they make that you didn&apos;t?</div>
          <div style={qSub}>The moment where your paths split</div>
          <div style={qHint}>Pick one</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {DIVERGENCES.map((item) => (
              <Pill
                key={item}
                label={item}
                selected={inputs.divergence === item}
                onClick={() =>
                  set({
                    divergence: inputs.divergence === item ? '' : item,
                    customDivergence: '',
                  })
                }
              />
            ))}
          </div>
          <input
            type="text"
            value={inputs.customDivergence}
            onChange={(e) =>
              set({
                customDivergence: e.target.value,
                divergence: e.target.value ? '' : inputs.divergence,
              })
            }
            placeholder="Or another choice they made…"
            style={inputStyle}
          />
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
            <NextButton onClick={() => setStep('q5')} disabled={!canQ4}>
              Next →
            </NextButton>
          </div>
        </QuestionShell>
      </>
    );
  }

  if (step === 'q5') {
    return (
      <>
        {errorBanner}
        <QuestionShell progressIndex={4} onBack={() => setStep('q4')}>
          <div style={qNum}>5 — One last thing</div>
          <div style={qTitle}>For the postcard address</div>
          <div style={qSub}>So your Ghost knows who to write to</div>
          <div style={{ maxWidth: 340 }}>
            <label style={fieldLabelStyle}>Your name</label>
            <input
              type="text"
              value={inputs.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="First name or nickname"
              style={inputStyle}
            />
          </div>
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
            <NextButton onClick={() => setStep('handwriting')} disabled={!canQ5}>
              Continue to handwriting →
            </NextButton>
          </div>
        </QuestionShell>
      </>
    );
  }

  // ── SCREEN: HANDWRITING ───────────────────────────────────────────────────
  if (step === 'handwriting') {
    return (
      <>
        {errorBanner}
        <HandwritingCapture
          engine={engine}
          onEngineChange={setEngine}
          onCapture={setHandwritingFile}
          fullScreen
          prompt={PROMPTED_SENTENCE}
          onSend={generate}
          sendDisabled={!handwritingFile}
          onBack={() => setStep('q5')}
        />
      </>
    );
  }

  // ── SCREEN: LOADING ───────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <>
        {errorBanner}
        <div
          style={{
            width: '100%',
            minHeight: '100dvh',
            background: C.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 24,
          }}
        >
          <div
            style={{
              fontFamily: F.display,
              fontSize: 20,
              fontWeight: 400,
              color: C.ink,
              letterSpacing: '0.04em',
              textAlign: 'center',
            }}
          >
            Your Ghost Traveller is writing to you…
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: C.gold,
                  animation: `gPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  opacity: 0.3,
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontFamily: F.serif,
              fontSize: 14,
              color: C.gold,
              fontStyle: 'italic',
              textAlign: 'center',
            }}
          >
            {progressMsg || 'Somewhere between here and there, the postcard is taking shape'}
          </div>
          <style>{`
            @keyframes gPulse {
              0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
              40% { opacity: 1; transform: scale(1.2); }
            }
          `}</style>
        </div>
      </>
    );
  }

  // ── SCREEN: POSTCARD ──────────────────────────────────────────────────────
  if (step === 'card' && cardData) {
    return (
      <>
        {errorBanner}
        <div
          style={{
            width: '100%',
            minHeight: '100dvh',
            background: C.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: isMobile ? '24px 16px 40px' : 40,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: F.serif,
              fontSize: 10,
              letterSpacing: '0.3em',
              color: C.gold,
              textTransform: 'uppercase',
              opacity: 0.65,
            }}
          >
            A postcard from a parallel universe
          </div>
          <div
            data-ghost-card
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              maxWidth: 1280,
              ...(isMobile ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const } : {}),
            }}
          >
            <GhostPostcard data={cardData} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                fontFamily: F.serif,
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: C.ink,
                background: 'transparent',
                border: `1px solid ${C.rule}`,
                padding: '11px 28px',
                cursor: 'pointer',
              }}
            >
              Start again
            </button>
            <button
              type="button"
              onClick={downloadPng}
              style={{
                fontFamily: F.serif,
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#F5E8D0',
                background: C.ink,
                border: 'none',
                padding: '11px 28px',
                cursor: 'pointer',
              }}
            >
              Download .png
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}
