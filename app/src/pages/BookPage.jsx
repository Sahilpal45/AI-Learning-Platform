import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth, api } from '../context/AuthContext';

const SUGGESTIONS = [
  'Summarize the main ideas',
  'What are the key concepts?',
  'Explain the most important topic',
  'Give me a study guide',
  'What should I focus on?'
];

export default function BookPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [quizForm, setQuizForm] = useState({ topic: '', difficulty: 'mixed', count: 5 });
  const [generating, setGenerating] = useState(false);
  const [quizError, setQuizError] = useState('');
  const messagesEndRef = useRef();

  useEffect(() => { fetchBook(); }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeTab === 'quiz') fetchQuizzes();
    if (activeTab === 'summary' && !summary) loadSummary();
  }, [activeTab]);

  const fetchBook = async () => {
    try {
      const res = await api.get(`/books/${id}`);
      const b = res.data.book;
      setBook(b);
      setMessages(b.chatHistory?.slice(-30) || []);
    } catch {
      navigate('/dashboard');
    }
  };

  const fetchQuizzes = async () => {
    try {
      const res = await api.get(`/quiz/book/${id}`);
      setQuizzes(res.data.quizzes);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await api.post(`/ai/summary/${id}`);
      setSummary(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const sendMessage = async msg => {
    const text = msg || input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setMessages(m => [...m, { role: 'user', content: text }]);
    try {
      const res = await api.post(`/ai/chat/${id}`, { message: text });
      setMessages(m => [...m, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: '❌ ' + (err.response?.data?.error || 'Failed to get response.')
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = async () => {
    try {
      await api.delete(`/books/${id}/chat`);
      setMessages([]);
    } catch (err) {
      console.error(err);
    }
  };

  const generateQuiz = async e => {
    e.preventDefault();
    if (!quizForm.topic) { setQuizError('Please enter a topic'); return; }
    setGenerating(true);
    setQuizError('');
    try {
      const res = await api.post(`/quiz/generate/${id}`, quizForm);
      navigate(`/quiz/${res.data.quiz._id}`);
    } catch (err) {
      setQuizError(err.response?.data?.error || 'Failed to generate quiz.');
      setGenerating(false);
    }
  };

  const getInitials = name => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  if (!book) return (
    <div className="loading-screen">
      <div className="loading-logo">LearnAI</div>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'summary', label: 'Summary', icon: '📋' },
    { id: 'quiz', label: 'Quizzes', icon: '🎯' }
  ];

  return (
    <div className="book-page">
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>← Back</button>
          <span className="navbar-logo">⚡ LearnAI</span>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{book.title}</div>
        <div className="navbar-user">
          <div className="navbar-avatar">{getInitials(user?.name)}</div>
          <span className="navbar-name">{user?.name}</span>
        </div>
      </nav>

      <div className="book-page-content">
        {/* Sidebar */}
        <aside className="book-sidebar">
          <div
            className="sidebar-book-cover"
            style={{ background: `linear-gradient(135deg, ${book.coverColor}22, ${book.coverColor}55)` }}
          >
            📖
          </div>
          <div className="sidebar-info">
            <div className="sidebar-title">{book.title}</div>
            <div className="sidebar-meta">{book.pageCount || '?'} pages</div>
          </div>
          <div className="sidebar-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="nav-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main>
          {/* CHAT */}
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="chat-header">
                <div className="chat-title">💬 Ask About This Book</div>
                {messages.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={clearChat}>Clear chat</button>
                )}
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">
                    <div className="chat-empty-icon">🤖</div>
                    <div className="chat-empty-title">AI Tutor Ready</div>
                    <p>Ask me anything about "{book.title}"</p>
                    <div className="chat-suggestion-chips">
                      {SUGGESTIONS.map(s => (
                        <button key={s} className="chip" onClick={() => sendMessage(s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`message message-${msg.role}`}>
                      <div className="message-avatar">
                        {msg.role === 'user' ? getInitials(user?.name) : '🤖'}
                      </div>
                      <div className="message-content">
                        {msg.role === 'assistant'
                          ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                          : msg.content}
                      </div>
                    </div>
                  ))
                )}

                {sending && (
                  <div className="message message-assistant">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content">
                      <div className="typing-indicator">
                        <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <div className="chat-input-row">
                  <textarea
                    className="chat-textarea"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about the book... (Enter to send)"
                    rows={1}
                    disabled={sending}
                  />
                  <button
                    className="chat-send-btn"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending}
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUMMARY */}
          {activeTab === 'summary' && (
            <div className="summary-section">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: 24 }}>
                📋 Book Summary
              </h2>

              {summaryLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <div className="loading-dots" style={{ justifyContent: 'center' }}>
                    <span /><span /><span />
                  </div>
                  <p style={{ marginTop: 16 }}>AI is analyzing your book...</p>
                </div>
              ) : summary ? (
                <div>
                  <div style={{ marginBottom: 32 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--accent-primary)' }}>
                      Overview
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>{summary.summary}</p>
                  </div>

                  {summary.topics?.length > 0 && (
                    <div style={{ marginBottom: 32 }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--accent-primary)' }}>
                        Key Topics
                      </h3>
                      <div className="topics-grid">
                        {summary.topics.map((t, i) => (
                          <span
                            key={i} className="topic-tag"
                            onClick={() => { setActiveTab('chat'); sendMessage(`Explain: ${t}`); }}
                            title="Click to ask about this topic"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.takeaways?.length > 0 && (
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--accent-primary)' }}>
                        Main Takeaways
                      </h3>
                      <ul style={{ color: 'var(--text-secondary)', paddingLeft: 20, lineHeight: 2 }}>
                        {summary.takeaways.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <p>Click below to generate a summary</p>
                  <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={loadSummary}>
                    Generate Summary
                  </button>
                </div>
              )}
            </div>
          )}

          {/* QUIZ */}
          {activeTab === 'quiz' && (
            <div className="quiz-section">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: 24 }}>
                🎯 Quizzes
              </h2>

              <div className="quiz-generate-form">
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16, fontSize: '1rem' }}>
                  Generate New Quiz
                </h3>
                {quizError && <div className="alert alert-error">{quizError}</div>}
                <form onSubmit={generateQuiz}>
                  <div className="quiz-form-grid">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Topic</label>
                      <input
                        className="form-input"
                        value={quizForm.topic}
                        onChange={e => setQuizForm(f => ({ ...f, topic: e.target.value }))}
                        placeholder="e.g. Chapter 1, Photosynthesis..."
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Difficulty</label>
                      <select
                        className="form-input"
                        value={quizForm.difficulty}
                        onChange={e => setQuizForm(f => ({ ...f, difficulty: e.target.value }))}
                      >
                        <option value="mixed">Mixed</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Count</label>
                      <input
                        className="form-input" type="number"
                        min={3} max={15} value={quizForm.count}
                        onChange={e => setQuizForm(f => ({ ...f, count: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button
                    type="submit" className="btn btn-primary"
                    style={{ marginTop: 16 }} disabled={generating}
                  >
                    {generating ? '⚡ Generating...' : '⚡ Generate Quiz'}
                  </button>
                </form>
              </div>

              {quizzes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <div className="empty-state-title">No quizzes yet</div>
                  <div className="empty-state-text">Generate your first quiz above</div>
                </div>
              ) : (
                <div className="quizzes-list">
                  {quizzes.map(quiz => (
                    <div key={quiz._id} className="quiz-item">
                      <div className="quiz-item-info">
                        <div className="quiz-item-title">{quiz.title}</div>
                        <div className="quiz-item-meta">
                          <span>🎯 {quiz.topic}</span>
                          <span>📊 {quiz.difficulty}</span>
                          <span>❓ {quiz.questions?.length || '?'} questions</span>
                          <span>Attempts: {quiz.totalAttempts}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {quiz.bestScore > 0 && (
                          <span className={`score-badge ${
                            quiz.bestScore >= 80 ? 'score-great'
                            : quiz.bestScore >= 60 ? 'score-ok'
                            : 'score-low'
                          }`}>
                            Best: {quiz.bestScore}%
                          </span>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/quiz/${quiz._id}`)}
                        >
                          {quiz.totalAttempts > 0 ? 'Retake' : 'Start'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}