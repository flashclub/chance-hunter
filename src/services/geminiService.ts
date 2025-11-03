import {
  GoogleGenAI,
  GenerateContentResponse,
  GroundingChunk,
} from "@google/genai";
import {
  GEMINI_TEXT_MODEL_NAME,
  LANGUAGES,
  GEMINI_IMAGE_MODEL,
} from "@/components/constants";

const API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error(
    "API_KEY for Gemini is not set. Please set the environment variable. App functionality will be limited."
  );
}

interface StreamCallbacks {
  onChunk: (textChunk: string) => void;
  onSources: (sources: GroundingChunk[]) => void;
  onComplete: (imageUrl?: string) => void;
  onError: (error: Error) => void;
}

export const streamArticleFromText = async (
  inputText: string,
  languageCode: string,
  callbacks: StreamCallbacks
): Promise<void> => {
  if (!ai) {
    callbacks.onError(
      new Error(
        "Gemini API client is not initialized. Please ensure the API_KEY environment variable is set."
      )
    );
    return;
  }

  const selectedLanguage = LANGUAGES.find((lang) => lang.code === languageCode);
  const languageName = selectedLanguage
    ? selectedLanguage.name
    : "the selected language";

  const systemInstruction = `You are an expert SEO content strategist and master blog writer. Your specialty is transforming baseline text into comprehensive, SEO-optimized, multi-module articles that are deeply informative and engaging. You leverage Google Search to enrich content with up-to-date information and diverse perspectives. Your writing must be human-like, authoritative, and structured for maximum readability and search engine visibility.

Key Requirements:
-   Content Structure: Divide the article into logical modules/sections. Each module should be 200-500 words.
-   Headings:
    -   Main Title: Start with \`# Main Article Title\` (derived from the core topic of the baseline text).
    -   Module Titles: Use \`## Module Title\` for each distinct section. These titles should be descriptive and keyword-rich.
    -   Subheadings within modules: Use \`### Subheading\` for further breakdown if necessary, also making them descriptive.
-   Content Style:
    -   Write in complete, well-formed paragraphs. Paragraphs should be focused and flow logically.
    -   Minimize the use of lists (bullet points or numbered lists); only use them if absolutely essential for clarity (e.g., a short sequence of steps or distinct items that cannot be naturally integrated into a paragraph). Prefer prose over lists.
    -   Maintain a professional, engaging, and informative tone suitable for the target audience.
    -   Incorporate keywords naturally and vary sentence structure.
-   SEO Focus:
    -   Identify primary and secondary keywords from the baseline text and the topic.
    -   Integrate these keywords strategically within headings (H1, H2, H3) and body content without keyword stuffing.
    -   Ensure content is original, valuable, provides depth, and answers potential user queries.
    -   Aim for a good information density.
-   Search Integration: Use the provided Google Search tool to gather background information, supporting data, current perspectives, and statistics. Cite these sources appropriately where the information is used (though the display of citations is handled by the UI based on returned groundingMetadata).
-   Language: Generate the entire article in the specified language.
`;

  const prompt = `
A user has provided the following baseline text and wants a comprehensive, SEO-friendly blog article written in ${languageName}.

Baseline Text:
---
${inputText}
---

Your mission is to:
1.  Analyze the baseline text to understand its core topic, key ideas, implicit questions, and target audience intent.
2.  Use Google Search to gather relevant, up-to-date background information, statistics, examples, diverse viewpoints, and supporting evidence related to this topic.
3.  Develop a multi-module blog article. Each module should explore a specific aspect of the topic in-depth, aiming for 200-500 words per module. Ensure smooth transitions between modules.
4.  The entire article MUST be written in **${languageName}**.
5.  Structure the article using Markdown as specified in the system instructions:
    *   One main \`# Article Title\` that is compelling and keyword-relevant.
    *   Multiple \`## Module Titles\` (one for each module), making them engaging and descriptive of the module's content.
    *   Use \`### Subheadings\` within modules if needed to organize content further.
6.  Focus on creating long-form, paragraph-based content. Strive for narrative flow and detailed explanations. Avoid lists unless absolutely necessary; if a list is used, it should be short and purposeful.
7.  Optimize the article for SEO:
    *   Identify and naturally integrate primary and related (LSI) keywords throughout the text, including headings and body.
    *   Ensure content is high-quality, original, authoritative, and provides substantial value to the reader.
    *   Craft an engaging introduction and a strong conclusion.
8.  CRITICAL: Do **NOT** mention "the baseline text," "the user's input," "based on the provided text," or that you are an AI. Present the article as an original, authoritative piece on the topic.
9.  Do **NOT** include any preamble like "Okay, here's the article:", "Here is your article:", or any conversational lead-in. Begin DIRECTLY with the main article title (\`# Main Article Title...\`).
10. Ensure the information from search results is integrated smoothly and adds value. You will provide the sources separately via groundingMetadata. Do not explicitly say "According to a search result..." in the text unless it's a direct quote attribution.

Generate the article now.
`;

  let sourcesProcessed = false;
  let imageUrl = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: GEMINI_TEXT_MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        tools: [{ googleSearch: {} }],
      },
    });
    try {
      const response = await ai.models.generateImages({
        model: GEMINI_IMAGE_MODEL,
        prompt: `A visually appealing image representing the blog post topic: "${inputText}". Style: professional, high quality.`,
        config: { numberOfImages: 1, outputMimeType: "image/jpeg" },
      });
      if (
        response.generatedImages &&
        response.generatedImages.length > 0 &&
        response.generatedImages[0].image?.imageBytes
      ) {
        const base64ImageBytes: string =
          response.generatedImages[0].image.imageBytes;
        imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
      }
    } catch (error) {
      console.error("Error generating image with Gemini:", error);
    }

    for await (const chunk of stream) {
      const chunkText = chunk.text;
      if (chunkText) {
        callbacks.onChunk(chunkText);
      }

      if (
        !sourcesProcessed &&
        chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
      ) {
        const currentSources =
          chunk.candidates[0].groundingMetadata.groundingChunks.filter(
            (c) => c.web && c.web.uri
          );
        if (currentSources.length > 0) {
          callbacks.onSources(currentSources);
          sourcesProcessed = true;
        }
      }
    }
    callbacks.onComplete(imageUrl);
  } catch (error) {
    console.error("Error streaming article with Gemini:", error);
    let errorMessage =
      "An unknown error occurred while generating the article.";
    if (error instanceof Error) {
      if (error.message.includes("API key not valid")) {
        errorMessage =
          "The Gemini API key is invalid or not configured correctly. Please check your environment setup.";
      } else if (error.message.toLowerCase().includes("quota")) {
        errorMessage =
          "You have exceeded your Gemini API quota. Please check your usage and limits.";
      } else if (
        error.message.toLowerCase().includes("finishreason: 5") ||
        error.message.toLowerCase().includes("safety")
      ) {
        errorMessage =
          "The content could not be generated due to safety settings or other content restrictions. Please modify your input text or topic.";
      } else if (
        error.message.toLowerCase().includes("tool calling") ||
        error.message.toLowerCase().includes("googleSearch")
      ) {
        errorMessage =
          "There was an issue with the Google Search integration. Please try again. If the problem persists, the search tool might be temporarily unavailable.";
      } else {
        errorMessage = `Failed to generate article due to an API error: ${error.message}`;
      }
    }
    callbacks.onError(new Error(errorMessage));
  }
};
