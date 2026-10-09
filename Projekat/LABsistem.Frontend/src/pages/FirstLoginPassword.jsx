import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import api from "../api/client";
import {
  clearSession,
  getRefreshToken,
  persistPasswordChangeRequirement,
} from "../auth/session";

function extractErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (typeof responseData?.message === "string" && responseData.message.trim()) {
    return responseData.message;
  }

  return fallbackMessage;
}

function validatePassword(value) {
  if (!value.trim()) return "Nova lozinka je obavezna.";
  if (value.trim().length < 8) return "Lozinka mora imati najmanje 8 karaktera.";
  if (value.trim().length > 64) return "Lozinka može imati najviše 64 karaktera.";
  return "";
}

function FirstLoginPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => ({
    newPassword: validatePassword(form.newPassword),
    confirmPassword: !form.confirmPassword.trim()
      ? "Potvrda nove lozinke je obavezna."
      : form.newPassword.trim() !== form.confirmPassword.trim()
        ? "Nova lozinka i potvrda se ne poklapaju."
        : "",
  }), [form]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrorMessage("");
  }

  async function handleBackToLogin() {
    try {
      await api.post("/Auth/logout", { refreshToken: getRefreshToken() });
    } catch {
      // Best effort logout; local session cleanup still returns the user to login.
    } finally {
      clearSession();
      navigate("/login", { replace: true });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setTouched({ newPassword: true, confirmPassword: true });
    setErrorMessage("");
    setSuccessMessage("");

    if (errors.newPassword || errors.confirmPassword) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/Auth/change-password", {
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      persistPasswordChangeRequirement(false);
      setSuccessMessage(response.data?.message || "Lozinka je uspješno promijenjena.");
      setForm({
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 500);
    } catch (error) {
      setErrorMessage(
        extractErrorMessage(error, "Došlo je do greške pri promjeni lozinke.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card login-card forgot-password-card">
        <div className="auth-brand">LABsistem</div>
        <h1 className="login-title auth-card-title">Prva promjena lozinke</h1>
        <p className="auth-description">
          Već ste prijavljeni privremenom lozinkom koju je postavio administrator.
          Prije nastavka rada sada samo postavite svoju novu lozinku.
        </p>

        {successMessage && (
          <p className="form-success auth-success-note">{successMessage}</p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="newPassword">Nova lozinka</label>
            <div className="password-field">
              <input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={form.newPassword}
                onChange={handleChange}
                onBlur={() => setTouched((current) => ({ ...current, newPassword: true }))}
                autoComplete="new-password"
                placeholder="Unesite novu lozinku"
                className={(touched.newPassword || submitted) && errors.newPassword ? "input-error" : ""}
                aria-invalid={Boolean((touched.newPassword || submitted) && errors.newPassword)}
                aria-describedby={(touched.newPassword || submitted) && errors.newPassword ? "first-password-error" : undefined}
              />
              <button
                type="button"
                className="password-toggle-button"
                aria-label={showNewPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                aria-pressed={showNewPassword}
                onClick={() => setShowNewPassword((current) => !current)}
              >
                {showNewPassword ? <Eye size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}
              </button>
            </div>
            {(touched.newPassword || submitted) && errors.newPassword && (
              <p className="field-error" id="first-password-error">{errors.newPassword}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Potvrda nove lozinke</label>
            <div className="password-field">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleChange}
                onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
                autoComplete="new-password"
                placeholder="Ponovite novu lozinku"
                className={(touched.confirmPassword || submitted) && errors.confirmPassword ? "input-error" : ""}
                aria-invalid={Boolean((touched.confirmPassword || submitted) && errors.confirmPassword)}
                aria-describedby={(touched.confirmPassword || submitted) && errors.confirmPassword ? "first-confirm-error" : errorMessage ? "first-password-api-error" : undefined}
              />
              <button
                type="button"
                className="password-toggle-button"
                aria-label={showConfirmPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((current) => !current)}
              >
                {showConfirmPassword ? <Eye size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}
              </button>
            </div>
            {(touched.confirmPassword || submitted) && errors.confirmPassword && (
              <p className="field-error" id="first-confirm-error">{errors.confirmPassword}</p>
            )}
            {!errors.confirmPassword && errorMessage && (
              <div className="field-message error" id="first-password-api-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <button
            className="button"
            type="submit"
            style={{ width: "100%" }}
            disabled={submitting}
          >
            {submitting ? "Promjena..." : "Sačuvaj novu lozinku"}
          </button>

          <div className="auth-link-row" style={{ justifyContent: "center", marginTop: 16 }}>
            <button
              type="button"
              className="auth-inline-link"
              style={{ background: "none", border: "none", cursor: "pointer" }}
              onClick={handleBackToLogin}
            >
              Nazad na prijavu
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default FirstLoginPassword;
