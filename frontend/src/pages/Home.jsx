import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { assignments, copilot, notifications, user, docs, tasks as tasksApi } from '../api/client';
import CommandMenu from '../components/CommandMenu';
import MarkdownMessage from '../components/MarkdownMessage';
import QuizCard from '../components/QuizCard';
import { Bell, Calendar, Zap, CalendarPlus, CirclePlus, FileText, HelpCircle, Bot } from 'lucide-react';

/** Format assistant text before markdown: pretty-print JSON as code block; preserve newlines. */
function formatCopilotContent(text) {
  if (text == null || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  const first = trimmed.charAt(0);
  if (first === '{' || first === '[') {
    try {
      const parsed = JSON.parse(trimmed);
      return '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
    } catch {
      /* not valid JSON, use as-is */
    }
  }
  return text;
}

/** Convert backend structured sections (summary, keyPoints, keyTerms, nextSteps, etc.) into Markdown. */
function structuredToMarkdown(structured) {
  if (!structured || typeof structured !== 'object') return '';
  const parts = [];
  if (structured.summary && String(structured.summary).trim()) {
    parts.push('## Summary\n\n' + String(structured.summary).trim());
  }
  if (Array.isArray(structured.keyPoints) && structured.keyPoints.length > 0) {
    parts.push('## Key points\n\n' + structured.keyPoints.map((p) => '- ' + String(p).trim()).join('\n'));
  }
  if (Array.isArray(structured.keyTerms) && structured.keyTerms.length > 0) {
    parts.push('## Key terms\n\n' + structured.keyTerms.map((t) => (typeof t === 'object' && t != null && (t.term || t.name))
      ? `- **${String(t.term || t.name)}**: ${String(t.definition || '').trim()}`
      : '- ' + String(t)).join('\n'));
  }
  if (Array.isArray(structured.nextSteps) && structured.nextSteps.length > 0) {
    parts.push('## Next steps\n\n' + structured.nextSteps.map((s) => '- ' + String(s).trim()).join('\n'));
  }
  if (Array.isArray(structured.outline) && structured.outline.length > 0) {
    parts.push('## Outline\n\n' + structured.outline.map((o) => '- ' + String(o).trim()).join('\n'));
  }
  if (Array.isArray(structured.glossary) && structured.glossary.length > 0) {
    parts.push('## Glossary\n\n' + structured.glossary.map((g) => `- **${String(g.term || g.term)}**: ${String(g.definition || '').trim()}`).join('\n'));
  }
  if (Array.isArray(structured.commands) && structured.commands.length > 0) {
    parts.push('## Commands\n\n' + structured.commands.map((c) => `- **${String(c.cmd || c.command)}**: ${String(c.description || '').trim()}`).join('\n'));
  }
  if (Array.isArray(structured.cards) && structured.cards.length > 0) {
    parts.push('## Flashcards\n\n' + structured.cards.map((c) => `- **Q:** ${String(c.q || c.question || '').trim()} **A:** ${String(c.a || c.answer || '').trim()}`).join('\n'));
  }
  if (Array.isArray(structured.questions) && structured.questions.length > 0) {
    parts.push('## Questions\n\n' + structured.questions.map((q) => `- ${String(q.q || q.question || '').trim()} → ${String(q.answer || '').trim()}`).join('\n'));
  }
  return parts.join('\n\n');
}

const WIDGET_IDS = ['notifications', 'tasks', 'copilot'];
const COMMAND_CHIPS = ['/help', '/plan', '/summarize', '/flashcards', '/quiz', '/notes', '/check', '/tasks', '/deadline', '/reschedule'];
const MAX_CONVERSATIONS = 3;
const CONVERSATIONS_STORAGE_KEY = (uid) => `ecstudy-copilot-conversations-${uid}`;

/** Normalize backend quiz question to QuizCard format: { question, options, correctIndex, explanation }. */
function normalizeQuizQuestion(q) {
  const question = String(q.q ?? q.question ?? '').trim() || 'Question';
  const choices = Array.isArray(q.choices) ? q.choices : (q.options || []);
  const options = choices.map((c) => (typeof c === 'string' ? c : (c?.text ?? c?.label ?? '')));
  const answer = q.answer ?? q.correctIndex;
  let correctIndex = 0;
  if (typeof answer === 'number' && answer >= 0 && answer < options.length) {
    correctIndex = answer;
  } else if (typeof answer === 'string') {
    const idx = options.findIndex((o) => String(o).trim().toLowerCase() === String(answer).trim().toLowerCase());
    if (idx >= 0) correctIndex = idx;
  }
  const explanation = String(q.explanation ?? '').trim();
  return { question, options: options.length ? options : ['Option A', 'Option B', 'Option C', 'Option D'], correctIndex, explanation };
}

export default function Home() {
  const { userId } = useAuth();
  const { canUseCopilot, copilotRemaining, copilotLimit, incrementCopilotUsage, plan } = usePlan();
  const [widgets, setWidgets] = useState(WIDGET_IDS);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [taskList, setTaskList] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', dueDate: '', difficulty: 'medium', notes: '' });
  const [taskModal, setTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const copilotInputRef = useRef(null);
  const commandMenuListRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandMenuActiveIndex, setCommandMenuActiveIndex] = useState(0);
  const [copilotView, setCopilotView] = useState('chat');
  const [quizQuestionsFromApi, setQuizQuestionsFromApi] = useState([]);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizTopic, setQuizTopic] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const slashIndex = input.lastIndexOf('/');
  const showCommandMenu = slashIndex >= 0 && !input.slice(slashIndex + 1).includes(' ');
  const commandQuery = showCommandMenu ? input.slice(slashIndex + 1).trim().toLowerCase() : '';
  const filteredCommands = useMemo(
    () => COMMAND_CHIPS.filter((c) => c.slice(1).toLowerCase().startsWith(commandQuery)),
    [commandQuery]
  );

  useEffect(() => {
    if (!showCommandMenu) {
      setCommandMenuOpen(false);
      return;
    }
    setCommandMenuOpen(true);
    setCommandMenuActiveIndex(0);
  }, [showCommandMenu]);

  useEffect(() => {
    setCommandMenuActiveIndex((i) => Math.min(i, Math.max(0, filteredCommands.length - 1)));
  }, [filteredCommands.length]);

  const selectCommandFromMenu = (cmd) => {
    setInput(cmd + ' ');
    setCommandMenuOpen(false);
    setTimeout(() => copilotInputRef.current?.focus(), 0);
  };

  const handleCopilotKeyDown = (e) => {
    if (commandMenuOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandMenuActiveIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandMenuActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectCommandFromMenu(filteredCommands[commandMenuActiveIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandMenuOpen(false);
        setInput((s) => s.replace(/\/[^/]*$/, ''));
        return;
      }
    }
    if (e.key === 'Enter') sendMessage();
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
    setError('');
    setCopilotView('chat');
    setQuizQuestionsFromApi([]);
    setQuizQuestionIndex(0);
    setQuizTopic('');
    if (activeConversationId) {
      setConversations((prev) => prev.filter((c) => c.id !== activeConversationId));
      setActiveConversationId(null);
    }
  };

  const newChat = () => {
    if (messages.length > 0) {
      const firstUser = messages.find((m) => m.role === 'user')?.content?.trim?.() || '';
      const title = firstUser ? (firstUser.slice(0, 36) + (firstUser.length > 36 ? '…' : '')) : 'New chat';
      const newConv = {
        id: String(Date.now()),
        title,
        messages: [...messages],
        updatedAt: new Date().toISOString(),
      };
      setConversations((prev) => [newConv, ...prev].slice(0, MAX_CONVERSATIONS));
    }
    setMessages([]);
    setInput('');
    setError('');
    setActiveConversationId(null);
    setCopilotView('chat');
    setQuizData(null);
    setTimeout(() => copilotInputRef.current?.focus(), 0);
  };

  const switchToConversation = (conv) => {
    setMessages(conv.messages || []);
    setActiveConversationId(conv.id);
    setCopilotView('chat');
    setQuizData(null);
    setError('');
    setTimeout(() => copilotInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      assignments.list(userId),
      tasksApi.list(userId),
      notifications.list(userId),
      user.getPreferences(userId).catch(() => ({ widgets: '[]' })),
    ]).then(([a, t, n, prefs]) => {
      setAssignmentsList(a);
      setTaskList(t);
      setNotifs(n);
      if (prefs.widgets != null) {
        try {
          const w = JSON.parse(prefs.widgets);
          if (Array.isArray(w)) setWidgets(w);
        } catch {}
      }
    }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY(userId));
      const list = JSON.parse(raw || '[]');
      if (Array.isArray(list)) setConversations(list.slice(0, MAX_CONVERSATIONS));
    } catch {
      setConversations([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || conversations.length === 0) return;
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY(userId), JSON.stringify(conversations));
    } catch {}
  }, [userId, conversations]);

  useEffect(() => {
    if (activeConversationId == null) return;
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === activeConversationId);
      if (!conv) return prev;
      const updated = prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, messages: [...messages], updatedAt: new Date().toISOString() }
          : c
      );
      return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
  }, [activeConversationId, messages]);

  const buildStreamPayload = (userMsg) => ({
    userId,
    messages: [...messages, userMsg],
    ...(activeDocument?.noteId ? { noteId: activeDocument.noteId, attachments: [activeDocument.noteId], useRag: true } : {}),
  });

  const sendMessage = async (commandOverride = null) => {
    const raw = commandOverride ?? input.trim();
    if (!raw) return;
    if (!raw.startsWith('/')) {
      setError('');
      return;
    }
    if (!canUseCopilot) {
      setError('Daily copilot limit reached. Upgrade to Elite for unlimited prompts.');
      return;
    }
    const isQuizCommand = raw.trim().toLowerCase().startsWith('/quiz');
    if (isQuizCommand) {
      setCopilotView('quiz');
      setQuizQuestionsFromApi([]);
      setQuizQuestionIndex(0);
      setQuizTopic(raw.replace(/^\/quiz\s*/i, '').trim() || 'General study topic');
    } else {
      setCopilotView('chat');
    }
    const userMsg = { role: 'user', content: raw };
    setMessages((m) => [...m, userMsg]);
    if (!commandOverride) setInput('');
    setLoading(true);
    setError('');
    setMessages((m) => [...m, { role: 'assistant', reply: '', suggestions: [], streaming: true }]);
    try {
      let fullReply = '';
      let suggestions = [];
      let structured = null;
      let citations = [];
      for await (const event of copilot.chatStream(buildStreamPayload(userMsg))) {
        if (event.type === 'chunk' && event.text) {
          fullReply += event.text;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, reply: fullReply, streaming: true };
            return next;
          });
        } else if (event.type === 'suggestions' && Array.isArray(event.suggestions)) {
          suggestions = event.suggestions;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, reply: fullReply, suggestions, streaming: false };
            return next;
          });
        } else if (event.type === 'structured') {
          structured = event.structured;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, structured };
            return next;
          });
          if (structured?.questions?.length) {
            const normalized = structured.questions.map(normalizeQuizQuestion);
            setQuizQuestionsFromApi(normalized);
            setQuizQuestionIndex(0);
            if (structured.topic) setQuizTopic(structured.topic);
            setCopilotView('quiz');
          }
        } else if (event.type === 'citations' && Array.isArray(event.citations)) {
          citations = event.citations;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, citations };
            return next;
          });
        } else if (event.type === 'error') {
          setError(event.message || 'Stream error');
        } else if (event.type === 'done') {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false, ...(structured != null && { structured }), ...(citations.length > 0 && { citations }) };
            return next;
          });
        }
      }
      incrementCopilotUsage();
    } catch (err) {
      setError(err.message);
      setMessages((m) => m.filter((msg) => !(msg.role === 'assistant' && msg.streaming)));
    } finally {
      setLoading(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (!file || !userId) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type?.toLowerCase())) {
      setUploadError('Only PDF, PNG, and JPG are allowed.');
      return;
    }
    setUploadLoading(true);
    setUploadError('');
    try {
      const res = await docs.ingest(userId, file, file.name || '');
      setActiveDocument({ noteId: res.noteId, title: res.title || file.name });
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAcceptSuggestion = async (id) => {
    if (!userId) return;
    setError('');
    try {
      await copilot.acceptSuggestion(id, userId);
      setMessages((m) =>
        m.map((msg) =>
          msg.role === 'assistant' && msg.suggestions
            ? { ...msg, suggestions: msg.suggestions.filter((s) => s.id !== id) }
            : msg
        )
      );
      const list = await assignments.list(userId);
      setAssignmentsList(list);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectSuggestion = async (id) => {
    if (!userId) return;
    setError('');
    try {
      await copilot.rejectSuggestion(id, userId);
      setMessages((m) =>
        m.map((msg) =>
          msg.role === 'assistant' && msg.suggestions
            ? { ...msg, suggestions: msg.suggestions.filter((s) => s.id !== id) }
            : msg
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const addAssignment = async (e) => {
    e?.preventDefault();
    if (!newAssignment.title?.trim()) return;
    setError('');
    try {
      const created = await assignments.create({
        userId,
        title: newAssignment.title.trim(),
        dueDate: newAssignment.dueDate || null,
        difficulty: newAssignment.difficulty || null,
        notes: newAssignment.notes?.trim() || null,
      });
      setAssignmentsList((prev) => [created, ...prev]);
      setNewAssignment({ title: '', dueDate: '', difficulty: 'medium', notes: '' });
      setAssignmentModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const addPersonalTask = async (e) => {
    e?.preventDefault();
    if (!newTaskTitle?.trim()) return;
    setError('');
    try {
      const created = await tasksApi.create({
        userId,
        title: newTaskTitle.trim(),
        dueDate: newTaskDue || null,
      });
      setTaskList((prev) => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskDue('');
      setTaskModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const completeTaskItem = async (id) => {
    try {
      await tasksApi.complete(id);
      setTaskList((prev) => prev.map((t) => (t.id === id ? { ...t, completed: 1 } : t)));
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTaskItem = async (id) => {
    try {
      await tasksApi.delete(id);
      setTaskList((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const completeTask = async (id, difficulty, comment) => {
    setError('');
    try {
      await assignments.complete(id, { difficulty, comment });
      setAssignmentsList((t) => t.map((x) => (x.id === id ? { ...x, completed: 1, completedAt: new Date().toISOString() } : x)));
      setCompleteModal(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const leftWidgets = widgets.filter((w) => w === 'notifications' || w === 'tasks');
  const centerCopilot = widgets.includes('copilot');

  const cardBase = 'rounded-xl border border-gray-200 dark:border-violet-500/20 bg-gray-50 dark:bg-[#16161d]/90 backdrop-blur-sm transition-all duration-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.08)]';
  const cardTitle = 'text-gray-900 dark:text-white font-semibold text-base';
  const cardMuted = 'text-gray-800 dark:text-gray-400 text-sm';

  const quickActions = [
    { label: 'New Event', to: '/calendar', Icon: CalendarPlus },
    { label: 'Add Assignment', onClick: () => setAssignmentModal(true), Icon: CirclePlus },
    { label: 'Take Notes', to: '/notes', Icon: FileText },
    { label: 'Start Quiz', to: '/quiz', Icon: HelpCircle },
  ];
  const upcomingItems = [
    ...assignmentsList.filter((a) => !a.completed && a.dueDate).slice(0, 3).map((a) => ({ type: 'assignment', title: a.title, due: a.dueDate })),
    ...taskList.filter((t) => !t.completed && t.dueDate).slice(0, 3).map((t) => ({ type: 'task', title: t.title, due: t.dueDate })),
  ].sort((a, b) => (a.due || '').localeCompare(b.due || '')).slice(0, 5);

  const currentQuiz = quizQuestionsFromApi[quizQuestionIndex] ?? { question: '', options: [], correctIndex: 0, explanation: '' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-6 p-6 min-h-full bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white transition-colors duration-200">
      <div className="space-y-4 order-2 lg:order-1">
        {leftWidgets.includes('notifications') && (
          <div className={`${cardBase} p-4`}>
            <h3 className={`${cardTitle} flex items-center gap-2 mb-3`}><Bell className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />Notifications</h3>
            <ul className="space-y-2 text-sm">
              {notifs.length === 0 && <li className={cardMuted}>No new notifications</li>}
              {notifs.slice(0, 5).map((n) => (
                <li key={n.id} className="text-gray-600 dark:text-gray-300"><strong className="text-gray-900 dark:text-white">{n.title}</strong><br /><span className={cardMuted}>{n.body}</span></li>
              ))}
            </ul>
          </div>
        )}
        <div className={`${cardBase} p-4`}>
          <h3 className={`${cardTitle} flex items-center gap-2 mb-3`}><Zap className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => {
              const Icon = action.Icon;
              return action.to ? (
                <Link key={action.label} to={action.to} className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-violet-500/20 text-gray-700 dark:text-gray-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_16px_rgba(139,92,246,0.12)] transition-all duration-200 text-sm group">
                  <Icon className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors" aria-hidden />
                  <span>{action.label}</span>
                </Link>
              ) : (
                <button key={action.label} type="button" onClick={action.onClick} className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-violet-500/20 text-gray-700 dark:text-gray-200 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:shadow-[0_0_16px_rgba(139,92,246,0.12)] transition-all duration-200 text-sm group">
                  <Icon className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors" aria-hidden />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {leftWidgets.includes('tasks') && (
          <>
            <div className={`${cardBase} p-4`}>
              <h3 className={`${cardTitle} mb-2`}>Assignments</h3>
              <p className={`${cardMuted} mb-3`}>Deadline, difficulty, and notes feed into your study schedule.</p>
              <button type="button" className="w-full py-2 px-3 rounded-lg bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-sm font-medium transition-all duration-200 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)]" onClick={() => setAssignmentModal(true)}>Add assignment</button>
              <ul className="mt-3 space-y-2">
                {assignmentsList.filter((a) => !a.completed).slice(0, 8).map((a) => (
                  <li key={a.id} className={`flex items-start gap-2 text-sm ${a.completed ? 'opacity-60' : ''}`}>
                    <input type="checkbox" checked={!!a.completed} onChange={() => !a.completed && setCompleteModal(a)} className="mt-1 rounded border-gray-500 bg-transparent text-violet-500 focus:ring-violet-500" />
                    <div className="min-w-0"><span className="text-gray-900 dark:text-white">{a.title}</span>{a.dueDate && <span className={`${cardMuted} block`}>Due {a.dueDate}</span>}{a.difficulty && <span className={`${cardMuted} ml-1`}>({a.difficulty})</span>}{a.comment && <p className={`${cardMuted} truncate`}>{a.comment.slice(0, 60)}{a.comment.length > 60 ? '…' : ''}</p>}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${cardBase} p-4`}>
              <h3 className={`${cardTitle} mb-2`}>Tasks</h3>
              <p className={`${cardMuted} mb-3`}>Personal tasks and auto-created “Work on…” from assignments.</p>
              <button type="button" className="w-full py-2 px-3 rounded-lg border border-violet-400/50 dark:border-violet-500/30 text-violet-700 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-500/10 text-sm transition-all duration-200" onClick={() => setTaskModal(true)}>Add personal task</button>
              <ul className="mt-3 space-y-2">
                {taskList.filter((t) => !t.completed).slice(0, 10).map((t) => (
                  <li key={t.id} className={`flex items-center gap-2 text-sm ${t.completed ? 'opacity-60' : ''}`}>
                    <input type="checkbox" checked={!!t.completed} onChange={() => !t.completed && completeTaskItem(t.id)} className="rounded border-gray-500 bg-transparent text-violet-500" />
                    <span className="text-gray-900 dark:text-white flex-1 min-w-0 truncate">{t.title}</span>
                    {t.dueDate && <span className={cardMuted}>({t.dueDate})</span>}
                    <button type="button" className="shrink-0 py-1 px-2 rounded text-xs border border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-violet-500/50 transition-colors" onClick={() => deleteTaskItem(t.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
      <div className="order-1 lg:order-2 min-w-0">
        {centerCopilot ? (
          <div className={`${cardBase} p-6 min-h-[420px] flex flex-col border-violet-400/30 dark:border-violet-500/30 shadow-[0_0_32px_rgba(139,92,246,0.06)]`}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 className={`${cardTitle} flex items-center gap-2 text-lg`}>
                <Bot className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />
                Study Copilot
                <span className="inline-flex w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" title="Online" aria-hidden />
              </h3>
              <div className="flex items-center gap-2">
                <button type="button" className="py-1.5 px-3 rounded-lg border border-gray-300 dark:border-violet-500/30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-violet-500/10 text-xs font-medium transition-all duration-200" onClick={clearChat} title="Clear messages">
                  Clear chat
                </button>
                <button type="button" className="py-1.5 px-3 rounded-lg border border-violet-400/50 dark:border-violet-500/30 text-violet-700 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-500/10 text-xs font-medium transition-all duration-200" onClick={newChat} title="Start new chat">
                  New chat
                </button>
              </div>
            </div>
            {conversations.length > 0 && (
              <div className="mb-3">
                <p className={`${cardMuted} text-xs mb-1.5`}>Recent (max {MAX_CONVERSATIONS})</p>
                <div className="flex flex-wrap gap-2">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => switchToConversation(conv)}
                      className={`py-1.5 px-3 rounded-lg text-left text-xs font-medium transition-all duration-200 max-w-[140px] truncate ${
                        activeConversationId === conv.id
                          ? 'bg-violet-500/25 dark:bg-violet-500/30 border border-violet-500/50 text-violet-800 dark:text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                          : 'bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-violet-500/20 text-gray-700 dark:text-gray-300 hover:border-violet-400/40 dark:hover:border-violet-500/40 hover:bg-violet-500/10 dark:hover:bg-violet-500/10'
                      }`}
                      title={conv.title || conv.updatedAt}
                    >
                      {conv.title || new Date(conv.updatedAt).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {plan === 'free' && copilotRemaining !== null && (
              <p className={`${cardMuted} mb-2`}>Daily prompts: {copilotRemaining} of {copilotLimit} left. <Link to="/pricing" className="text-violet-500 dark:text-violet-300 hover:text-violet-600 dark:hover:text-violet-200">Upgrade to Elite</Link> for unlimited.</p>
            )}
            {!canUseCopilot && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                You&apos;ve used all {copilotLimit} copilot prompts for today. <Link to="/pricing" className="underline">Upgrade to Elite</Link> for unlimited prompts.
              </div>
            )}
            <p className="text-gray-900 dark:text-white font-medium mb-1">Hi, I&apos;m your Study Copilot!</p>
            <p className={`${cardMuted} mb-4`}>Ask me anything about your studies, get quiz suggestions, or help with planning.</p>
            <div className="mb-4">
              <input type="file" ref={fileInputRef} accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={handleDocUpload} className="hidden" />
              <button type="button" className="py-2 px-3 rounded-lg border border-violet-400/50 dark:border-violet-500/30 text-violet-700 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-500/10 text-sm transition-all duration-200 mr-2" onClick={() => fileInputRef.current?.click()} disabled={!userId || uploadLoading}>
                {uploadLoading ? 'Uploading…' : 'Upload PDF / image'}
              </button>
              {uploadError && <span className="text-red-400 text-sm ml-2">{uploadError}</span>}
              {activeDocument && (
                <span className="inline-flex items-center gap-2 py-1 px-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 text-sm">
                  Uploaded: 1 — {activeDocument.title}
                  <button type="button" className="text-violet-500 dark:text-violet-400 hover:text-gray-900 dark:hover:text-white" onClick={() => setActiveDocument(null)}>Clear</button>
                </span>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {COMMAND_CHIPS.map((cmd) => (
                  <button key={cmd} type="button" className="py-1.5 px-2.5 rounded-lg border border-violet-400/50 dark:border-violet-500/30 text-violet-700 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-500/15 text-xs transition-all duration-200 disabled:opacity-50" onClick={() => { setInput(cmd + ' '); copilotInputRef.current?.focus(); }} disabled={!canUseCopilot || loading} title={`Insert ${cmd} — type your prompt and press Enter`}>
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[120px] space-y-4 mb-4">
              {copilotView === 'quiz' && quizQuestionsFromApi.length > 0 ? (
                <QuizCard
                  key={quizQuestionIndex}
                  question={currentQuiz.question}
                  options={currentQuiz.options}
                  correctIndex={currentQuiz.correctIndex}
                  explanation={currentQuiz.explanation}
                  currentIndex={quizQuestionIndex}
                  totalCount={quizQuestionsFromApi.length}
                  topic={quizTopic}
                  onNext={() => setQuizQuestionIndex((i) => Math.min(i + 1, quizQuestionsFromApi.length - 1))}
                  onGetMore={() => sendMessage('/quiz ' + (quizTopic || 'more questions'))}
                  onEndChat={clearChat}
                />
              ) : copilotView === 'quiz' && loading ? (
                <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <span className="inline-flex gap-1 mr-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  Loading quiz…
                </div>
              ) : (
                <>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`copilot-message-bubble rounded-xl px-4 py-3 text-sm max-w-[800px] ${
                    m.role === 'user'
                      ? 'ml-6 mr-2 bg-gradient-to-br from-violet-500/15 to-indigo-500/10 dark:from-violet-500/20 dark:to-indigo-500/15 border border-violet-400/30 dark:border-violet-500/30 shadow-sm'
                      : 'mr-6 ml-2 bg-white/80 dark:bg-[#16161d]/90 border border-gray-200 dark:border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.04)]'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="copilot-bubble-text text-gray-800 dark:text-gray-100">{m.content}</p>
                  ) : (
                    <>
                      {m.streaming && !m.reply ? (
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-2">
                          <span className="inline-flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                          <span>Thinking…</span>
                        </div>
                      ) : (m.reply || (m.structured && structuredToMarkdown(m.structured))) ? (
                        <MarkdownMessage
                          content={[
                            m.reply ? formatCopilotContent(m.reply) : '',
                            m.structured ? structuredToMarkdown(m.structured) : '',
                          ].filter(Boolean).join('\n\n')}
                        />
                      ) : null}
                      {m.citations && m.citations.length > 0 && <div className={`${cardMuted} mt-2`}><strong>Sources:</strong> {m.citations.map((c, i) => <span key={i} title={c.content}>[{c.id}] </span>)}</div>}
                      {m.explanation && <p className={`${cardMuted} mt-2`}>{m.explanation}</p>}
                      {m.confidence != null && <p className={`${cardMuted} mt-1`}>Confidence: {(m.confidence * 100).toFixed(0)}%</p>}
                      {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {m.suggestions.map((s) => (
                            <div key={s.id} className="p-3 rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-violet-500/10">
                              <div className="text-violet-600 dark:text-violet-300 font-medium text-xs">{s.type}</div>
                              <div className="text-gray-600 dark:text-gray-300 text-sm">{s.label || s.type}</div>
                              <div className="flex gap-2 mt-2">
                                <button type="button" className="py-1.5 px-3 rounded-lg border border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs transition-colors" onClick={() => handleRejectSuggestion(s.id)}>Reject</button>
                                <button type="button" className="py-1.5 px-3 rounded-lg bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-xs transition-all duration-200 hover:shadow-[0_0_12px_rgba(139,92,246,0.4)]" onClick={() => handleAcceptSuggestion(s.id)}>Accept</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} aria-hidden />
                </>
              )}
            </div>
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            {input.trim() && !input.trim().startsWith('/') && (
              <p className={`${cardMuted} mb-2`}>
                Commands start with /. Type / to open the command menu, or click a chip above to paste a command and add your prompt.
              </p>
            )}
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <CommandMenu
                  open={commandMenuOpen && filteredCommands.length > 0}
                  filteredCommands={filteredCommands}
                  activeIndex={commandMenuActiveIndex}
                  onSelect={selectCommandFromMenu}
                  onClose={() => setCommandMenuOpen(false)}
                  listRef={commandMenuListRef}
                />
                <input
                  ref={copilotInputRef}
                  type="text"
                  className="w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-violet-500/30 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleCopilotKeyDown}
                  onBlur={() => setTimeout(() => setCommandMenuOpen(false), 150)}
                  placeholder="Type / for commands, or paste a command and add your prompt…"
                  disabled={!canUseCopilot}
                  aria-autocomplete="list"
                  aria-expanded={commandMenuOpen}
                  aria-controls="copilot-command-list"
                  aria-activedescendant={commandMenuOpen && filteredCommands.length > 0 ? `cmd-${commandMenuActiveIndex}` : undefined}
                />
              </div>
              <button type="button" className="py-2.5 px-5 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50 min-w-[88px] flex items-center justify-center gap-2" onClick={() => sendMessage()} disabled={loading || !canUseCopilot}>
                {loading ? (
                  <>
                    <span className="inline-flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce" style={{ animationDelay: '120ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce" style={{ animationDelay: '240ms' }} />
                    </span>
                    <span>Sending…</span>
                  </>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className={`${cardBase} p-6 min-h-[320px] flex flex-col items-center justify-center border border-dashed border-gray-300 dark:border-violet-500/30 bg-gray-50/50 dark:bg-[#16161d]/50`}>
            <Bot className="w-12 h-12 text-gray-400 dark:text-violet-500/50 mb-3" aria-hidden />
            <p className={`${cardTitle} mb-1`}>Study Copilot</p>
            <p className={`${cardMuted} mb-4 text-center max-w-xs`}>This widget is hidden. Enable it in Settings → Widget toggles to use the Copilot here.</p>
            <Link to="/settings" className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-sm font-medium transition-all duration-200">Open Settings</Link>
          </div>
        )}
      </div>
      <div className="order-3">
        <div className={`${cardBase} p-4 sticky top-6`}>
          <h3 className={`${cardTitle} flex items-center gap-2 mb-2`}><Calendar className="w-5 h-5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden />Upcoming</h3>
          {upcomingItems.length === 0 ? (
            <p className={`${cardMuted} mb-4`}>No upcoming tasks</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {upcomingItems.map((item, i) => (
                <li key={i} className={`text-sm ${cardMuted}`}>
                  <span className="text-gray-700 dark:text-gray-300">{item.title}</span>
                  {item.due && <span className="block text-xs mt-0.5">Due {item.due}</span>}
                </li>
              ))}
            </ul>
          )}
          <Link to="/calendar" className="block w-full py-2.5 px-4 rounded-xl bg-violet-500 hover:bg-violet-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white text-center text-sm font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]">Calendar &amp; schedule</Link>
        </div>
      </div>

      {assignmentModal && (
        <div className="modal-overlay" onClick={() => setAssignmentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add assignment</h3>
            <form onSubmit={addAssignment}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={newAssignment.title} onChange={(e) => setNewAssignment((a) => ({ ...a, title: e.target.value }))} placeholder="e.g. Math homework ch.3" required />
              </div>
              <div className="form-group">
                <label>Deadline (optional)</label>
                <input type="date" value={newAssignment.dueDate} onChange={(e) => setNewAssignment((a) => ({ ...a, dueDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Difficulty</label>
                <select value={newAssignment.difficulty} onChange={(e) => setNewAssignment((a) => ({ ...a, difficulty: e.target.value }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes / important info (optional)</label>
                <textarea value={newAssignment.notes} onChange={(e) => setNewAssignment((a) => ({ ...a, notes: e.target.value }))} placeholder="e.g. Focus on problem set 2" rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAssignmentModal(false)}>Cancel</button>
                <button type="submit" className="btn">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskModal && (
        <div className="modal-overlay" onClick={() => setTaskModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add personal task</h3>
            <form onSubmit={addPersonalTask}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g. Review notes" required />
              </div>
              <div className="form-group">
                <label>Due date (optional)</label>
                <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {completeModal && (
        <div className="modal-overlay" onClick={() => setCompleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mark complete: {completeModal.title}</h3>
            <p>Optional: rate difficulty and add a comment (AI suggests, you control).</p>
            <div className="form-group">
              <label>Difficulty</label>
              <select id="complete-difficulty">
                <option value="">—</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Comment</label>
              <input type="text" id="complete-comment" placeholder="Optional" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setCompleteModal(null)}>Cancel</button>
              <button type="button" className="btn" onClick={() => {
                const d = document.getElementById('complete-difficulty')?.value;
                const c = document.getElementById('complete-comment')?.value;
                completeTask(completeModal.id, d, c);
              }}>Accept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
