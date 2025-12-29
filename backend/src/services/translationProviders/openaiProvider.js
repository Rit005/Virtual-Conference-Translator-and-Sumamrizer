import OpenAI from "openai";

class OpenAIProvider {
  constructor(options = {}) {
    this.client = null;
    this.model = options.model || "gpt-4o-mini";
  }

  async initialize() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    this.client = new OpenAI({ apiKey });
    return true;
  }

  async translate(text, options = {}) {
    const {
      sourceLanguage = "auto",
      targetLanguage = "en"
    } = options;

    const prompt = `
Translate the following text from ${sourceLanguage} to ${targetLanguage}.
Return ONLY the translated text.

Text:
${text}
`;

    const response = await this.client.responses.create({
      model: this.model,
      input: prompt
    });

    return {
      translatedText: response.output_text,
      sourceLanguage,
      targetLanguage,
      confidence: 0.95
    };
  }

  getSupportedLanguages() {
    return [
      { code: "en", name: "English" },
      { code: "hi", name: "Hindi" },
      { code: "es", name: "Spanish" },
      { code: "fr", name: "French" }
    ];
  }
}

export default OpenAIProvider;
