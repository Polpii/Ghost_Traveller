'use client';

import { useState } from 'react';
import GhostForm, { type GhostInputs } from '../components/GhostForm';
import GhostPostcard, { type GhostCardData } from '../components/GhostPostcard';

type GhostStep = 'form' | 'generating' | 'card';

const EMPTY: GhostInputs = {
  city: '',
  place: '',
  interests: [],
  customInterest: '',
  divergence: '',
  customDivergence: '',
  sensation: '',
  customSensation: '',
  need: '',
  customNeed: '',
  name: '',
};

export default function GhostPage() {
  const [step, setStep] = useState<GhostStep>('form');
  const [inputs, setInputs] = useState<GhostInputs>(EMPTY);
  const [cardData, setCardData] = useState<GhostCardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    inputs.city.trim().length > 0 &&
    inputs.name.trim().length > 0 &&
    inputs.sensation.length > 0 &&
    inputs.need.length > 0;

  const generate = async () => {
    setError(null);
    setStep('generating');

    try {
      const res = await fetch('/api/ghost-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });

      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok || !data.message) {
        throw new Error(data.error ?? 'Failed to generate message');
      }

      setCardData({
        city: inputs.city,
        place: inputs.place,
        message: data.message,
        date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      });
      setStep('card');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('form');
    }
  };

  const reset = () => {
    setStep('form');
    setInputs(EMPTY);
    setCardData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="print:hidden bg-stone-900 px-6 py-4 text-stone-100">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="font-sans text-lg font-semibold uppercase tracking-widest">Ghost Traveller</h1>
            <p className="mt-0.5 font-serif text-xs italic text-stone-500">Postcards from elsewhere</p>
          </div>
          {step !== 'form' && (
            <button
              onClick={reset}
              className="font-sans text-sm text-stone-400 transition-colors hover:text-stone-100"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'form' && (
          <div className="flex flex-col gap-8">
            <div className="text-center">
              <h2 className="mb-2 font-serif text-2xl font-semibold text-stone-800">
                Build your Ghost Traveller
              </h2>
              <p className="max-w-md mx-auto font-sans text-sm text-stone-500">
                Answer these four questions. Your Ghost is waiting somewhere in the world — they have something to tell you.
              </p>
            </div>

            <GhostForm values={inputs} onChange={setInputs} />

            <div className="flex justify-center">
              <button
                onClick={generate}
                disabled={!isValid}
                className={`rounded-full px-10 py-3 font-sans font-semibold text-base shadow transition-colors ${
                  isValid
                    ? 'bg-stone-800 text-white hover:bg-stone-900'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                Receive your postcard
              </button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center gap-6 py-24">
            <div className="text-5xl">✉</div>
            <h2 className="font-serif text-xl font-semibold text-stone-800">
              Your Ghost is writing…
            </h2>
            <p className="max-w-sm text-center font-sans text-sm text-stone-500">
              Somewhere in {inputs.city || 'the world'}, a message is being composed for you.
            </p>
            <div className="mt-4 flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-stone-500"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {step === 'card' && cardData && (
          <div className="flex flex-col gap-8 items-center">
            <div className="text-center">
              <h2 className="mb-1 font-serif text-xl font-semibold text-stone-800">
                From your Ghost in {cardData.city}
              </h2>
              <p className="font-sans text-sm text-stone-400">
                A message found in transit, addressed to {inputs.name}
              </p>
            </div>

            <GhostPostcard data={cardData} />

            {/* Message preview */}
            <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="mb-3 font-sans text-xs uppercase tracking-widest text-stone-400">Message</p>
              <div className="font-serif text-sm leading-relaxed text-stone-700 whitespace-pre-wrap italic">
                {cardData.message}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const canvas = document.querySelector('canvas');
                  if (!canvas) return;
                  const a = document.createElement('a');
                  a.download = `ghost-postcard-${inputs.city.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
                  a.href = canvas.toDataURL('image/png');
                  a.click();
                }}
                className="rounded-full bg-stone-800 px-7 py-2.5 font-sans text-sm font-medium text-white shadow hover:bg-stone-900"
              >
                Download postcard
              </button>
              <button
                onClick={reset}
                className="rounded-full border border-stone-300 bg-white px-7 py-2.5 font-sans text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                New postcard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
