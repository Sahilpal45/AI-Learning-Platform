const express = require("express");
const router = express.Router();
require('dotenv').config(); 
// Make sure this is above your router imports!
const OpenAI = require("openai");

const auth = require("../middleware/auth");
const Book = require("../models/Book");
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

// Chat with book
router.post("/chat/:bookId", auth, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const book = await Book.findOne({
      _id: req.params.bookId,
      user: req.user._id,
    });

    if (!book) {
      return res.status(404).json({
        error: "Book not found",
      });
    }

    const textPreview = book.extractedText
      ? book.extractedText.substring(0, 5000)
      : "No text available";

    const systemPrompt = `
You are an expert AI tutor.

You have read the book "${book.title}".

Book content:
${textPreview}

Answer questions clearly and accurately.
Use markdown formatting.
`;

    if (!book.chatHistory) {
      book.chatHistory = [];
    }

    const recentHistory = book.chatHistory.slice(-10);

    const conversationMessages = [
      ...recentHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),

      {
        role: "user",
        content: message,
      },
    ];

    const aiResponse = await callAI(
      systemPrompt,
      conversationMessages,
      1200
    );

    book.chatHistory.push({
      role: "user",
      content: message,
    });

    book.chatHistory.push({
      role: "assistant",
      content: aiResponse,
    });

    book.totalChats = (book.totalChats || 0) + 1;

    if (book.chatHistory.length > 100) {
      book.chatHistory =
        book.chatHistory.slice(-100);
    }

    await book.save();

    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        totalQuestionsAsked: 1,
      },

      $set: {
        lastActive: new Date(),
      },
    });

    res.json({
      response: aiResponse,
      chatHistory: book.chatHistory.slice(-20),
    });
  } catch (err) {
    console.error("Chat error:", err);

    res.status(500).json({
      error:
        err.message ||
        "Failed to get AI response",
    });
  }
});

// Generate summary
router.post("/summary/:bookId", auth, async (req, res) => {
  try {
    const book = await Book.findOne({
      _id: req.params.bookId,
      user: req.user._id,
    });

    if (!book) {
      return res.status(404).json({
        error: "Book not found",
      });
    }

    // Return cached summary
    if (book.summary) {
      return res.json({
        summary: book.summary,
        topics: book.topics || [],
        takeaways: book.takeaways || [],
      });
    }

    // Validate extracted text
    const extractedText = (book.extractedText || "").trim();

    if (!extractedText || extractedText.length < 50) {
      return res.status(400).json({
        error:
          "This PDF appears to be scanned/image-based. Text extraction failed. Please use OCR before generating summary.",
      });
    }

    // Use larger preview
    const textPreview = extractedText.substring(0, 8000);

    const messages = [
      {
        role: "user",
        content: `
Analyze the book "${book.title}".

Return ONLY valid JSON.

{
  "summary": "Detailed summary",
  "topics": ["topic1", "topic2"],
  "takeaways": ["takeaway1"]
}

Book Content:
${textPreview}
`,
      },
    ];

    const response = await callAI(
      "You are an expert book analyst. Return only valid JSON.",
      messages,
      2000
    );

    let parsed;

    try {
      const cleaned = response
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("JSON Parse Error:", err);

      parsed = {
        summary: response,
        topics: [],
        takeaways: [],
      };
    }

    // Save to DB
    book.summary = parsed.summary || "No summary generated";
    book.topics = parsed.topics || [];
    book.takeaways = parsed.takeaways || [];

    await book.save();

    res.json({
      summary: book.summary,
      topics: book.topics,
      takeaways: book.takeaways,
    });
  } catch (err) {
    console.error("Summary error:", err);

    res.status(500).json({
      error: err.message || "Failed to generate summary",
    });
  }
});

// Explain topic
router.post(
  "/explain/:bookId",
  auth,
  async (req, res) => {
    try {
      const { topic } = req.body;

      if (!topic?.trim()) {
        return res.status(400).json({
          error: "Topic is required",
        });
      }

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
        ) || "";

      const messages = [
        {
          role: "user",

          content: `
Based on "${book.title}",
explain this topic:

"${topic}"

Book content:
${textPreview}

Include:
- clear explanation
- key concepts
- analogies
- related topics

Use markdown formatting.
`,
        },
      ];

      const explanation = await callAI(
        "You are an expert educator.",
        messages,
        1200
      );

      res.json({
        explanation,
        topic,
      });
    } catch (err) {
      console.error(
        "Explain error:",
        err
      );

      res.status(500).json({
        error:
          err.message ||
          "Failed to explain topic",
      });
    }
  }
);

module.exports = router;