import { AspectRatioOption } from "../types";

/**
 * Shared aspect ratio to pixel dimension mapping.
 * Used by hfService, giteeService, a4fService, and msService.
 */
export const getBaseDimensions = (
  ratio: AspectRatioOption,
): { width: number; height: number } => {
  switch (ratio) {
    case "16:9":
      return { width: 1024, height: 576 };
    case "4:3":
      return { width: 1024, height: 768 };
    case "3:2":
      return { width: 960, height: 640 };
    case "9:16":
      return { width: 576, height: 1024 };
    case "3:4":
      return { width: 768, height: 1024 };
    case "4:5":
      return { width: 832, height: 1040 };
    case "5:4":
      return { width: 1040, height: 832 };
    case "2:3":
      return { width: 640, height: 960 };
    case "1:1":
    default:
      return { width: 1024, height: 1024 };
  }
};

export const getDimensions = (
  ratio: AspectRatioOption,
  enableHD: boolean,
  multiplier: number = 2,
): { width: number; height: number } => {
  const base = getBaseDimensions(ratio);

  if (!enableHD) return base;

  return {
    width: Math.round(base.width * multiplier),
    height: Math.round(base.height * multiplier),
  };
};
