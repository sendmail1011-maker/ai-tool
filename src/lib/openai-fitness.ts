import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY_FITNESS;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY_FITNESS environment variable");
}

export const openaiFitness = new OpenAI({ apiKey });
