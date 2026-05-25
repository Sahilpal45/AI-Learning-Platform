const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
  explanation: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
});

const attemptSchema = new mongoose.Schema({
  answers: [{ type: Number }],
  score: { type: Number, required: true },
  percentage: { type: Number, required: true },
  timeTaken: { type: Number, default: 0 },
  completedAt: { type: Date, default: Date.now }
});

const quizSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { type: String, required: true },
  topic: { type: String, default: 'General' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'mixed' },
  questions: [questionSchema],
  attempts: [attemptSchema],
  bestScore: { type: Number, default: 0 },
  totalAttempts: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);