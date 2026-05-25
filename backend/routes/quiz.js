const express = require("express");
const router = express.Router();

const OpenAI = require("openai");

const auth = require("../middleware/auth");

const Book = require("../models/Book");
const Quiz = require("../models/Quiz");
const User = require("../models/User");

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const callAI = async (
  systemPrompt,
  messages,
  maxTokens = 1000
) => {
  try {
    const completion =
      await client.chat.completions.create({
        model:
          "deepseek/deepseek-chat",

        messages: [
          {
            role: "system",
            content: systemPrompt,
          },

          ...messages,
        ],

        max_tokens: maxTokens,
      });

    return (
      completion.choices[0].message.content ||
      "No response generated"
    );
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
};

// Generate Quiz
router.post(
  "/generate/:bookId",
  auth,
  async (req, res) => {
    try {
      const {
        topic = "General",
        difficulty = "mixed",
        count = 5,
      } = req.body;

      const book = await Book.findOne({
        _id: req.params.bookId,
        user: req.user._id,
      });

      if (!book) {
        return res.status(404).json({
          error: "Book not found",
        });
      }

      const textPreview =
        book.extractedText?.substring(
          0,
          5000
        ) || "No content available";

      const questionCount = Math.min(
        Math.max(parseInt(count) || 5, 3),
        15
      );

      const difficultyInstructions =
        difficulty === "mixed"
          ? "Mix easy, medium, and hard questions."
          : `Make all questions ${difficulty} difficulty.`;

      const messages = [
        {
          role: "user",

          content: `
Create a quiz about "${topic}" from the book "${book.title}".

${difficultyInstructions}

Generate exactly ${questionCount} multiple-choice questions.

Book Content:
${textPreview}

Return ONLY valid JSON.

{
  "title": "Quiz title",
  "questions": [
    {
      "question": "Question?",
      "options": [
        "A",
        "B",
        "C",
        "D"
      ],
      "correctAnswer": 0,
      "explanation": "Explanation",
      "difficulty": "easy"
    }
  ]
}
`,
        },
      ];

      const response = await callAI(
        "You are an expert quiz generator. Return only valid JSON.",
        messages,
        3000
      );

      let quizData;

      try {
        const cleaned = response
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const jsonMatch =
          cleaned.match(/\{[\s\S]*\}/);

        quizData = JSON.parse(
          jsonMatch
            ? jsonMatch[0]
            : cleaned
        );
      } catch (err) {
        console.log(
          "JSON Parse Error:",
          err
        );

        console.log(response);

        return res.status(500).json({
          error:
            "Failed to parse quiz data",
        });
      }

      if (!quizData.questions?.length) {
        return res.status(500).json({
          error:
            "No questions generated",
        });
      }

      const quiz = await Quiz.create({
        book: book._id,
        user: req.user._id,
        title:
          quizData.title ||
          `${topic} Quiz`,
        topic,
        difficulty,
        questions:
          quizData.questions,
      });

      await Book.findByIdAndUpdate(
        book._id,
        {
          $push: {
            quizzes: quiz._id,
          },
        }
      );

      res.status(201).json({
        quiz,
      });
    } catch (err) {
      console.error(
        "Quiz generation error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to generate quiz",
      });
    }
  }
);

// Get quizzes for book
router.get(
  "/book/:bookId",
  auth,
  async (req, res) => {
    try {
      const quizzes = await Quiz.find({
        book: req.params.bookId,
        user: req.user._id,
      })
        .select(
          "-questions.explanation"
        )
        .sort({ createdAt: -1 });

      res.json({ quizzes });
    } catch (err) {
      res.status(500).json({
        error:
          "Failed to fetch quizzes",
      });
    }
  }
);

// Get all quizzes
router.get(
  "/user/all",
  auth,
  async (req, res) => {
    try {
      const quizzes = await Quiz.find({
        user: req.user._id,
      })
        .populate(
          "book",
          "title coverColor"
        )
        .select("-questions")
        .sort({ createdAt: -1 })
        .limit(20);

      res.json({ quizzes });
    } catch (err) {
      res.status(500).json({
        error:
          "Failed to fetch quizzes",
      });
    }
  }
);

// Get single quiz
router.get("/:id", auth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!quiz) {
      return res.status(404).json({
        error: "Quiz not found",
      });
    }

    res.json({ quiz });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch quiz",
    });
  }
});

// Submit attempt
router.post(
  "/:id/attempt",
  auth,
  async (req, res) => {
    try {
      const {
        answers,
        timeTaken = 0,
      } = req.body;

      const quiz = await Quiz.findOne({
        _id: req.params.id,
        user: req.user._id,
      });

      if (!quiz) {
        return res.status(404).json({
          error: "Quiz not found",
        });
      }

      let correctCount = 0;

      const results =
        quiz.questions.map((q, i) => {
          const userAnswer =
            answers[i];

          const isCorrect =
            Number(userAnswer) ===
            Number(q.correctAnswer);

          if (isCorrect)
            correctCount++;

          return {
            question: q.question,
            userAnswer,
            correctAnswer:
              q.correctAnswer,
            isCorrect,
            explanation:
              q.explanation,
            options: q.options,
          };
        });

      const score = correctCount;

      const percentage = Math.round(
        (correctCount /
          quiz.questions.length) *
          100
      );

      quiz.attempts.push({
        answers,
        score,
        percentage,
        timeTaken,
      });

      quiz.totalAttempts += 1;

      if (
        percentage > quiz.bestScore
      ) {
        quiz.bestScore = percentage;
      }

      await quiz.save();

      await User.findByIdAndUpdate(
        req.user._id,
        {
          $inc: {
            totalQuizzesTaken: 1,
          },

          $set: {
            lastActive: new Date(),
          },
        }
      );

      res.json({
        score,
        percentage,
        totalQuestions:
          quiz.questions.length,

        results,

        bestScore: quiz.bestScore,

        message:
          percentage >= 80
            ? "Excellent work! 🎉"
            : percentage >= 60
            ? "Good job! Keep practicing."
            : "Keep studying and try again!",
      });
    } catch (err) {
      console.error(
        "Attempt error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to submit quiz",
      });
    }
  }
);

module.exports = router;