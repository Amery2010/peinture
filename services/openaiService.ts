import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";
import { getDimensions } from "./dimensions";
import { generateUUID } from "./utils";
import { useConfigStore } from "../store/configStore";
import { runWithTokenRetry } from "./tokenRetry";

// Token retry delegates to shared service
const runWithOpenAITokenRetry = <T>(
  operation: (token: string) => Promise<T>,
): Promise<T> => {
  return runWithTokenRetry(
    "openai",
    operation as (token: string | null) => Promise<T>,
  );
};

export const generateOpenAIImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  steps?: number,
  enableHD: boolean = false,
  guidanceScale?: number,
  base64Image?: string | string[],
): Promise<GeneratedImage> => {
  return runWithOpenAITokenRetry(async (token) => {
    try {
      const { openaiConfig } = useConfigStore.getState();
      const apiUrl =
        openaiConfig.apiUrl || "https://api.openai.com/v1/responses";
      const actualModel = model === "default" ? openaiConfig.modelId : model;

      const { width, height } = getDimensions(aspectRatio, enableHD);
      const sizeString = `${width}x${height}`;

      const imageArray = Array.isArray(base64Image)
        ? base64Image
        : base64Image
          ? [base64Image]
          : [];
      const inputs: any[] = [];

      if (imageArray.length > 0) {
        const content: any[] = [
          {
            type: "input_text",
            text: `Please edit the provided image according to these instructions: ${prompt}`,
          },
        ];

        for (const img of imageArray) {
          let base64Data = img;
          if (!base64Data.startsWith("data:")) {
            base64Data = `data:image/png;base64,${base64Data}`;
          } else {
            base64Data = base64Data.replace(/^data:([^;]*);base64,/, (match, mimeType) => {
              if (!mimeType || !mimeType.startsWith("image/")) {
                return "data:image/png;base64,";
              }
              return match;
            });
          }

          content.push({
            type: "input_image",
            image_url: base64Data,
          });
        }

        inputs.push({
          role: "user",
          content: content,
        });
      } else {
        inputs.push({
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Please generate an image based on these instructions: ${prompt}`,
            },
          ],
        });
      }

      const requestBody = {
        model: actualModel,
        input: inputs,
        tools: [
          {
            type: "image_generation",
            image_generation: {
              size: sizeString,
            },
          },
        ],
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error?.message || `OpenAI API Error: ${response.status}`,
        );
      }

      const data = await response.json();

      let base64Result = "";

      // Look for the image generation result in the new Responses API output array
      const outputs = data.output || [];
      const imageGenerationCall = outputs.find(
        (o: any) => o.type === "image_generation_call",
      );

      if (imageGenerationCall && imageGenerationCall.result) {
        base64Result = imageGenerationCall.result;
      } else {
        // Fallback to older proxy formats or tool_calls format if still used
        const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
        const oldImageCall = toolCalls.find(
          (t: any) =>
            t.type === "image_generation_call" ||
            t.function?.name === "image_generation_call",
        );

        if (oldImageCall && oldImageCall.result) {
          base64Result = oldImageCall.result;
        } else if (
          data.imageGenerationCall &&
          data.imageGenerationCall[0]?.result
        ) {
          base64Result = data.imageGenerationCall[0].result;
        } else if (toolCalls.length > 0) {
          try {
            const args = JSON.parse(toolCalls[0].function?.arguments || "{}");
            if (args.result) base64Result = args.result;
            if (args.image) base64Result = args.image;
          } catch {
            // ignore
          }
        }
      }

      if (!base64Result) {
        console.error("Unrecognized OpenAI response format", data);
        throw new Error("error_invalid_response");
      }

      const imageUrl = `data:image/png;base64,${base64Result.replace(/^data:image\/\w+;base64,/, "")}`;

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
        provider: "openai",
      };
    } catch (error) {
      console.error("OpenAI Image Generation Error:", error);
      throw error;
    }
  });
};
