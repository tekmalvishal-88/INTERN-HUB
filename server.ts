import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

function getApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'YOUR_GEMINI_API_KEY') {
    return undefined;
  }
  return key;
}

function createAiClient(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(getApiKey()),
  });
});

interface ChatRequestMessage {
  role: 'user' | 'model';
  text: string;
}

interface ChatContext {
  userName?: string;
  role?: 'learner' | 'organizer';
  voiceMode?: boolean;
  profile?: {
    branch?: string;
    semester?: number;
    skills?: string[];
    examStart?: string;
    examEnd?: string;
    resumeName?: string;
  };
  applicationsSummary?: Array<{
    title: string;
    company: string;
    stage: string;
    appliedOn: string;
  }>;
  opportunitiesSummary?: Array<{
    title: string;
    company: string;
    type: string;
    mode: string;
    location: string;
    stipend: number;
    deadline: string;
    examStatus?: string;
    matchPct?: number;
    missingSkills?: string[];
  }>;
}

app.post('/api/chat', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(400).json({
      error:
        'GEMINI_API_KEY is not configured. Add your Gemini API key to the .env file locally (or Settings > Secrets in AI Studio) to use the AI Career Assistant.',
    });
    return;
  }

  const startedAt = Date.now();
  try {
    const body = req.body as {
      messages?: ChatRequestMessage[];
      context?: ChatContext;
    };

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      res.status(400).json({ error: 'Please provide at least one message.' });
      return;
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== 'user' || !latestMessage.text?.trim()) {
      res.status(400).json({ error: 'Latest message must be a non-empty user message.' });
      return;
    }

    const ctx = body.context || {};
    const voicePromptRule = ctx.voiceMode
      ? 'VOICE MODE ACTIVE: Respond like a calm, warm, supportive mentor in gentle spoken English (under 32 words, zero markdown/asterisks/bullets) so it sounds reassuring and plays smoothly in about 5 seconds.'
      : 'Keep responses warm, calm, encouraging, and practical (under 85 words), using approachable phrasing and short clear sentences.';

    const systemInstruction = [
      'You are InternHub AI Career Assistant — a calm, friendly, supportive career mentor.',
      voicePromptRule,
      'Always ground answers kindly in the specific companies, skill percentages, exam dates, and deadlines in USER_CONTEXT.',
      '',
      'USER_CONTEXT:',
      JSON.stringify({
        userName: ctx.userName,
        role: ctx.role,
        profile: ctx.profile,
        applications: (ctx.applicationsSummary || []).slice(0, 6),
        topOpportunities: (ctx.opportunitiesSummary || []).slice(0, 8),
      }),
    ].join('\n');

    const ai = createAiClient(apiKey);
    const history = messages.slice(-7, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-3.1-flash-lite',
      config: {
        systemInstruction,
      },
      history,
    });

    const response = await Promise.race([
      chat.sendMessage({
        message: latestMessage.text.trim(),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 14000)
      ),
    ]);

    const reply = response.text?.trim();
    if (!reply) {
      res.status(502).json({ error: 'The AI model returned an empty response. Please try again.' });
      return;
    }

    res.json({
      reply,
      latencyMs: Date.now() - startedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error communicating with Gemini API.';
    if (message === 'REQUEST_TIMEOUT') {
      res.status(504).json({ error: 'Gemini AI took too long to respond. Please try again.' });
      return;
    }
    const lower = message.toLowerCase();
    let status = 500;
    if (lower.includes('api_key_invalid') || lower.includes('400')) status = 400;
    else if (lower.includes('permission_denied') || lower.includes('403')) status = 403;
    else if (lower.includes('resource_exhausted') || lower.includes('429')) status = 429;

    res.status(status).json({ error: message });
  }
});

interface SmartPickCandidate {
  id: string;
  title: string;
  company: string;
  type: string;
  mode: string;
  location: string;
  stipend: number;
  deadline: string;
  matchPct: number;
  examStatus: string;
  skills: string[];
}

app.post('/api/smart-pick', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(400).json({
      error:
        'GEMINI_API_KEY is not configured. Add your key in .env (local) or Settings > Secrets to use AI Smart Picker.',
    });
    return;
  }

  const startedAt = Date.now();
  try {
    const body = req.body as {
      preferencePrompt?: string;
      skills?: string[];
      semester?: number;
      candidates?: SmartPickCandidate[];
    };

    const candidates = Array.isArray(body?.candidates) ? body.candidates.slice(0, 16) : [];
    if (candidates.length === 0) {
      res.status(400).json({ error: 'No candidate opportunities matched your baseline constraints.' });
      return;
    }

    const ai = createAiClient(apiKey);
    const prompt = [
      `Student skills: ${(body.skills || []).join(', ')}`,
      `Student semester: ${body.semester || 5}`,
      `Preference: ${body.preferencePrompt?.trim() || 'Best balanced high-stipend exam-safe opportunities'}`,
      '',
      'Pick up to 4 best matching opportunity IDs from candidates below.',
      'Return ONLY valid JSON matching: {"picks":[{"opportunityId":"...","fitTag":"2-3 word label","reason":"concise 1-sentence reason"}]}. No markdown or extra text.',
      JSON.stringify(candidates),
    ].join('\n');

    const chat = ai.chats.create({
      model: 'gemini-3.1-flash-lite',
      config: {
        systemInstruction:
          'You are a fast JSON recommendation engine. Output strictly valid JSON object with key "picks" array and nothing else.',
      },
    });

    const response = await Promise.race([
      chat.sendMessage({ message: prompt }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 14000)
      ),
    ]);
    const rawText = (response.text ?? '{}')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(rawText) as {
      picks?: Array<{
        opportunityId: string;
        fitTag: string;
        reason: string;
      }>;
    };

    res.json({
      picks: Array.isArray(parsed.picks) ? parsed.picks.slice(0, 4) : [],
      latencyMs: Date.now() - startedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Smart Picker failed.';
    if (message === 'REQUEST_TIMEOUT') {
      res.status(504).json({ error: 'AI Smart Picker timed out. Please try again.' });
      return;
    }
    res.status(500).json({ error: message });
  }
});

app.post('/api/personalize', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(400).json({
      error:
        'GEMINI_API_KEY is not configured. Add your key in .env (local) or Settings > Secrets for live Gemini suggestions.',
    });
    return;
  }

  const startedAt = Date.now();
  try {
    const body = req.body as {
      role?: string;
      userName?: string;
      skills?: string[];
      semester?: number;
      personalization?: {
        preferredDomains?: string[];
        preferredModes?: string[];
        preferredLocations?: string[];
        minStipend?: number;
        careerGoal?: string;
        examSafeOnly?: boolean;
        facultyDepartment?: string;
        facultyFocus?: string;
        organizerCompany?: string;
      };
      candidates?: SmartPickCandidate[];
    };

    const candidates = Array.isArray(body?.candidates) ? body.candidates.slice(0, 20) : [];
    const ai = createAiClient(apiKey);
    const pref = body.personalization || {};

    const prompt = [
      `User: ${body.userName || 'Student'} (${body.role || 'learner'})`,
      `Skills: ${(body.skills || []).join(', ')}`,
      `Semester: ${body.semester || 5}`,
      `Preferred Domains: ${(pref.preferredDomains || []).join(', ') || 'Software, Data'}`,
      `Preferred Work Modes: ${(pref.preferredModes || []).join(', ') || 'Remote, Hybrid'}`,
      `Preferred Locations: ${(pref.preferredLocations || []).join(', ') || 'Hyderabad, Remote'}`,
      `Minimum Stipend: ₹${pref.minStipend || 0}/mo`,
      `Exam-safe priority: ${pref.examSafeOnly !== false ? 'Yes' : 'Flexible'}`,
      `Career Goal / Focus: ${pref.careerGoal || pref.facultyFocus || pref.organizerCompany || 'High-impact internships & skill growth'}`,
      '',
      'From the candidates list below, pick up to 4 best opportunities tailored to these preferences.',
      'Return ONLY valid JSON matching:',
      '{"summary":"2 concise sentences summarizing personalized roadmap & focus","skillAdvice":["skill 1","skill 2"],"recommendations":[{"opportunityId":"...","fitTag":"2-3 word label","reason":"1 concise personalized sentence"}]}',
      JSON.stringify(candidates),
    ].join('\n');

    const runPersonalizeCall = (modelName: string, timeoutMs: number) =>
      Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction:
              'You are InternHub AI Career Advisor. Respond with strictly valid JSON and no markdown fences.',
            ...(modelName === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs)
        ),
      ]);

    let response;
    try {
      response = await runPersonalizeCall('gemini-4-hydrogen', 7500);
    } catch (primaryErr: unknown) {
      const msg = primaryErr instanceof Error ? primaryErr.message : '';
      if (
        msg === 'REQUEST_TIMEOUT' ||
        msg.includes('503') ||
        msg.toLowerCase().includes('unavailable')
      ) {
        response = await runPersonalizeCall('gemini-3.1-flash-lite', 10000);
      } else {
        throw primaryErr;
      }
    }

    const rawText = (response.text ?? '{}')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(rawText) as {
      summary?: string;
      skillAdvice?: string[];
      recommendations?: Array<{ opportunityId: string; fitTag: string; reason: string }>;
    };

    res.json({
      summary:
        parsed.summary ||
        'Your workspace has been personalized around your target domains, work mode preferences, and academic exam schedule.',
      skillAdvice: Array.isArray(parsed.skillAdvice) ? parsed.skillAdvice.slice(0, 3) : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 4)
        : [],
      latencyMs: Date.now() - startedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Personalization AI failed.';
    if (message === 'REQUEST_TIMEOUT') {
      res.status(504).json({ error: 'Gemini AI took too long to personalize. Please try again.' });
      return;
    }
    res.status(500).json({ error: message });
  }
});

function getLocalLanIp(): string | undefined {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return undefined;
}

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const prodFlag = process.argv.includes('--prod');
  const distPath = path.resolve(__dirname, 'dist');
  let isProd = process.env.NODE_ENV === 'production' || prodFlag;
  const disableHmr = process.env.DISABLE_HMR === 'true';
  const httpServer = http.createServer(app);

  if (!isProd) {
    try {
      if (disableHmr) {
        app.get('/@vite/client', (_req, res) => {
          res.type('application/javascript').send(
            [
              '// HMR disabled in preview environment',
              'export const createHotContext = () => ({',
              '  accept() {}, dispose() {}, invalidate() {}, decline() {},',
              '  on() {}, off() {}, send() {}, prune() {}, data: {}',
              '});',
              'export const updateStyle = (id, css) => {',
              '  let el = document.querySelector(`style[data-vite-dev-id="${id}"]`);',
              '  if (!el) {',
              '    el = document.createElement("style");',
              '    el.setAttribute("data-vite-dev-id", id);',
              '    document.head.appendChild(el);',
              '  }',
              '  el.textContent = css;',
              '};',
              'export const removeStyle = (id) => {',
              '  document.querySelector(`style[data-vite-dev-id="${id}"]`)?.remove();',
              '};',
              'export const injectQuery = (url) => url;',
            ].join('\n')
          );
        });
      }

      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: disableHmr ? false : { server: httpServer },
          ws: disableHmr ? (false as const) : undefined,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      if (fs.existsSync(distPath)) {
        isProd = true;
      } else {
        throw viteErr;
      }
    }
  }

  if (isProd) {
    if (!fs.existsSync(distPath)) {
      console.error('Missing dist/ build directory. Run "npm run build" first.');
      process.exit(1);
    }
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    const lanIp = getLocalLanIp();
    const modeLabel = isProd ? 'Production' : 'Development';
    console.log(`\nInternHub (${modeLabel}) running locally:`);
    console.log(`  Local:   http://localhost:${port}`);
    if (lanIp) {
      console.log(`  Network: http://${lanIp}:${port}`);
    }
    console.log(
      `  AI Chat: ${getApiKey() ? 'Enabled (GEMINI_API_KEY detected)' : 'Demo fallback (add GEMINI_API_KEY in .env to enable live AI)'}\n`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start InternHub server:', err);
  process.exit(1);
});
