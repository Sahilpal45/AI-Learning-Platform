import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';

const formatBytes = b => {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', file: null });
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const fileRef = useRef();

  useEffect(() => { fetchBooks(); }, []);

  const fetchBooks = async () => {
    try {
      const res = await api.get('/books');
      setBooks(res.data.books);
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = file => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setUploadError('Only PDF files are allowed'); return; }
    if (file.size > 20 * 1024 * 1024) { setUploadError('File size exceeds 20MB'); return; }
    setUploadError('');
    const title = uploadForm.title || file.name.replace('.pdf', '');
    setUploadForm(f => ({ ...f, file, title }));
    setShowUpload(true);
  };

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUpload = async e => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title) {
      setUploadError('Please select a file and enter a title');
      return;
    }
    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('pdf', uploadForm.file);
    formData.append('title', uploadForm.title);
    try {
      await api.post('/books/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      setUploadForm({ title: '', file: null });
      fetchBooks();
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/books/${id}`);
      setBooks(b => b.filter(book => book._id !== id));
      setDeleteId(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const getInitials = name => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="dashboard">
      <nav className="navbar">
        <span className="navbar-logo">⚡ LearnAI</span>
        <div className="navbar-right">
          <div className="navbar-user">
            <div className="navbar-avatar">{getInitials(user?.name)}</div>
            <span className="navbar-name">{user?.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1 className="dashboard-greeting">
            Hello, <span>{user?.name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="dashboard-subtitle">Upload a book and start learning with AI assistance</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-value">{books.length}</div>
            <div className="stat-label">Books Uploaded</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💬</div>
            <div className="stat-value">{user?.totalQuestionsAsked || 0}</div>
            <div className="stat-label">Questions Asked</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-value">{user?.totalQuizzesTaken || 0}</div>
            <div className="stat-label">Quizzes Taken</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-value">{user?.streak || 0}</div>
            <div className="stat-label">Day Streak</div>
          </div>
        </div>

        <div className="section-header">
          <h2 className="section-title">My Library</h2>
          <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
            + Upload PDF
          </button>
        </div>

        <input
          ref={fileRef} type="file" accept=".pdf"
          style={{ display: 'none' }}
          onChange={e => handleFileSelect(e.target.files[0])}
        />

        {books.length === 0 && !loading ? (
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="upload-icon">📄</div>
            <div className="upload-text">Drop your PDF book here</div>
            <div className="upload-hint">or click to browse • Max 20MB</div>
          </div>
        ) : (
          <div className="books-grid">
            <div
              className="book-card"
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border-hover)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 32, gap: 12, minHeight: 220
              }}
            >
              <div style={{ fontSize: '2rem' }}>+</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                Upload new book
              </div>
            </div>

            {books.map(book => (
              <div key={book._id} className="book-card">
                <div
                  className="book-cover"
                  style={{ background: `linear-gradient(135deg, ${book.coverColor}22, ${book.coverColor}44)` }}
                >
                  <span>📖</span>
                </div>
                <div className="book-info" onClick={() => navigate(`/book/${book._id}`)}>
                  <div className="book-title">{book.title}</div>
                  <div className="book-meta">
                    <span>📄 {book.pageCount || '?'} pages</span>
                    <span>{formatBytes(book.fileSize)}</span>
                  </div>
                  <div className="book-meta" style={{ marginTop: 4 }}>
                    <span>{formatDate(book.createdAt)}</span>
                  </div>
                </div>
                <div className="book-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => navigate(`/book/${book._id}`)}
                  >
                    Open
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(book._id)}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => !uploading && setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Upload Book</h2>
            {uploadError && <div className="alert alert-error">{uploadError}</div>}
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Book Title</label>
                <input
                  className="form-input" type="text"
                  value={uploadForm.title}
                  onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Enter book title" required
                />
              </div>
              <div className="form-group">
                <label className="form-label">PDF File</label>
                <div style={{
                  padding: '16px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem', color: 'var(--text-secondary)'
                }}>
                  {uploadForm.file
                    ? `📄 ${uploadForm.file.name} (${formatBytes(uploadForm.file.size)})`
                    : 'No file selected'}
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button" className="btn btn-secondary"
                  onClick={() => setShowUpload(false)} disabled={uploading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading & processing...' : 'Upload Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Delete Book?</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              This will permanently delete the book and all associated chats and quizzes.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}