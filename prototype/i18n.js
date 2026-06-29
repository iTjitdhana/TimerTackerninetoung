const LANG_STORAGE_KEY = "portal-login-lang";
const LANG_LABELS = { th: "TH", en: "EN", my: "MM" };

const I18N = {
  th: {
    pageTitleLogin: "เข้าสู่ระบบ Portal",
    pageTitleRegister: "ลงทะเบียน Portal",
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
    accountLocked: "บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ใน 15 นาที หรือติดต่อ IT",
    pinInvalid: "PIN ไม่ถูกต้อง (เหลือ {n} ครั้ง)",
    accountLockedShort: "บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ใน 15 นาที",
    loginSuccess: "เข้าสู่ระบบสำเร็จ — กำลังไป Portal...",
    demoRedirect: "Demo: redirect ไป Portal\nrole = {role}\nuser = {user}",
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
    accountLocked: "Account temporarily locked. Try again in 15 minutes or contact IT.",
    pinInvalid: "Incorrect PIN ({n} attempts remaining)",
    accountLockedShort: "Account temporarily locked. Try again in 15 minutes.",
    loginSuccess: "Signed in successfully — redirecting to Portal...",
    demoRedirect: "Demo: redirect to Portal\nrole = {role}\nuser = {user}",
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
    accountLocked: "အကောင့်ကို ယာယီပိတ်ထားပါသည်။ ၁၅ မိနစ်ကြာပြီးနောက် ထပ်ကြိုးစားပါ သို့မဟုတ် IT ကို ဆက်သွယ်ပါ။",
    pinInvalid: "PIN မမှန်ကန်ပါ ({n} ကြိမ် ကျန်ရှိ)",
    accountLockedShort: "အကောင့်ကို ယာယီပိတ်ထားပါသည်။ ၁၅ မိနစ်ကြာပြီးနောက် ထပ်ကြိုးစားပါ။",
    loginSuccess: "ဝင်ရောက်မှု အောင်မြင်ပါသည် — Portal သို့ ပို့ဆောင်နေပါသည်...",
    demoRedirect: "Demo: Portal သို့ redirect\nrole = {role}\nuser = {user}",
    fillAllFields: "Please fill in all required fields",
    pinMismatch: "PINs do not match. Please try again",
    employeeIdNotFound: "Employee ID not found in the system",
    pinAlreadyRegistered: "This employee ID already has a PIN",
    pinInUse: "This PIN is already in use. Please choose another",
    registerSuccess: "PIN set successfully — redirecting to login...",
  },
};

let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || "th";

function t(key, vars = {}) {
  let text = I18N[currentLang]?.[key] ?? I18N.th[key] ?? key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, value);
  });
  return text;
}

function applyLanguage(lang, alertBox) {
  if (!I18N[lang]) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);

  document.documentElement.lang = lang;
  document.body.dataset.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.querySelectorAll("select[data-i18n-placeholder]").forEach((el) => {
    const placeholder = el.querySelector("option[value='']");
    if (placeholder) placeholder.textContent = t(el.dataset.i18nPlaceholder);
  });

  document.querySelectorAll("select[data-i18n-options]").forEach((el) => {
    el.querySelectorAll("option[data-i18n]").forEach((option) => {
      option.textContent = t(option.dataset.i18n);
    });
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (key === "pinDigit") {
      el.setAttribute("aria-label", t(key, { n: el.dataset.digit }));
    } else {
      el.setAttribute("aria-label", t(key));
    }
  });

  const pageTitle = document.querySelector("title[data-i18n]");
  if (pageTitle) pageTitle.textContent = t(pageTitle.dataset.i18n);

  const langToggle = document.getElementById("langToggle");
  const langCurrent = document.getElementById("langCurrent");
  if (langToggle) langToggle.setAttribute("aria-label", t("changeLanguage"));
  if (langCurrent) langCurrent.textContent = LANG_LABELS[lang];

  document.querySelectorAll(".lang-option").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === lang);
  });

  if (alertBox && !alertBox.hidden && alertBox.dataset.i18nKey) {
    const key = alertBox.dataset.i18nKey;
    const vars = alertBox.dataset.i18nVars
      ? JSON.parse(alertBox.dataset.i18nVars)
      : {};
    showI18nAlert(alertBox, t(key, vars), { key, vars, keepStyle: true });
  }
}

function showI18nAlert(alertBox, message, meta = {}) {
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.hidden = false;

  if (meta.key) {
    alertBox.dataset.i18nKey = meta.key;
    alertBox.dataset.i18nVars = meta.vars ? JSON.stringify(meta.vars) : "";
  } else {
    delete alertBox.dataset.i18nKey;
    delete alertBox.dataset.i18nVars;
  }

  if (!meta.keepStyle) {
    alertBox.style.background = "";
    alertBox.style.color = "";
    alertBox.style.borderColor = "";
  }
}

function hideI18nAlert(alertBox) {
  if (!alertBox) return;
  alertBox.hidden = true;
  alertBox.textContent = "";
  delete alertBox.dataset.i18nKey;
  delete alertBox.dataset.i18nVars;
}

function showSuccessAlert(alertBox, message, meta = {}) {
  showI18nAlert(alertBox, message, meta);
  alertBox.style.background = "rgba(34, 197, 94, 0.12)";
  alertBox.style.color = "#86efac";
  alertBox.style.borderColor = "rgba(34, 197, 94, 0.3)";
}

function initLanguageSwitcher(alertBox) {
  const langToggle = document.getElementById("langToggle");
  const langMenu = document.getElementById("langMenu");
  if (!langToggle || !langMenu) return;

  function setLangMenuOpen(open) {
    langMenu.hidden = !open;
    langToggle.setAttribute("aria-expanded", String(open));
    langToggle.classList.toggle("is-open", open);
  }

  langToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setLangMenuOpen(langMenu.hidden);
  });

  langMenu.querySelectorAll(".lang-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLanguage(btn.dataset.lang, alertBox);
      setLangMenuOpen(false);
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lang-switcher")) setLangMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setLangMenuOpen(false);
  });

  applyLanguage(currentLang, alertBox);
}

function setupPinGroup(groupEl, options = {}) {
  const { pinLength = 4, onComplete, onChange } = options;
  const pinBoxes = [...groupEl.querySelectorAll(".pin-box")];

  function getPinValue() {
    return pinBoxes.map((box) => box.value).join("");
  }

  function clearPin() {
    pinBoxes.forEach((box) => {
      box.value = "";
    });
    pinBoxes[0]?.focus();
    onChange?.(getPinValue());
  }

  function shakePin() {
    groupEl.classList.remove("shake");
    void groupEl.offsetWidth;
    groupEl.classList.add("shake");
  }

  pinBoxes.forEach((box, index) => {
    box.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val.slice(-1);

      if (val && index < pinLength - 1) {
        pinBoxes[index + 1].focus();
      }

      const value = getPinValue();
      onChange?.(value);

      if (value.length === pinLength && onComplete) {
        onComplete(value);
      }
    });

    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && index > 0) {
        pinBoxes[index - 1].focus();
      }
      if (e.key === "ArrowLeft" && index > 0) pinBoxes[index - 1].focus();
      if (e.key === "ArrowRight" && index < pinLength - 1) pinBoxes[index + 1].focus();
    });

    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData("text") || "")
        .replace(/\D/g, "")
        .slice(0, pinLength);
      pasted.split("").forEach((char, i) => {
        if (pinBoxes[i]) pinBoxes[i].value = char;
      });
      const nextIndex = Math.min(pasted.length, pinLength - 1);
      pinBoxes[nextIndex].focus();
      onChange?.(getPinValue());
    });
  });

  return { pinBoxes, getPinValue, clearPin, shakePin };
}

function setButtonLoading(button, loading) {
  button.classList.toggle("loading", loading);
  button.querySelector(".btn-spinner").hidden = !loading;
}
