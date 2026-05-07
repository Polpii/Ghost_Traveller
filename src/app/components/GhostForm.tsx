'use client';

export interface GhostInputs {
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

interface GhostFormProps {
  values: GhostInputs;
  onChange: (v: GhostInputs) => void;
}

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

const BRAND = '#7c1418';

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  borderRadius: 14,
  border: '1px solid #e7e5e4',
  backgroundColor: '#ffffff',
  padding: 10,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #d6d3d1',
  backgroundColor: '#fafaf9',
  padding: '5px 10px',
  fontSize: 12,
  color: '#1c1917',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};

const chipBase: React.CSSProperties = {
  borderRadius: 9999,
  padding: '3px 10px',
  fontSize: 11,
  border: '1px solid #d6d3d1',
  backgroundColor: '#fafaf9',
  color: '#57534e',
  cursor: 'pointer',
  transition: 'all 0.12s',
};

const chipSelected: React.CSSProperties = {
  ...chipBase,
  backgroundColor: BRAND,
  borderColor: BRAND,
  color: '#ffffff',
};

const chipDisabled: React.CSSProperties = {
  ...chipBase,
  color: '#d6d3d1',
  cursor: 'not-allowed',
};

const badgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: 9999,
  backgroundColor: BRAND,
  color: '#ffffff',
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
};

const cardTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#1c1917',
  margin: 0,
  lineHeight: 1.2,
};

const cardSubtitle: React.CSSProperties = {
  fontSize: 10,
  color: BRAND,
  margin: 0,
  lineHeight: 1.2,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: '#44403c',
  margin: 0,
};

const hintLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#a8a29e',
  marginLeft: 4,
};

export default function GhostForm({ values, onChange }: GhostFormProps) {
  const set = (patch: Partial<GhostInputs>) => onChange({ ...values, ...patch });

  const toggleInterest = (item: string) => {
    const has = values.interests.includes(item);
    if (has) {
      set({ interests: values.interests.filter((i) => i !== item) });
    } else if (values.interests.length < 3) {
      set({ interests: [...values.interests, item] });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
      }}
    >
      {/* ── Left column: cards 1 + 3 + 4 ───────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        {/* ── Card 1 — Location ─────────────────────────── */}
        <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={badgeStyle}>1</span>
          <div>
            <p style={cardTitle}>Where is your Ghost Traveller?</p>
            <p style={cardSubtitle}>Locate them in the world, then zoom in</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={fieldLabel}>1a. City, Country</p>
          <input
            type="text"
            value={values.city}
            onChange={(e) => set({ city: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={fieldLabel}>1b. A specific place they keep returning to</p>
          <input
            type="text"
            value={values.place}
            onChange={(e) => set({ place: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── Card 3 — Need ─────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={badgeStyle}>3</span>
          <div>
            <p style={cardTitle}>What do you need to hear right now?</p>
            <p style={cardSubtitle}>Your Ghost has something to tell you</p>
          </div>
        </div>
        <p style={fieldLabel}>
          What would help you most today?
          <span style={hintLabel}>(pick one)</span>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {NEEDS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => set({ need: item, customNeed: '' })}
              style={values.need === item ? chipSelected : chipBase}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Or write your own…"
          value={values.customNeed}
          onChange={(e) =>
            set({ customNeed: e.target.value, need: e.target.value ? '' : values.need })
          }
          style={inputStyle}
        />
      </div>

      {/* ── Card 4 — Name ─────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={badgeStyle}>4</span>
          <div>
            <p style={cardTitle}>One last thing</p>
            <p style={cardSubtitle}>For the postcard address</p>
          </div>
        </div>
        <p style={fieldLabel}>Please type your name</p>
        <input
          type="text"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          style={inputStyle}
        />
      </div>
      </div>
      {/* ── Right column: card 2 ───────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

      {/* ── Card 2 — Personality ──────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={badgeStyle}>2</span>
          <div>
            <p style={cardTitle}>Who is your Ghost?</p>
            <p style={cardSubtitle}>Shape their personality and what they hold onto</p>
          </div>
        </div>

        <div>
          <p style={{ ...fieldLabel, marginBottom: 4 }}>
            2a. What does your Ghost care about?
            <span style={hintLabel}>(pick up to 3)</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {INTERESTS.map((item) => {
              const selected = values.interests.includes(item);
              const disabled = !selected && values.interests.length >= 3;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleInterest(item)}
                  disabled={disabled}
                  style={selected ? chipSelected : disabled ? chipDisabled : chipBase}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Or write your own…"
            value={values.customInterest}
            onChange={(e) => set({ customInterest: e.target.value })}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>

        <div>
          <p style={{ ...fieldLabel, marginBottom: 4 }}>
            2b. A feeling she never let go of
            <span style={hintLabel}>(pick one)</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SENSATIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => set({ sensation: item, customSensation: '' })}
                style={values.sensation === item ? chipSelected : chipBase}
              >
                {item}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Or write your own…"
            value={values.customSensation}
            onChange={(e) =>
              set({
                customSensation: e.target.value,
                sensation: e.target.value ? '' : values.sensation,
              })
            }
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>
      </div>

      {/* ── Card 5 — Divergence (parallel-universe fork) ───────── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={badgeStyle}>5</span>
          <div>
            <p style={cardTitle}>What choice did they make that you didn’t?</p>
            <p style={cardSubtitle}>The fork in the road where your paths split</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DIVERGENCES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => set({ divergence: item, customDivergence: '' })}
              style={values.divergence === item ? chipSelected : chipBase}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Or write your own…"
          value={values.customDivergence}
          onChange={(e) =>
            set({
              customDivergence: e.target.value,
              divergence: e.target.value ? '' : values.divergence,
            })
          }
          style={inputStyle}
        />
      </div>
      </div>
    </div>
  );
}
