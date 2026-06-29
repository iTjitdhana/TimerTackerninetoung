const PIN_LENGTH = 4;

const form = document.getElementById("registerForm");
const employeeIdInput = document.getElementById("employeeId");
const submitBtn = document.getElementById("submitBtn");
const alertBox = document.getElementById("alertBox");
const langToggle = document.getElementById("langToggle");

const pinNew = setupPinGroup(document.getElementById("pinNewGroup"), {
  pinLength: PIN_LENGTH,
  onChange: () => {
    hideI18nAlert(alertBox);
    updateSubmitState();
  },
});

const pinConfirm = setupPinGroup(document.getElementById("pinConfirmGroup"), {
  pinLength: PIN_LENGTH,
  onChange: () => {
    hideI18nAlert(alertBox);
    updateSubmitState();
  },
});

function isFormComplete() {
  return (
    employeeIdInput.value.trim().length > 0 &&
    pinNew.getPinValue().length === PIN_LENGTH &&
    pinConfirm.getPinValue().length === PIN_LENGTH
  );
}

function updateSubmitState() {
  submitBtn.disabled = !isFormComplete();
}

function setLoading(loading) {
  setButtonLoading(submitBtn, loading);
  submitBtn.disabled = loading || !isFormComplete();
  if (langToggle) langToggle.disabled = loading;
  employeeIdInput.disabled = loading;
  pinNew.pinBoxes.forEach((box) => (box.disabled = loading));
  pinConfirm.pinBoxes.forEach((box) => (box.disabled = loading));
}

employeeIdInput.addEventListener("input", () => {
  hideI18nAlert(alertBox);
  updateSubmitState();
});

initLanguageSwitcher(alertBox);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isFormComplete()) {
    showI18nAlert(alertBox, t("fillAllFields"), { key: "fillAllFields" });
    return;
  }

  hideI18nAlert(alertBox);

  const employeeId = normalizeEmployeeId(employeeIdInput.value);
  const newPin = pinNew.getPinValue();
  const confirmPin = pinConfirm.getPinValue();

  const employee = findEmployeeInRoster(employeeId);
  if (!employee) {
    showI18nAlert(alertBox, t("employeeIdNotFound"), { key: "employeeIdNotFound" });
    return;
  }

  if (hasRegisteredPin(employeeId)) {
    showI18nAlert(alertBox, t("pinAlreadyRegistered"), { key: "pinAlreadyRegistered" });
    return;
  }

  if (newPin !== confirmPin) {
    showI18nAlert(alertBox, t("pinMismatch"), { key: "pinMismatch" });
    pinConfirm.shakePin();
    pinConfirm.clearPin();
    updateSubmitState();
    return;
  }

  if (isPinTaken(newPin)) {
    showI18nAlert(alertBox, t("pinInUse"), { key: "pinInUse" });
    pinNew.shakePin();
    pinNew.clearPin();
    pinConfirm.clearPin();
    updateSubmitState();
    return;
  }

  setLoading(true);
  await new Promise((r) => setTimeout(r, 900));

  registerEmployeePin(employeeId, newPin);

  setLoading(false);
  showSuccessAlert(alertBox, t("registerSuccess"), { key: "registerSuccess" });

  setTimeout(() => {
    window.location.href = "index.html";
  }, 1200);
});

employeeIdInput.focus();
updateSubmitState();
