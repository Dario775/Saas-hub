"use client";
import { useEffect,useState,type Dispatch,type SetStateAction } from "react";
import type { TabId } from "../config";

type Navigation = {
  tab: TabId;
  pageId: string;
  activeSection: "workspace" | "neurocortex-b2b";
};
const views = new Set([
  "overview",
  "creative",
  "image",
  "composer",
  "publish",
  "brandkit",
]);
export function useNavigation() {
  const [navigation, setNavigation] = useState<Navigation>({
    tab: "overview",
    pageId: "",
    activeSection: "workspace",
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(window.location.search);
      const savedPage =
        typeof window !== "undefined"
          ? localStorage.getItem("saashub_selected_page") || ""
          : "";
      setNavigation({
        tab: views.has(params.get("view") || "")
          ? (params.get("view") as TabId)
          : "overview",
        pageId: params.get("brand") || savedPage,
        activeSection:
          params.get("section") === "sales" ? "neurocortex-b2b" : "workspace",
      });
      setReady(true);
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", navigation.tab);
    if (navigation.pageId) {
      url.searchParams.set("brand", navigation.pageId);
      try {
        localStorage.setItem("saashub_selected_page", navigation.pageId);
      } catch {
        // ignore storage quota / access issues
      }
    } else {
      url.searchParams.delete("brand");
    }
    if (navigation.activeSection === "neurocortex-b2b")
      url.searchParams.set("section", "sales");
    else url.searchParams.delete("section");
    if (url.href !== window.location.href)
      window.history.pushState(null, "", url);
  }, [navigation, ready]);
  function setter<K extends keyof Navigation>(
    key: K,
  ): Dispatch<SetStateAction<Navigation[K]>> {
    return (value) =>
      setNavigation((previous) => ({
        ...previous,
        [key]:
          typeof value === "function"
            ? (value as (v: Navigation[K]) => Navigation[K])(previous[key])
            : value,
      }));
  }
  return {
    ...navigation,
    setTab: setter("tab"),
    setPageId: setter("pageId"),
    setActiveSection: setter("activeSection"),
  };
}
