import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY_INVESTMENT;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY_INVESTMENT environment variable");
}

export const openaiInvestment = new OpenAI({ apiKey });
