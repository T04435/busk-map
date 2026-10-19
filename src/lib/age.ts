/** Labels for Qloo demographics age bands. Client-safe. */
export const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55 and over",
};

export const ageLabel = (band: string) => AGE_LABEL[band] ?? band.replaceAll("_", " ");
