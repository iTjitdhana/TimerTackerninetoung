import type { Lang } from "../types";

export const LANG_STORAGE_KEY = "portal-login-lang";
export const LANG_LABELS: Record<Lang, string> = { th: "TH", en: "EN", my: "MM" };

export const I18N: Record<Lang, Record<string, string>> = {
  th: {
    pageTitleLogin: "เข้าสู่ระบบ Portal",
    pageTitleRegister: "ลงทะเบียน Portal",
    appTitle: "ระบบจับเวลาผลิต",
    brandTitle: "บริษัท จิตต์ธนา จำกัด",
    subtitleLogin: "เข้าสู่ระบบด้วย PIN 4 หลัก",
    subtitleRegister: "ตั้ง PIN สำหรับเข้าสู่ระบบ",
    pinHint: "(4 หลัก)",
    pinGroupLabel: "กรอก PIN 4 หลัก",
    pinSetLabel: "สร้าง PIN 4 หลัก",
    pinConfirmLabel: "ยืนยัน PIN 4 หลัก",
    pinDigit: "หลักที่ {n}",
    employeeIdLabel: "รหัสพนักงาน",
    employeeIdPlaceholder: "เช่น EMP001",
    signIn: "เข้าสู่ระบบ",
    register: "ลงทะเบียน",
    goRegister: "ลงทะเบียน",
    goBackLogin: "กลับหน้าเข้าสู่ระบบ",
    internalSystem: "ระบบภายใน",
    changeLanguage: "เปลี่ยนภาษา",
    accountLocked:
      "บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ใน 15 นาที หรือติดต่อ IT",
    pinInvalid: "PIN ไม่ถูกต้อง (เหลือ {n} ครั้ง)",
    accountLockedShort: "บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ใน 15 นาที",
    loginSuccess: "เข้าสู่ระบบสำเร็จ — กำลังไป Portal...",
    fillAllFields: "กรุณากรอกข้อมูลให้ครบถ้วน",
    pinMismatch: "PIN ไม่ตรงกัน กรุณาลองใหม่",
    employeeIdNotFound: "ไม่พบรหัสพนักงานในระบบ",
    pinAlreadyRegistered: "รหัสพนักงานนี้ตั้ง PIN แล้ว",
    pinInUse: "PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น",
    registerSuccess: "ตั้ง PIN สำเร็จ — กำลังไปหน้า Login...",
  },
  en: {
    pageTitleLogin: "Sign in to Portal",
    pageTitleRegister: "Register for Portal",
    appTitle: "TimeTracker",
    brandTitle: "JITDHANA Co., LTD",
    subtitleLogin: "Sign in with 4-digit PIN",
    subtitleRegister: "Set your login PIN",
    pinHint: "(4 digits)",
    pinGroupLabel: "Enter 4-digit PIN",
    pinSetLabel: "Create 4-digit PIN",
    pinConfirmLabel: "Confirm 4-digit PIN",
    pinDigit: "Digit {n}",
    employeeIdLabel: "Employee ID",
    employeeIdPlaceholder: "e.g. EMP001",
    signIn: "Sign in",
    register: "Register",
    goRegister: "Register",
    goBackLogin: "Back to sign in",
    internalSystem: "Internal System",
    changeLanguage: "Change language",
    accountLocked:
      "Account temporarily locked. Try again in 15 minutes or contact IT.",
    pinInvalid: "Incorrect PIN ({n} attempts remaining)",
    accountLockedShort:
      "Account temporarily locked. Try again in 15 minutes.",
    loginSuccess: "Signed in successfully — redirecting to Portal...",
    fillAllFields: "Please fill in all required fields",
    pinMismatch: "PINs do not match. Please try again",
    employeeIdNotFound: "Employee ID not found in the system",
    pinAlreadyRegistered: "This employee ID already has a PIN",
    pinInUse: "This PIN is already in use. Please choose another",
    registerSuccess: "PIN set successfully — redirecting to login...",
  },
  my: {
    pageTitleLogin: "Portal သို့ ဝင်ရောက်ရန်",
    pageTitleRegister: "Portal အတွက် မှတ်ပုံတင်ရန်",
    appTitle: "TimeTracker",
    brandTitle: "JITDHANA Co., LTD",
    subtitleLogin: "၄ လုံး PIN ဖြင့် ဝင်ရောက်ပါ",
    subtitleRegister: "Set your login PIN",
    pinHint: "(၄ လုံး)",
    pinGroupLabel: "၄ လုံး PIN ထည့်ပါ",
    pinSetLabel: "Create 4-digit PIN",
    pinConfirmLabel: "Confirm 4-digit PIN",
    pinDigit: "အက္ခရာ {n}",
    employeeIdLabel: "Employee ID",
    employeeIdPlaceholder: "e.g. EMP001",
    signIn: "ဝင်ရောက်ရန်",
    register: "Register",
    goRegister: "Register",
    goBackLogin: "Back to sign in",
    internalSystem: "အတွင်းပိုင်း စနစ်",
    changeLanguage: "ဘာသာစကား ပြောင်းရန်",
    accountLocked:
      "အကောင့်ကို ယာယီပိတ်ထားပါသည်။ ၁၅ မိနစ်ကြာပြီးနောက် ထပ်ကြိုးစားပါ သို့မဟုတ် IT ကို ဆက်သွယ်ပါ။",
    pinInvalid: "PIN မမှန်ကန်ပါ ({n} ကြိမ် ကျန်ရှိ)",
    accountLockedShort:
      "အကောင့်ကို ယာယီပိတ်ထားပါသည်။ ၁၅ မိနစ်ကြာပြီးနောက် ထပ်ကြိုးစားပါ။",
    loginSuccess: "ဝင်ရောက်မှု အောင်မြင်ပါသည် — Portal သို့ ပို့ဆောင်နေပါသည်...",
    fillAllFields: "Please fill in all required fields",
    pinMismatch: "PINs do not match. Please try again",
    employeeIdNotFound: "Employee ID not found in the system",
    pinAlreadyRegistered: "This employee ID already has a PIN",
    pinInUse: "This PIN is already in use. Please choose another",
    registerSuccess: "PIN set successfully — redirecting to login...",
  },
};

export function translate(
  lang: Lang,
  key: string,
  vars: Record<string, string | number> = {}
): string {
  let text = I18N[lang]?.[key] ?? I18N.th[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

export function getStoredLang(): Lang {
  if (typeof window === "undefined") return "th";
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === "th" || stored === "en" || stored === "my") return stored;
  return "th";
}

export function storeLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}
