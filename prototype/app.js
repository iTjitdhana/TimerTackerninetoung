const PIN_LENGTH = 4;

const form = document.getElementById("loginForm");
const pinGroup = document.getElementById("pinGroup");
const submitBtn = document.getElementById("submitBtn");
const alertBox = document.getElementById("alertBox");
const langToggle = document.getElementById("langToggle");

let failedAttempts = 0;
const MAX_ATTEMPTS = 5;

const pin = setupPinGroup(pinGroup, {
  pinLength: PIN_LENGTH,
  onChange: () => {
    hideI18nAlert(alertBox);
    updateSubmitState();
  },
  onComplete: () => form.requestSubmit(),
});

function updateSubmitState() {
  submitBtn.disabled = pin.getPinValue().length !== PIN_LENGTH;
}

function setLoading(loading) {
  setButtonLoading(submitBtn, loading);
  submitBtn.disabled = loading || pin.getPinValue().length !== PIN_LENGTH;
  if (langToggle) langToggle.disabled = loading;
  pin.pinBoxes.forEach((box) => (box.disabled = loading));
}

initLanguageSwitcher(alertBox);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (pin.getPinValue().length !== PIN_LENGTH) return;

  hideI18nAlert(alertBox);
  setLoading(true);

  await new Promise((r) => setTimeout(r, 900));

  const pinValue = pin.getPinValue();

  if (failedAttempts >= MAX_ATTEMPTS) {
    setLoading(false);
    showI18nAlert(alertBox, t("accountLocked"), { key: "accountLocked" });
    return;
  }

  const matchedUser = findUserByPin(pinValue);
  setLoading(false);

  if (matchedUser) {
    failedAttempts = 0;
    showSuccessAlert(alertBox, t("loginSuccess"), { key: "loginSuccess" });

    setTimeout(() => {
      alert(
        t("demoRedirect", { role: matchedUser.role, user: matchedUser.name })
      );
    }, 600);
  } else {
    failedAttempts++;
    const remaining = MAX_ATTEMPTS - failedAttempts;

    if (remaining > 0) {
      showI18nAlert(alertBox, t("pinInvalid", { n: remaining }), {
        key: "pinInvalid",
        vars: { n: remaining },
      });
    } else {
      showI18nAlert(alertBox, t("accountLockedShort"), {
        key: "accountLockedShort",
      });
    }

    pin.shakePin();
    pin.clearPin();
    updateSubmitState();
  }
});

pin.pinBoxes[0]?.focus();
updateSubmitState();
