import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, GraduationCap, Info, LoaderCircle, Presentation, RefreshCw, Wrench } from "lucide-react";
import api, { getDemoStatus, loginAsDemo } from "../api/client";
import {
  hasActiveAccessToken,
  isPasswordChangeRequired,
  persistSession,
} from "../auth/session";

function Login() {
  const fallbackDemoAccounts = [
    { role: "student", label: "Student" },
    { role: "profesor", label: "Profesor" },
    { role: "tehnicar", label: "Tehničar" },
  ];
  const loginHeading = "Prijavite se sa svojim LABsistem korisničkim nalogom";
  const usernameLabel = "Korisničko ime ili email adresa:";
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [greska, setGreska] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const [loading, setLoading] = useState(false);
  const [loginIsSlow, setLoginIsSlow] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [demoResetMinutes, setDemoResetMinutes] = useState(60);
  const [demoStatus, setDemoStatus] = useState("loading");
  const [demoLoadAttempt, setDemoLoadAttempt] = useState(0);
  const [demoWakeIsSlow, setDemoWakeIsSlow] = useState(false);
  const [loadingDemoRole, setLoadingDemoRole] = useState("");
  const [demoLoginIsSlow, setDemoLoginIsSlow] = useState(false);
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
    setDemoStatus("loading");
    setDemoWakeIsSlow(false);
    setDemoError("");

    const slowTimer = window.setTimeout(() => {
      if (active) {
        setDemoWakeIsSlow(true);
      }
    }, 2500);

    getDemoStatus({ timeout: 90000 })
      .then((response) => {
        if (!active) {
          return;
        }

        if (response.data?.enabled) {
          setDemoAccounts(response.data.accounts?.length ? response.data.accounts : fallbackDemoAccounts);
          setDemoResetMinutes(response.data.resetIntervalMinutes || 60);
          setDemoStatus("ready");
        } else {
          setDemoStatus("disabled");
        }
      })
      .catch(() => {
        if (active) {
          setDemoStatus("error");
          setDemoError("Demo pristup se nije uspio povezati sa serverom.");
        }
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
      });

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
    };
  }, [demoLoadAttempt]);

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
    setLoginIsSlow(false);
    const slowTimer = window.setTimeout(() => {
      setLoginIsSlow(true);
    }, 2500);

    try {
      const response = await api.post(
        "/Auth/login",
        {
          username: usernameOrEmail.trim(),
          password,
        },
        { timeout: 90000 }
      );

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
      window.clearTimeout(slowTimer);
      setLoading(false);
      setLoginIsSlow(false);
    }
  };

  const handleDemoLogin = async (role) => {
    setGreska("");
    setDemoError("");
    setDemoLoginIsSlow(false);
    setLoadingDemoRole(role);

    const slowTimer = window.setTimeout(() => {
      setDemoLoginIsSlow(true);
    }, 2500);

    try {
      const response = await loginAsDemo(role, { timeout: 90000 });
      completeLogin(response.data);
    } catch (error) {
      const timedOut = error.code === "ECONNABORTED";
      setDemoError(
        timedOut
          ? "Pokretanje servera traje duže nego očekivano. Pokušajte ponovo."
          : error.response?.data?.message || "Demo prijava trenutno nije dostupna. Pokušajte ponovo."
      );
    } finally {
      window.clearTimeout(slowTimer);
      setLoadingDemoRole("");
      setDemoLoginIsSlow(false);
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
            {loading ? (loginIsSlow ? "Pokretanje servera..." : "Prijava...") : "Prijavi se"}
          </button>
        </form>

        {demoStatus !== "disabled" && (
          <section className="demo-login" aria-labelledby="demo-login-title">
            <div className="demo-login-divider"><span>ili isprobajte aplikaciju</span></div>
            <div className="demo-login-heading">
              <div>
                <h2 id="demo-login-title">Demo pristup</h2>
                <p>Odaberite ulogu i istražite pripremljeni radni prostor.</p>
              </div>
              <span
                className="demo-reset-note"
                title={`Demo podaci se vraćaju na početno stanje približno svakih ${demoResetMinutes} minuta.`}
              >
                Periodični reset podataka
              </span>
            </div>
            <div className="demo-role-grid">
              {(demoAccounts.length > 0 ? demoAccounts : fallbackDemoAccounts).map((account) => {
                const Icon = demoIcons[account.role] || GraduationCap;
                const isLoading = loadingDemoRole === account.role;
                return (
                  <button
                    key={account.role}
                    type="button"
                    className="demo-role-button"
                    disabled={demoStatus !== "ready" || Boolean(loadingDemoRole) || loading}
                    onClick={() => handleDemoLogin(account.role)}
                  >
                    {isLoading ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
                    <span>{isLoading ? "Otvaranje..." : account.label}</span>
                  </button>
                );
              })}
            </div>
            {demoStatus === "loading" && (
              <div className="field-message info demo-connection-status" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
                <span>
                  {demoWakeIsSlow
                    ? "Server se pokreće. Prvi pristup može potrajati do minute."
                    : "Povezivanje sa demo serverom..."}
                </span>
              </div>
            )}
            {loadingDemoRole && (
              <div className="field-message info demo-connection-status" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
                <span>
                  {demoLoginIsSlow
                    ? "Server završava pokretanje. Demo prostor će se otvoriti čim bude spreman."
                    : "Pripremamo demo radni prostor..."}
                </span>
              </div>
            )}
            {demoError && (
              <div className="field-message error demo-connection-status" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{demoError}</span>
                {demoStatus === "error" && (
                  <button
                    type="button"
                    className="demo-retry-button"
                    onClick={() => setDemoLoadAttempt((attempt) => attempt + 1)}
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Pokušaj ponovo
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default Login;
