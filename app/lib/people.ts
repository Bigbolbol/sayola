// Fictional demo identities. Names, phones and PINs live off-chain only.

export type Area = "Idlib" | "Aleppo";

export type RoleKey =
  | "admin"
  | "platform"
  | "ngo"
  | "agent-idlib"
  | "agent-aleppo"
  | "recipient-1"
  | "recipient-2"
  | "recipient-3"
  | "investor";

export interface Person {
  key: RoleKey;
  name: string;
  nameAr?: string;
  area?: Area;
  phone?: string;
  pin?: string;
}

export const PEOPLE: Person[] = [
  { key: "admin", name: "Licensed partner (operator)" },
  { key: "platform", name: "Sayola platform" },
  { key: "ngo", name: "Relief NGO (demo)" },
  {
    key: "agent-idlib",
    name: "Al-Amal liquidity point",
    nameAr: "نقطة سيولة الأمل",
    area: "Idlib",
  },
  {
    key: "agent-aleppo",
    name: "Al-Shahba liquidity point",
    nameAr: "نقطة سيولة الشهباء",
    area: "Aleppo",
  },
  {
    key: "recipient-1",
    name: "Fatima",
    nameAr: "فاطمة",
    area: "Idlib",
    phone: "+963 9•• ••• 101",
    pin: "1234",
  },
  {
    key: "recipient-2",
    name: "Ahmad",
    nameAr: "أحمد",
    area: "Aleppo",
    phone: "+963 9•• ••• 202",
    pin: "1234",
  },
  {
    key: "recipient-3",
    name: "Umm Khaled",
    nameAr: "أم خالد",
    area: "Idlib",
    phone: "+963 9•• ••• 303",
    pin: "1234",
  },
  { key: "investor", name: "Omar (son in Germany)", nameAr: "عمر" },
];

export const AGENTS: RoleKey[] = ["agent-idlib", "agent-aleppo"];
export const RECIPIENTS: RoleKey[] = ["recipient-1", "recipient-2", "recipient-3"];
export const AREAS: Area[] = ["Idlib", "Aleppo"];

/** New Syrian pounds per USD, 14 Nov 2026. The partner rate is an illustrative licensed-provider rate. */
export const RATES = {
  official: 122.5,
  partner: 133,
  street: 149.5,
} as const;

export const SYP_PER_USD = RATES.partner;

/** The contract stores rates with 2 decimals. */
export const RATE_SCALE = 100;

export function syp(usdAmount: number): string {
  return `${Math.round(usdAmount * SYP_PER_USD).toLocaleString("ar-SY")} ل.س`;
}

export function person(key: string): Person | undefined {
  return PEOPLE.find((p) => p.key === key);
}
