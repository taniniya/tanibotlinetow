require("dotenv").config();

const express = require("express");
const { messagingApi } = require("@line/bot-sdk");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;

// ==============================
// LINE設定
// ==============================

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken
});

// ==============================
// OpenRouter
// ==============================

async function askAI(message) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",

        messages: [
          {
            role: "system",
            content:
              "あなたはLINEグループで会話する親しみやすいAIです。日本語で自然に回答してください。長すぎる回答は避けてください。"
          },
          {
            role: "user",
            content: message
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error(
      "OpenRouter Error:",
      error.response?.data || error.message
    );

    return "AIとの通信中にエラーが発生しました。";
  }
}

// ==============================
// LINE Webhook
// ==============================

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {

    // LINEには即200を返す
    res.sendStatus(200);

    try {

      const body = JSON.parse(req.body.toString());

      for (const event of body.events || []) {

        if (
          event.type !== "message" ||
          event.message.type !== "text"
        ) {
          continue;
        }

        const text = event.message.text;

        // ==========================
        // /ai
        // ==========================

        if (!text.startsWith("/ai")) {
          continue;
        }

        const message = text
          .replace(/^\/ai\s*/, "")
          .trim();

        // /aiだけなら無反応
        if (!message) {
          continue;
        }

        console.log("AI:", message);

        const answer = await askAI(message);

        await client.replyMessage({
          replyToken: event.replyToken,

          messages: [
            {
              type: "text",
              text: answer
            }
          ]
        });
      }

    } catch (error) {
      console.error("Webhook Error:", error);
    }
  }
);

// ==============================
// Health Check
// ==============================

app.get("/", (req, res) => {
  res.send("LINE Bot is running!");
});

// ==============================
// Start
// ==============================

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
