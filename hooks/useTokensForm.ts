import { useState, useCallback } from "react";
import { ProviderId } from "../types";
import { useConfigStore } from "../store/configStore";

/**
 * Manages token-related form state for the settings dialog.
 * Handles HuggingFace, Gitee, ModelScope, and A4F tokens along with their stats.
 */
export const useTokensForm = () => {
  const { tokens, tokenStatus } = useConfigStore();

  // Token state
  const [token, setToken] = useState("");
  const [stats, setStats] = useState({ total: 0, active: 0, exhausted: 0 });
  const [giteeToken, setGiteeToken] = useState("");
  const [giteeStats, setGiteeStats] = useState({
    total: 0,
    active: 0,
    exhausted: 0,
  });
  const [msToken, setMsToken] = useState("");
  const [msStats, setMsStats] = useState({
    total: 0,
    active: 0,
    exhausted: 0,
  });
  const [a4fToken, setA4FToken] = useState("");
  const [a4fStats, setA4FStats] = useState({
    total: 0,
    active: 0,
    exhausted: 0,
  });
  const [openaiToken, setOpenaiToken] = useState("");
  const [openaiStats, setOpenaiStats] = useState({
    total: 0,
    active: 0,
    exhausted: 0,
  });
  const [googleToken, setGoogleToken] = useState("");
  const [googleStats, setGoogleStats] = useState({
    total: 0,
    active: 0,
    exhausted: 0,
  });

  const calculateStats = useCallback(
    (tokensList: string[], providerId: ProviderId) => {
      const total = tokensList.length;
      const exhaustedMap = tokenStatus[providerId]?.exhausted || {};
      const exhaustedCount = tokensList.filter((t) => exhaustedMap[t]).length;
      return {
        total,
        exhausted: exhaustedCount,
        active: total - exhaustedCount,
      };
    },
    [tokenStatus],
  );

  const initializeTokens = useCallback(() => {
    const hfTokens = tokens.huggingface || [];
    setToken(hfTokens.join(","));
    setStats(calculateStats(hfTokens, "huggingface"));

    const gTokens = tokens.gitee || [];
    setGiteeToken(gTokens.join(","));
    setGiteeStats(calculateStats(gTokens, "gitee"));

    const mTokens = tokens.modelscope || [];
    setMsToken(mTokens.join(","));
    setMsStats(calculateStats(mTokens, "modelscope"));

    const aTokens = tokens.a4f || [];
    setA4FToken(aTokens.join(","));
    setA4FStats(calculateStats(aTokens, "a4f"));

    const oTokens = tokens.openai || [];
    setOpenaiToken(oTokens.join(","));
    setOpenaiStats(calculateStats(oTokens, "openai"));

    const googleTokens = tokens.google || [];
    setGoogleToken(googleTokens.join(","));
    setGoogleStats(calculateStats(googleTokens, "google"));
  }, [tokens, calculateStats]);

  const updateToken = (type: ProviderId, value: string) => {
    const list = value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const newStats = calculateStats(list, type);

    if (type === "huggingface") {
      setToken(value);
      setStats(newStats);
    } else if (type === "gitee") {
      setGiteeToken(value);
      setGiteeStats(newStats);
    } else if (type === "modelscope") {
      setMsToken(value);
      setMsStats(newStats);
    } else if (type === "a4f") {
      setA4FToken(value);
      setA4FStats(newStats);
    } else if (type === "openai") {
      setOpenaiToken(value);
      setOpenaiStats(newStats);
    } else if (type === "google") {
      setGoogleToken(value);
      setGoogleStats(newStats);
    }
  };

  return {
    token,
    stats,
    giteeToken,
    giteeStats,
    msToken,
    msStats,
    a4fToken,
    a4fStats,
    openaiToken,
    openaiStats,
    googleToken,
    googleStats,
    updateToken,
    initializeTokens,
  };
};
