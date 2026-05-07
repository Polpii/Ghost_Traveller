import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface Body {
  city?: string;
  place?: string;
  interests?: string[];
  sensation?: string;
  need?: string;
  divergence?: string;
  name?: string;
  handwritingDataUrl?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const {
      city,
      place,
      interests = [],
      sensation,
      need,
      divergence,
      name,
      handwritingDataUrl,
    } = body;

    if (!city || !name) {
      return NextResponse.json({ error: 'city and name are required' }, { status: 400 });
    }

    // ── Step 1: if a postcard image is provided, OCR it via GPT-4o vision ──
    let userHandwrittenText = '';
    if (handwritingDataUrl) {
      try {
        const ocr = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Read the visible handwritten or typed message on this uploaded postcard/note. Return ONLY the message text as plain text. No quotes, no labels, no commentary. If it is blank or unreadable, return an empty string.',
                },
                {
                  type: 'image_url',
                  image_url: { url: handwritingDataUrl, detail: 'low' },
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 200,
        });
        userHandwrittenText = ocr.choices[0]?.message?.content?.trim() ?? '';
      } catch (ocrErr) {
        console.warn('[ghost-message] OCR failed, continuing without it:', ocrErr);
      }
    }

    const divergenceContext = divergence
      ? `You are the version of ${name} who ${divergence.toLowerCase()}. That single fork changed everything that came after.`
      : `You are a version of ${name} who once made a different choice. That fork changed everything.`;

    const replyInstruction = userHandwrittenText
      ? `${name} wrote to you: "${userHandwrittenText}". Your first line must answer this directly — not abstractly, but as if you just read it.`
      : '';

    const prompt = `You are the Ghost Traveller.
${divergenceContext}
You are writing a short handwritten postcard to ${name} — the version of yourself who did NOT make that choice.
You know them better than anyone, because you ARE them.

What you know about them:
- They are in or connected to: ${city}${place ? `, specifically ${place}` : ''}
- They care about: ${interests.length > 0 ? interests.join(', ') : 'being present in the world'}
- The feeling they carry: ${sensation || 'a quiet unnamed longing'}
- What they need to hear right now: ${need || 'that they are still themselves'}
${replyInstruction}

Write a postcard message. Format:
- First line: "Dear ${name},"
- Then 2 to 3 body lines. Each line: 5 to 9 words. Short. Loaded.
- No sign-off.
- Total under 180 characters including the greeting.

What makes this message good:
- It sounds like it was written by someone who knows ${name} *from the inside*, not an outside observer
- It is grounded in a specific sensory detail from the place (not just the city name — the feeling of being there)
- It carries the weight of the divergence: something was found, lost, or changed because of that different choice — without explaining it
- It answers what ${name} needs, but obliquely — the way a close friend would, not a therapist
- If replying to their note, the reply must feel earned and direct
- Tone: intimate, slightly uncanny, present-tense. Like finding your own handwriting on a letter you don't remember sending.

Bad examples (too generic, too long, too explanatory):
  "You are still whole. Morning comes slow, whispering past."
  "Alone, night wraps you in familiar whispers. You chose differently, but we share the same sky."
Good examples (short, loaded, uncanny, specific):
  "Dear Lisa,\nI kept the kitchen. The light here is yours.\nYou would have stayed too."
  "Dear Nour,\nThe courtyard is the same. But I turned left.\nFind me in the slow hours."

Output ONLY the message lines, separated by newlines. No quotes, no labels.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.88,
      max_tokens: 90,
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json({
      message,
      handwrittenNote: userHandwrittenText || null,
    });
  } catch (err) {
    console.error('[ghost-message]', err);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
