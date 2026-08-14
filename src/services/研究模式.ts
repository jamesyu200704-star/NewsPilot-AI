export const isResearchModeEnabled = (value: string | boolean | undefined) =>
  value === true || String(value).toLowerCase() === 'true';

export const researchModeEnabled = isResearchModeEnabled(
  import.meta.env.VITE_RESEARCH_MODE,
);
