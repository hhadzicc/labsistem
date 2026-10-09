import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, GraduationCap, Info, Presentation, Wrench } from "lucide-react";
import api, { getDemoStatus, loginAsDemo } from "../api/client";
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
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [demoResetMinutes, setDemoResetMinutes] = useState(60);
  const [loadingDemoRole, setLoadingDemoRole] = useState("");
  const [demoError, setDemoError] = useState("");
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

  useEffect(() => {
    let active = true;

    getDemoStatus()
      .then((response) => {
        if (active && response.data?.enabled) {
          setDemoAccounts(response.data.accounts || []);
          setDemoResetMinutes(response.data.resetIntervalMinutes || 60);
        }
      })
      .catch(() => {
        if (active) {
          setDemoAccounts([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const completeLogin = (session, enteredIdentity = "") => {
    persistSession(session);
    localStorage.setItem("korisnikEmail", enteredIdentity.includes("@") ? enteredIdentity : "");
    localStorage.setItem("korisnik", session.username);
    navigate(session?.mustChangePassword ? "/first-login-password" : "/dashboard");
  };

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

      completeLogin(response.data, usernameOrEmail);
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

  const handleDemoLogin = async (role) => {
    setGreska("");
    setDemoError("");
    setLoadingDemoRole(role);

    try {
      const response = await loginAsDemo(role);
      completeLogin(response.data);
    } catch (error) {
      setDemoError(error.response?.data?.message || "Demo prijava trenutno nije dostupna. Pokušajte ponovo.");
    } finally {
      setLoadingDemoRole("");
    }
  };

  const demoIcons = {
    student: GraduationCap,
    profesor: Presentation,
    tehnicar: Wrench,
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

        {demoAccounts.length > 0 && (
          <section className="demo-login" aria-labelledby="demo-login-title">
            <div className="demo-login-divider"><span>ili isprobajte aplikaciju</span></div>
            <div className="demo-login-heading">
              <div>
                <h2 id="demo-login-title">Demo pristup</h2>
                <p>Odaberite ulogu i otvorite pripremljen radni prostor.</p>
              </div>
              <span className="demo-reset-note">Reset svakih {demoResetMinutes} min</span>
            </div>
            <div className="demo-role-grid">
              {demoAccounts.map((account) => {
                const Icon = demoIcons[account.role] || GraduationCap;
                const isLoading = loadingDemoRole === account.role;
                return (
                  <button
                    key={account.role}
                    type="button"
                    className="demo-role-button"
                    disabled={Boolean(loadingDemoRole) || loading}
                    onClick={() => handleDemoLogin(account.role)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{isLoading ? "Otvaranje..." : account.label}</span>
                  </button>
                );
              })}
            </div>
            {demoError && (
              <div className="field-message error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{demoError}</span>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default Login;
