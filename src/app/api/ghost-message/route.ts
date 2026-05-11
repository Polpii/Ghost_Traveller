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
      ? `You are the version of ${name} who ${divergence.toLowerCase()}. That single fork changed everything that came after, and you are still living in its consequences.`
      : `You are a version of ${name} who once made a different choice. That fork changed everything.`;

    const replyInstruction = userHandwrittenText
      ? `${name} just wrote to you: "${userHandwrittenText}". Your FIRST body line must answer this note directly and concretely — acknowledge what they said, don't dodge it with metaphor.`
      : '';

    const prompt = `You are the Ghost Traveller — a parallel version of ${name} writing them a short, plain, direct postcard. Not poetic. Not mystical. Just a real note from someone who knows them.
${divergenceContext}

Facts you MUST use — every single one of these has to appear concretely in the message (not as metaphor):
- City you are in (Q1): ${city}
- Specific place you are at (Q2): ${place || city}
- Things ${name} cares about (Q3): ${interests.length > 0 ? interests.join(', ') : 'small daily things'}
- Feeling you both carry (Q4): ${sensation || 'a quiet longing'}
- What ${name} needs to hear (Q5): ${need || 'that they are still themselves'}
- The divergence: ${divergence || 'a different choice'}
${replyInstruction}

Format (STRICT — keep it short, it must fit on a postcard):
- Line 1: "Dear ${name},"
- Then exactly 3 short body lines. Each line: 8 to 12 words.
- No sign-off.
- Total length: 180 to 240 characters INCLUDING the greeting. Do not go longer.

Content rules:
1. Line 1 of the body: name where you are (${place || city}) with ONE concrete sensory detail (light, smell, sound, weather). Plain words.
2. Line 2 of the body: reference at least ONE thing from Q3 (${interests.length > 0 ? interests.join(', ') : 'their interests'}) as something you literally did or saw today, AND name the feeling from Q4 (${sensation || 'the feeling'}) plainly.
3. Line 3 of the body: directly say what ${name} needs to hear (Q5: ${need || 'the reassurance'}) — like a friend on the phone, no metaphor, no riddle. Mention the divergence in plain language if it fits naturally.
${userHandwrittenText ? `4. Before everything, your message must answer their note ("${userHandwrittenText}") directly and concretely, not abstractly.` : ''}

Tone: warm, plain, direct, slightly wistful. Like a real handwritten postcard from a close friend. Forbidden words: whispers, echoes, shadows, symphonies, untamed, shared sky, woven, eternal, dance, embrace, journey. No similes. No "like a ___".

Example (city: Lisbon, place: Praça do Comércio, interests: cooking & vinyl records, sensation: nostalgia, need: permission to rest, divergence: stayed in Lisbon):
Dear Sam,
I'm sitting at Praça do Comércio. The river is grey today.
I cooked dinner alone and put on a record — nostalgia again.
You don't have to keep moving. Rest is allowed. I stayed and I'm okay.

Output ONLY the postcard, starting with "Dear ${name},". No quotes, no labels.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.55,
      max_tokens: 160,
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
