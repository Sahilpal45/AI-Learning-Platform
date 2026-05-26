import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState(null);
  const [startTime] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchQuiz(); }, [id]);

  const fetchQuiz = async () => {
    try {
      const res = await api.get(`/quiz/${id}`);
      setQuiz(res.data.quiz);
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const selectOption = idx => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
  };

  const nextQuestion = () => {
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setSelected(null);
    setRevealed(false);

    if (current + 1 < quiz.questions.length) {
      setCurrent(c => c + 1);
    } else {
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async finalAnswers => {
    setSubmitting(true);
    try {
      const timeTaken = Math.round((Date.now() - startTime) / 1000);
      const res = await api.post(`/quiz/${id}/attempt`, { answers: finalAnswers, timeTaken });
      setResults(res.data);
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !quiz) return (
    <div className="loading-screen">
      <div className="loading-logo">LearnAI</div>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  const question = quiz.questions[current];
  const progress = (current / quiz.questions.length) * 100;
  const optionLetters = ['A', 'B', 'C', 'D'];

  // Results screen
  if (results) {
    const pct = results.percentage;
    const radius = 75;
    const circumference = 2 * Math.PI * radius;
    const dashoffset = circumference - (pct / 100) * circumference;
    const ringColor = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

    return (
      <div className="quiz-page">
        <nav className="navbar">
          <span className="navbar-logo">⚡ LearnAI</span>
        </nav>
        <div className="quiz-page-inner" style={{ marginTop: 40 }}>
          <div className="results-card">
            <div className="results-score-ring">
  <svg width="190" height="190" viewBox="0 0 190 190">
    <circle
      cx="95"
      cy="95"
      r={radius}
      fill="none"
      stroke="var(--bg-elevated)"
      strokeWidth="14"
    />

    <circle
      cx="95"
      cy="95"
      r={radius}
      fill="none"
      stroke={ringColor}
      strokeWidth="14"
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={dashoffset}
      style={{ transition: 'stroke-dashoffset 1s ease' }}
    />
  </svg>

  <div className="results-score-text">
    <div
      className="results-percentage"
      style={{ color: ringColor, fontSize: '2.5rem' }}
    >
      {pct}%
    </div>

    <div className="results-label">Score</div>
  </div>
</div>

            <h2 className="results-title" style={{color:'blue'}}>{results.message}</h2>
            <p className="results-subtitle">
              You scored {results.score} out of {results.totalQuestions}
            </p>

            <div className="results-breakdown">
              <div className="breakdown-item">
                <div className="breakdown-value" style={{ color: 'var(--accent-green)' }}>
                  {results.results?.filter(r => r.isCorrect).length}
                </div>
                <div className="breakdown-key">Correct</div>
              </div>
              <div className="breakdown-item">
                <div className="breakdown-value" style={{ color: 'var(--accent-red)' }}>
                  {results.results?.filter(r => !r.isCorrect).length}
                </div>
                <div className="breakdown-key">Wrong</div>
              </div>
              <div className="breakdown-item">
                <div className="breakdown-value" style={{ color: 'var(--accent-gold)' }}>
                  {results.bestScore}%
                </div>
                <div className="breakdown-key">Best Score</div>
              </div>
            </div>

            {/* Answer Review */}
            <div style={{ textAlign: 'left', marginBottom: 32 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16, fontSize: '1rem' }}>
                Review Answers
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {results.results?.map((r, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${r.isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '16px'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>
                      {r.isCorrect ? '✅' : '❌'} Q{i + 1}: {r.question}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Your answer: {r.userAnswer !== undefined ? r.options?.[r.userAnswer] : 'Not answered'}
                    </div>
                    {!r.isCorrect && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-green)' }}>
                        Correct: {r.options?.[r.correctAnswer]}
                      </div>
                    )}
                    {r.explanation && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                        💡 {r.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setResults(null); setCurrent(0); setAnswers([]);
                  setSelected(null); setRevealed(false);
                }}
              >
                Retake Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz question screen
  return (
    <div className="quiz-page">
      <nav className="navbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Exit</button>
        <span className="navbar-logo">⚡ LearnAI</span>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {current + 1} / {quiz.questions.length}
        </div>
      </nav>

      <div className="quiz-page-inner" style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          {quiz.title}
        </div>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="quiz-question-card">
          <div className="quiz-question-num">Question {current + 1} of {quiz.questions.length}</div>
          <div className="quiz-question-text">{question.question}</div>

          <div className="quiz-options">
            {question.options.map((opt, i) => {
              let cls = 'quiz-option';
              if (revealed) {
                if (i === question.correctAnswer) cls += ' correct';
                else if (i === selected) cls += ' incorrect';
              } else if (i === selected) {
                cls += ' selected';
              }
              return (
                <button key={i} className={cls} onClick={() => selectOption(i)}>
                  <span className="option-letter">{optionLetters[i]}</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {revealed && question.explanation && (
            <div className="quiz-explanation">
              💡 <strong>Explanation:</strong> {question.explanation}
            </div>
          )}
        </div>

        <div className="quiz-nav">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {revealed && (selected === question.correctAnswer ? '✅ Correct!' : '❌ Incorrect')}
          </div>
          <button
            className="btn btn-primary"
            onClick={nextQuestion}
            disabled={selected === null || !revealed || submitting}
          >
            {submitting
              ? 'Submitting...'
              : current + 1 === quiz.questions.length
              ? 'Finish Quiz →'
              : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  );
}