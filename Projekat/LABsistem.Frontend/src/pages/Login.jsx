import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import api from "../api/client";
import {
  hasActiveAccessToken,
  isPasswordChangeRequired,
  persistSession,
} from "../auth/session";

function Login() {
  const loginHeading = "Prijavite se sa svojim LABsistem korisničkim nalogom";
  const usernameLabel = "Korisničko ime ili email adresa:";
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [greska, setGreska] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const sesijaIstekla = new URLSearchParams(location.search).get("sesija") === "istekla";
  const usernameError = usernameOrEmail.trim() ? "" : "Unesite korisničko ime ili email adresu.";
  const passwordError = password ? "" : "Unesite lozinku.";

  useEffect(() => {
    if (hasActiveAccessToken()) {
      navigate(isPasswordChangeRequired() ? "/first-login-password" : "/dashboard");
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setGreska("");

    if (usernameError || passwordError) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/Auth/login", {
        username: usernameOrEmail.trim(),
        password,
      });

      const { username: authenticatedUsername } = response.data;
      persistSession(response.data);
      localStorage.setItem("korisnikEmail", usernameOrEmail.includes("@") ? usernameOrEmail : "");
      localStorage.setItem("korisnik", authenticatedUsername);

      navigate(response.data?.mustChangePassword ? "/first-login-password" : "/dashboard");
    } catch (error) {
      const responseData = error.response?.data;
      const backendMessage =
        typeof responseData === "string"
          ? responseData
          : responseData?.message;

      setGreska(
        backendMessage || "Prijava nije uspjela. Provjerite korisničko ime ili email adresu i lozinku."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="login-card auth-card">
        <div className="auth-brand">LABsistem</div>
        <h1 className="login-title">{loginHeading}</h1>

        {sesijaIstekla && (
          <div className="auth-status-note info" role="status">
            <Info size={17} aria-hidden="true" />
            <span>Sesija je istekla. Prijavite se ponovo.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="username">{usernameLabel}</label>
            <input
              id="username"
              type="text"
              placeholder="Unesite korisničko ime ili email adresu"
              value={usernameOrEmail}
              autoComplete="username"
              className={(touched.username || submitted) && usernameError ? "input-error" : ""}
              aria-invalid={Boolean((touched.username || submitted) && usernameError)}
              aria-describedby={(touched.username || submitted) && usernameError ? "login-username-error" : undefined}
              onBlur={() => setTouched((current) => ({ ...current, username: true }))}
              onChange={(event) => {
                setUsernameOrEmail(event.target.value);
                setGreska("");
              }}
            />
            {(touched.username || submitted) && usernameError && (
              <p className="field-error" id="login-username-error">{usernameError}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Lozinka:</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={password}
                autoComplete="current-password"
                className={(touched.password || submitted || greska) && (passwordError || greska) ? "input-error" : ""}
                aria-invalid={Boolean((touched.password || submitted || greska) && (passwordError || greska))}
                aria-describedby={passwordError ? "login-password-error" : greska ? "login-credentials-error" : undefined}
                onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setGreska("");
                }}
              />
              <button
                type="button"
                className="password-toggle-button"
                aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <Eye size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}
              </button>
            </div>
            {(touched.password || submitted) && passwordError && (
              <p className="field-error" id="login-password-error">{passwordError}</p>
            )}
            {!passwordError && greska && (
              <div className="field-message error" id="login-credentials-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{greska}</span>
              </div>
            )}
          </div>

          <div className="auth-link-row">
            <Link className="auth-inline-link" to="/forgot-password">
              Zaboravljena lozinka?
            </Link>
          </div>

          <button className="button" type="submit" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Prijava..." : "Prijavi se"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default Login;
