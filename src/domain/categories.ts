/** The eight budget categories named in the Challenge 5 brief. Contingency is held separately. */
export const CATEGORY_KEYS = [
  "venue",
  "catering",
  "decor",
  "photography",
  "entertainment",
  "invitations",
  "transport",
  "misc",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  venue: "Venue",
  catering: "Catering",
  decor: "Decor",
  photography: "Photography",
  entertainment: "Entertainment",
  invitations: "Invitations",
  transport: "Transport",
  misc: "Miscellaneous",
};

export const EVENT_KINDS = ["wedding", "birthday", "community"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  wedding: "Wedding",
  birthday: "Birthday",
  community: "Community event",
};

/**
 * The minimum each kind of event must fund. Deliberately small: a birthday at home needs no venue,
 * and a society festival on its own ground may not either, so the model is free to give them 0.
 */
export const REQUIRED_CATEGORIES: Record<EventKind, readonly CategoryKey[]> = {
  wedding: ["venue", "catering"],
  birthday: ["catering"],
  community: ["misc"],
};

/**
 * Fixed coverage vocabulary per category. Requirements and quote inclusions use the same tags,
 * which is what lets code (not the model) decide whether a quote covers what the event needs.
 */
export const COVERAGE_TAGS = {
  venue: [
    "power_backup",
    "parking",
    "air_conditioning",
    "stage",
    "green_room",
    "step_free_access",
    "security",
    "cleaning",
  ],
  catering: [
    "service_staff",
    "crockery",
    "transport",
    "gst",
    "live_counter",
    "late_night",
    "tasting",
    "setup",
    "desserts",
  ],
  decor: ["setup", "teardown", "fresh_flowers", "lighting", "stage_decor", "transport"],
  photography: ["candid", "traditional", "video", "drone", "album", "edited_photos", "raw_files"],
  entertainment: ["sound_system", "dj", "live_music", "emcee", "overtime"],
  invitations: ["design", "printing", "digital", "delivery"],
  transport: ["guest_shuttle", "fuel", "driver_allowance", "parking", "tolls"],
  misc: ["permits", "insurance", "cleanup", "volunteers", "first_aid"],
} as const satisfies Record<CategoryKey, readonly string[]>;

export function isCoverageTag(category: CategoryKey, tag: string): boolean {
  return (COVERAGE_TAGS[category] as readonly string[]).includes(tag);
}

/** "service_staff" → "Service staff". */
export function tagLabel(tag: string): string {
  const words = tag.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const DIET_TAGS = ["vegetarian", "vegan", "jain", "halal", "gluten_free", "nut_free", "no_alcohol"] as const;
export type DietTag = (typeof DIET_TAGS)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const IDEA_SECTIONS = [
  "theme",
  "decor",
  "menu",
  "activity",
  "culture",
  "accessibility",
  "sustainability",
] as const;
export type IdeaSection = (typeof IDEA_SECTIONS)[number];

export const IDEA_SECTION_LABEL: Record<IdeaSection, string> = {
  theme: "Themes",
  decor: "Decor",
  menu: "Menu",
  activity: "Activities",
  culture: "Cultural touches",
  accessibility: "Accessibility",
  sustainability: "Sustainability",
};
