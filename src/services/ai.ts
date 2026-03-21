import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const analyzeBoardContent = async (text: string, imageData?: string) => {
  const apiKey = (process.env as any).VITE_GROQ_API_KEY;

  try {
    const userContent: any[] = [
      {
        type: 'text',
        text: `Analyze the following whiteboard content.\nText content extracted: ${text || 'None detected.'}`
      }
    ];

    if (imageData) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageData
        }
      });
    }

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: `You are an expert Multimodal AI Whiteboard Analyst. 
            You can see drawings, shapes, and text on the whiteboard. 
            Your job is to provide:
            1. A clear overview of the visual and textual content.
            2. Identifying themes, relationships, and visual patterns.
            3. 3-5 high-value action items or insights based on BOTH the drawings and the text.
            If there are drawings without text, describe what they look like and their possible meaning.
            Respond in clean Markdown format with emojis.`
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('Groq AI Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Failed to connect to AI');
  }
};

export const refineDrawing = async (imageData: string) => {
  const apiKey = (process.env as any).VITE_GROQ_API_KEY;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: `You are a handwriting and shape transcription expert.
            Your task is to look at a hand-drawn sketch and identify the TEXT or the INTENDED SHAPE written/drawn.
            - If it is text (handwriting), return only the transcribed text.
            - If it is a clear shape, return ONLY one of these whitelisted names in brackets: [circle], [rectangle], [triangle], [star], [arrow], [line].
            - DO NOT return anything else like [house] or [cloud] yet; use [rectangle] for boxes or the transcription if it looks like a word.
            - Provide ONLY the direct transcription or shape name with NO spelling errors.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageData }
              },
              {
                type: 'text',
                text: 'Transcribe this drawing.'
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 100,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error: any) {
    console.error('Groq AI Error:', error.response?.data || error.message);
    throw new Error('Failed to refine drawing');
  }
};
