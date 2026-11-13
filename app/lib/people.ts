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

/** Central Bank of Syria official bulletin, Nov 2026 (new pounds per USD). */
export const SYP_PER_USD = 122;

export function person(key: string): Person | undefined {
  return PEOPLE.find((p) => p.key === key);
}
