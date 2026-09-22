"use client";
import { useEffect,useState,type SetStateAction } from "react";

type Media = { image: string | null; video: string | null };
const STORAGE_KEY = "saashub-publish-drafts";

/** Keep each brand's pending publication separate, including late generation results. */
export function usePublishDraft(brandId: string) {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<Record<string, Media>>({});
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}",
      );
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore persisted drafts after hydration.
        setMessages(
          Object.fromEntries(
            Object.entries(stored).filter(
              ([, value]) => typeof value === "string",
            ),
          ),
        );
      }
    } catch {
      /* An unavailable browser store must not prevent editing. */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* Keep the in-memory draft usable. */
    }
  }, [messages, restored]);
  function setMessage(value: SetStateAction<string>) {
    setMessages((previous) => ({
      ...previous,
      [brandId]:
        typeof value === "function" ? value(previous[brandId] || "") : value,
    }));
  }
  function setGeneratedImage(image: string | null) {
    setMedia((previous) => ({
      ...previous,
      [brandId]: {
        image,
        video: image ? null : previous[brandId]?.video || null,
      },
    }));
  }
  function setGeneratedVideo(video: string | null) {
    setMedia((previous) => ({
      ...previous,
      [brandId]: {
        video,
        image: video ? null : previous[brandId]?.image || null,
      },
    }));
  }
  return {
    message: messages[brandId] || "",
    setMessage,
    generatedImage: media[brandId]?.image || null,
    generatedVideo: media[brandId]?.video || null,
    setGeneratedImage,
    setGeneratedVideo,
  };
}
