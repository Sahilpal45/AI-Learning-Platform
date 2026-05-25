const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const auth = require('../middleware/auth');
const Book = require('../models/Book');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  }
});

const COVER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
];

// Upload PDF
router.post('/upload', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Book title is required' });

    let extractedText = '';
    let pageCount = 0;

    try {
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text.substring(0, 50000);
      pageCount = pdfData.numpages;
    } catch (parseErr) {
      console.error('PDF parse error:', parseErr);
      extractedText = 'PDF text could not be extracted. The file may be scanned or image-based.';
    }

    const randomColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];

    const book = await Book.create({
      user: req.user._id,
      title: title.trim(),
      fileName: req.file.originalname,
      fileSize: req.file.size,
      pageCount,
      extractedText,
      coverColor: randomColor,
      status: 'ready'
    });

    res.status(201).json({
      message: 'Book uploaded successfully',
      book: {
        _id: book._id,
        title: book.title,
        fileName: book.fileName,
        fileSize: book.fileSize,
        pageCount: book.pageCount,
        coverColor: book.coverColor,
        status: book.status,
        createdAt: book.createdAt
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (err.message === 'Only PDF files are allowed')
      return res.status(400).json({ error: err.message });
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ error: 'File size exceeds 20MB limit' });
    res.status(500).json({ error: 'Failed to upload book' });
  }
});

// Get all books
router.get('/', auth, async (req, res) => {
  try {
    const books = await Book.find({ user: req.user._id })
      .select('-extractedText -chatHistory')
      .sort({ createdAt: -1 });
    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get single book
router.get('/:id', auth, async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, user: req.user._id })
      .select('-extractedText');
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Delete book
router.delete('/:id', auth, async (req, res) => {
  try {
    const book = await Book.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Book deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Clear chat history
router.delete('/:id/chat', auth, async (req, res) => {
  try {
    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { chatHistory: [] } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Chat history cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear chat' });
  }
});

module.exports = router;