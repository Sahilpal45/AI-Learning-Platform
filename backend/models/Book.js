const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const bookSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { type: String, required: true, trim: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  pageCount: { type: Number, default: 0 },
  extractedText: { type: String, default: '' },
  summary: { type: String, default: '' },
  topics: [{ type: String }],
  chatHistory: [chatMessageSchema],
  quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  totalChats: { type: Number, default: 0 },
  coverColor: { type: String, default: '#6366f1' },
  status: {
    type: String,
    enum: ['processing', 'ready', 'error'],
    default: 'processing'
  }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);