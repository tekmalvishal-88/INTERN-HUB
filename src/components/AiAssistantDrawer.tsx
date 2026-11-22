import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  ApplicationRecord,
  ChatMessage,
  Opportunity,
  StudentProfile,
  UserAccount,
} from '../types';
import { getExamClash, getSkillMatch } from '../utils/matching';

interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  user: UserAccount;
  profile: StudentProfile;
  opportunities: Opportunity[];
  applications: ApplicationRecord[];
  initialPrompt?: string;
  onConsumedInitialPrompt?: () => void;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  open,
  onClose,
  user,
  profile,
  opportunities,
  applications,
  initialPrompt,
  onConsumedInitialPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text:
        user.role === 'learner'
          ? `Hey ${(profile.name || user.name).split(' ')[0]}, glad you're here! Take your time—I keep track of your ${profile.skills.length} skills, ${opportunities.length} opportunities, and exam dates. Type or tap the Mic whenever you'd like a calm, friendly suggestion.`
          : `Hello ${user.name}! Take a breath—I'm ready to gently walk through your pipeline, leave approvals, or interview ideas whenever you are.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice states
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const pickCalmFriendlyVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const preferredNames = [
      'Google UK English Female',
      'Samantha',
      'Microsoft Aria',
      'Microsoft Jenny',
      'Ava',
      'Allison',
      'Victoria',
      'Karen',
      'Serena',
      'Google US English',
      'Google हिन्दी',
      'Veena',
      'Rishi',
    ];

    for (const target of preferredNames) {
      const found = voices.find((v) =>
        v.name.toLowerCase().includes(target.toLowerCase())
      );
      if (found) return found;
    }

    return (
      voices.find((v) => v.lang.toLowerCase().startsWith('en') && v.localService) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      voices[0]
    );
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const refreshVoice = () => {
        preferredVoiceRef.current = pickCalmFriendlyVoice();
      };
      refreshVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoice);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoice);
        window.speechSynthesis.cancel();
        recognitionRef.current?.stop();
      };
    }
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  const speakText = (msgId: string, rawText: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceNotice('Voice playback is not supported in this browser.');
      return;
    }

    if (speakingMsgId === msgId) {
      stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown and trim gently at a word/sentence boundary for calm ~5s playback
    const clean = rawText
      .replace(/[*_`#•]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let spokenSlice = clean;
    if (clean.length > 155) {
      const cut = clean.slice(0, 155);
      const lastPeriod = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
      if (lastPeriod > 70) {
        spokenSlice = cut.slice(0, lastPeriod + 1);
      } else {
        const lastSpace = cut.lastIndexOf(' ');
        spokenSlice = `${lastSpace > 80 ? cut.slice(0, lastSpace) : cut}.`;
      }
    }

    const utter = new SpeechSynthesisUtterance(spokenSlice);
    const chosenVoice = preferredVoiceRef.current || pickCalmFriendlyVoice();
    if (chosenVoice) {
      utter.voice = chosenVoice;
      utter.lang = chosenVoice.lang;
    }
    // Calm, warm, unhurried conversational delivery
    utter.rate = 0.94;
    utter.pitch = 1.04;
    utter.volume = 0.92;
    utter.onend = () => setSpeakingMsgId(null);
    utter.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utter);
  };

  const sendMessage = async (textToSend: string, viaVoice = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setError(null);
    setVoiceNotice(null);
    stopSpeaking();

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    try {
      const userApps =
        user.role === 'learner'
          ? applications.filter((a) => a.applicantEmail === user.email)
          : applications;

      // Pre-sort top opportunities for concise fast context
      const topOpps = opportunities
        .map((o) => {
          const match = getSkillMatch(o, profile);
          const clash = getExamClash(o, profile);
          return { o, match, clash };
        })
        .sort((a, b) => b.match.pct - a.match.pct)
        .slice(0, 8)
        .map(({ o, match, clash }) => ({
          title: o.title,
          company: o.company,
          type: o.type,
          mode: o.mode,
          location: o.location,
          stipend: o.stipend,
          deadline: o.deadline,
          examStatus: clash.label,
          matchPct: match.pct,
          missingSkills: match.missing,
        }));

      const contextPayload = {
        userName: user.role === 'learner' ? profile.name || user.name : user.name,
        role: user.role,
        voiceMode: viaVoice || voiceEnabled,
        profile:
          user.role === 'learner'
            ? {
                branch: profile.branch,
                semester: profile.semester,
                skills: profile.skills,
                examStart: profile.examStart,
                examEnd: profile.examEnd,
                resumeName: profile.resumeName,
              }
            : undefined,
        applicationsSummary: userApps.slice(0, 6).map((a) => ({
          title: a.roleTitle,
          company: a.company,
          stage: a.stage,
          appliedOn: a.appliedOn,
        })),
        opportunitiesSummary: topOpps,
      };

      const apiMessages = updatedHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: contextPayload,
        }),
      });

      const data = (await res.json()) as { reply?: string; latencyMs?: number; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Could not reach the AI Career Assistant.');
      }

      const aiId = `m-${Date.now()}`;
      const aiMsg: ChatMessage = {
        id: aiId,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latencyMs: data.latencyMs,
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (voiceEnabled || viaVoice) {
        speakText(aiId, data.reply);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    setVoiceNotice(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceNotice('Voice microphone requires Chrome/Edge/Safari Speech Recognition support. You can still type and use 5s Voice Replay.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      setIsListening(false);
      if (transcript) {
        void sendMessage(transcript, true);
      }
    };
    rec.onerror = () => {
      setIsListening(false);
      setVoiceNotice('Could not capture audio. Check microphone permissions or type your question.');
    };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  useEffect(() => {
    if (open && initialPrompt) {
      void sendMessage(initialPrompt);
      onConsumedInitialPrompt?.();
    }
  }, [open, initialPrompt]);

  if (!open) return null;

  const quickPrompts =
    user.role === 'learner'
      ? [
          'Which internships fit my exam dates best?',
          'What top 2 skills should I learn next?',
          'Run a quick mock interview question',
          'Which deadlines are under 3 days?',
        ]
      : [
          'Summarize my current applicant pipeline',
          'Draft 3 screening questions for Full Stack Intern',
          'How can I improve candidate acceptance rate?',
        ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-white dark:bg-[#0e1626] border-l border-[#dbe3f0] dark:border-[#24324d] h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2f5bea] text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">AI & Calm Voice Assistant</h2>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                Calm, friendly mentor · Gentle voice playback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (voiceEnabled) stopSpeaking();
                setVoiceEnabled((v) => !v);
              }}
              title={voiceEnabled ? 'Auto voice reply ON' : 'Auto voice reply OFF'}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                voiceEnabled
                  ? 'bg-[#e8eeff] dark:bg-[#1c2a50] border-[#2f5bea] text-[#2f5bea] dark:text-[#7a9bff]'
                  : 'border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86]'
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Voice</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setMessages((prev) => prev.slice(0, 1));
                setError(null);
              }}
              title="Clear conversation"
              className="p-2 rounded-lg text-[#5b6b86] hover:text-[#12203a] dark:hover:text-white hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              aria-label="Close AI assistant"
              className="p-2 rounded-lg text-[#5b6b86] hover:text-[#12203a] dark:hover:text-white hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => {
            const isSpeaking = speakingMsgId === msg.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#2f5bea] text-white rounded-br-sm'
                      : 'bg-[#f3f6fb] dark:bg-[#16213a] text-[#12203a] dark:text-[#e8eefc] border border-[#dbe3f0] dark:border-[#24324d] rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                  <span>
                    {msg.role === 'user' ? 'You' : 'InternHub AI'} · {msg.timestamp}
                  </span>
                  {msg.latencyMs !== undefined && (
                    <span className="font-mono tabular-nums">
                      ({(msg.latencyMs / 1000).toFixed(1)}s)
                    </span>
                  )}
                  {msg.role === 'model' && (
                    <button
                      type="button"
                      onClick={() => speakText(msg.id, msg.text)}
                      className="inline-flex items-center gap-1 text-[#2f5bea] dark:text-[#7a9bff] font-semibold hover:underline cursor-pointer"
                    >
                      {isSpeaking ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          <span>Replay</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="px-4 py-3 rounded-2xl bg-[#f3f6fb] dark:bg-[#16213a] border border-[#dbe3f0] dark:border-[#24324d] text-xs font-medium text-[#5b6b86] dark:text-[#9fb0cc] flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <span>Generating fast answer...</span>
              </div>
            </div>
          )}

          {voiceNotice && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              {voiceNotice}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Assistant couldn't reply</p>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Starter Prompts */}
        <div className="px-5 py-2.5 border-t border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#111a2e] flex gap-2 overflow-x-auto">
          {quickPrompts.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendMessage(q)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#16213a] text-xs font-medium text-[#12203a] dark:text-[#e8eefc] hover:border-[#2f5bea] whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Box with Mic Voice Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="p-4 border-t border-[#dbe3f0] dark:border-[#24324d] flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleVoiceInput}
            aria-label={isListening ? 'Stop voice input' : 'Speak question'}
            title={isListening ? 'Listening... click to stop' : 'Speak your question'}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-600 border-rose-600 text-white'
                : 'bg-[#f3f6fb] dark:bg-[#16213a] border-[#dbe3f0] dark:border-[#24324d] text-[#2f5bea] dark:text-[#7a9bff] hover:border-[#2f5bea]'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'Listening... speak now' : 'Ask or tap Mic to speak...'}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f3f6fb] dark:bg-[#16213a] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="p-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
