import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  History,
  Inbox,
  LayoutDashboard,
  MonitorCog,
  Moon,
  Sun,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { NAVIGATION_BY_ROLE, ROLE_LABELS, getCurrentRole } from "../auth/routeAccess";
import api from "../api/client";
import { clearSession, getRefreshToken } from "../auth/session";
import NotifikacijaBell from "../pages/NotifikacijaBell";

const NAV_ICON_BY_PATH = {
  "/dashboard": LayoutDashboard,
  "/kalendar": CalendarDays,
  "/zakazivanje": CalendarPlus,
  "/rezervacije": ClipboardCheck,
  "/zahtjevi": Inbox,
  "/historija": History,
  "/oprema": MonitorCog,
  "/termini": CalendarClock,
  "/kvarovi": Wrench,
  "/korisnici": Users,
  "/objekti": Building2,
};

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const uloga = getCurrentRole();
  const korisnik = localStorage.getItem("korisnik") || "Korisnik";
  const [korisnikEmail, setKorisnikEmail] = useState(
    localStorage.getItem("korisnikEmail") || "Prijavljeni korisnik"
  );
  const navStavke = NAVIGATION_BY_ROLE[uloga] || NAVIGATION_BY_ROLE.student;
  const [menuOtvoren, setMenuOtvoren] = useState(false);
  const [mobilniMeniOtvoren, setMobilniMeniOtvoren] = useState(false);
  const accountMenuRef = useRef(null);
  const inicijal = useMemo(() => korisnik.trim().charAt(0).toUpperCase() || "K", [korisnik]);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };


  useEffect(() => {
    setMenuOtvoren(false);
    setMobilniMeniOtvoren(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") setMobilniMeniOtvoren(false);
    };

    document.body.classList.toggle("mobile-nav-open", mobilniMeniOtvoren);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("mobile-nav-open");
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobilniMeniOtvoren]);

  useEffect(() => {
    let aktivno = true;

    async function ucitajProfilZaMeni() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const response = await api.get("/Auth/profile");
        const email = response.data?.email;
        if (!aktivno || !email) return;
        localStorage.setItem("korisnikEmail", email);
        setKorisnikEmail(email);
      } catch {}
    }

    ucitajProfilZaMeni();
    return () => { aktivno = false; };
  }, []);

  useEffect(() => {
    const handleKlikVan = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setMenuOtvoren(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setMenuOtvoren(false);
    };
    document.addEventListener("mousedown", handleKlikVan);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleKlikVan);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleOdjava = async () => {
    try {
      await api.post("/Auth/logout", { refreshToken: getRefreshToken() });
    } catch {}
    finally {
      clearSession();
      navigate("/login");
    }
  };

  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollButton(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="app-layout">
      <aside className={`sidebar ${mobilniMeniOtvoren ? "is-open" : ""}`} id="primary-navigation">
        <div className="sidebar-header">
          <NavLink to="/dashboard" style={{ textDecoration: "none" }}>
            <div className="sidebar-logo">LAB<span>sistem</span></div>
          </NavLink>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Zatvori navigaciju"
            onClick={() => setMobilniMeniOtvoren(false)}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section">{ROLE_LABELS[uloga]}</span>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            <LayoutDashboard size={18} aria-hidden="true" />
            <span>Pregled</span>
          </NavLink>
          {navStavke.map((stavka) => {
            const NavIcon = NAV_ICON_BY_PATH[stavka.path] || LayoutDashboard;
            return (
              <NavLink
                key={stavka.path}
                to={stavka.path}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <NavIcon size={18} aria-hidden="true" />
                <span>{stavka.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <button
        type="button"
        className={`sidebar-backdrop ${mobilniMeniOtvoren ? "is-visible" : ""}`}
        aria-label="Zatvori navigaciju"
        tabIndex={mobilniMeniOtvoren ? 0 : -1}
        onClick={() => setMobilniMeniOtvoren(false)}
      />

      <div className="content-shell">
        <header className="topbar">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label="Otvori navigaciju"
            aria-controls="primary-navigation"
            aria-expanded={mobilniMeniOtvoren}
            onClick={() => setMobilniMeniOtvoren(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <NavLink to="/dashboard" className="mobile-brand" aria-label="LABsistem početna">
            LAB<span>sistem</span>
          </NavLink>

          <div className="topbar-spacer" />

          <div className="topbar-tools">
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title={theme === "light" ? "Aktiviraj tamni režim" : "Aktiviraj svijetli režim"}
              aria-label={theme === "light" ? "Aktiviraj tamni režim" : "Aktiviraj svijetli režim"}
              aria-pressed={theme === "dark"}
            >
              {theme === "light" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
            </button>
            <NotifikacijaBell />
          </div>


          <div className="topbar-account" ref={accountMenuRef}>
            <button
              type="button"
              className="topbar-account-trigger"
              onClick={() => setMenuOtvoren((v) => !v)}
              aria-expanded={menuOtvoren}
            >
              <span className="topbar-avatar">{inicijal}</span>
              <span className="topbar-account-meta">
                <strong>{korisnik}</strong>
                <small>{ROLE_LABELS[uloga]}</small>
              </span>
              <span className={`topbar-chevron ${menuOtvoren ? "open" : ""}`}>▾</span>
            </button>

            {menuOtvoren && (
              <div className="topbar-menu">
                <div className="topbar-menu-header">
                  <strong>{korisnik}</strong>
                  <span>{korisnikEmail}</span>
                </div>
                <button type="button" className="topbar-menu-item" onClick={() => navigate("/profil")}>
                  Moj profil
                </button>
                <button type="button" className="topbar-menu-item" onClick={() => navigate("/o-aplikaciji")}>
                  O aplikaciji
                </button>
                <div className="topbar-menu-divider" />
                <button type="button" className="topbar-menu-item logout" onClick={handleOdjava}>
                  Odjavi se
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="main-content">{children}</main>

        {/* Dugme za povratak na vrh */}
        {showScrollButton && (
          <button
            onClick={scrollToTop}
            className="scroll-to-top"
            aria-label="Vrati se na vrh stranice"
          >
            ↑
          </button>
        )}
       </div>
    </div>
  );
}

export default Layout;
