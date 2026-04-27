import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";
import { generateUUID } from "./utils";
import { useConfigStore } from "../store/configStore";
import { runWithTokenRetry } from "./tokenRetry";

// Token retry delegates to shared service
const runWithGoogleTokenRetry = <T>(
  operation: (token: string) => Promise<T>,
): Promise<T> => {
  return runWithTokenRetry(
    "google",
    operation as (token: string | null) => Promise<T>,
  );
};

export const generateGoogleImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  steps?: number,
  enableHD: boolean = false,
  guidanceScale?: number,
  base64Image?: string | string[],
): Promise<GeneratedImage> => {
  return runWithGoogleTokenRetry(async (token) => {
    try {
      const { googleConfig } = useConfigStore.getState();
      const apiUrl =
        googleConfig.apiUrl ||
        "https://generativelanguage.googleapis.com/v1beta/models";

      const actualModel = model === "default" ? googleConfig.modelId : model;
      const endpoint = `${apiUrl.replace(/\/$/, "")}/${actualModel}:generateContent`;

      const imageArray = Array.isArray(base64Image)
        ? base64Image
        : base64Image
          ? [base64Image]
          : [];

      const enhancedPrompt =
        imageArray.length > 0
          ? `Please edit the provided image according to these instructions: ${prompt}`
          : `Please generate an image based on these instructions: ${prompt}`;

      const parts: any[] = [{ text: enhancedPrompt }];

      for (const img of imageArray) {
        // extract the base64 data regardless of what the MIME type claims to be
        const mimeTypeMatch = img.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
        const base64Data = img.replace(/^data:[^;]*;base64,/, "");

        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        });
      }

      const requestBody: any = {
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      };

      if (enableHD) {
        requestBody.generationConfig.imageConfig.imageSize = "2K";
      }

      const response = await fetch(`${endpoint}?key=${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error?.message || `Google API Error: ${response.status}`,
        );
      }

      const data = await response.json();

      const candidates = data.candidates || [];
      if (candidates.length === 0) {
        throw new Error("error_invalid_response");
      }

      const responseParts = candidates[0].content?.parts || [];
      let base64Result = "";

      for (const part of responseParts) {
        if (part.inlineData && part.inlineData.data) {
          base64Result = part.inlineData.data;
          break;
        } else if (part.inline_data && part.inline_data.data) {
          base64Result = part.inline_data.data;
          break;
        }
      }

      if (!base64Result) {
        throw new Error("error_invalid_response");
      }

      const imageUrl = `data:image/png;base64,${base64Result}`;

      return {
        id: generateUUID(),
        url: imageUrl,
        model,
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed: seed,
        steps: steps,
        guidanceScale,
        provider: "google",
      };
    } catch (error) {
      console.error("Google Image Generation Error:", error);
      throw error;
    }
  });
};
