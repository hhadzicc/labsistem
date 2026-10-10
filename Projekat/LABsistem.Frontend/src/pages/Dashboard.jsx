import Layout from "../components/Layout";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MonitorCog,
  PackageOpen,
  Users,
  Wrench,
} from "lucide-react";
import api from "../api/client";
import { getCurrentRole } from "../auth/routeAccess";

const DASHBOARD_TEXT_BY_ROLE = {
  student: {
    naslov: "Dobro došli u LABsistem",
    opis: "Pregledajte dostupne termine i upravljajte svojim rezervacijama.",
    tabelaNaslov: "Moje rezervacije",
    tabelaKolone: ["Laboratorij", "Datum", "Vrijeme", "Status"],
  },
  profesor: {
    naslov: "Pregled sistema",
    opis: "Pratite rezervisane termine i obradite studentske zahtjeve.",
    tabelaNaslov: "Zahtjevi studenata",
    tabelaKolone: ["Student", "Laboratorij", "Datum", "Status"],
  },
  tehnicar: {
    naslov: "Upravljanje laboratorijem",
    opis: "Pregledajte termine, opremu i prijavljene kvarove.",
  },
  admin: {
    naslov: "Administratorski pregled",
    opis: "Upravljajte korisnicima, prostorima i osnovnim postavkama sistema.",
  },
};

const QUICK_ACTIONS_BY_ROLE = {
  student: [
    { label: "Pronađi termin", description: "Pregledaj slobodne laboratorije", path: "/zakazivanje", icon: CalendarDays },
    { label: "Moje rezervacije", description: "Provjeri statuse svojih zahtjeva", path: "/rezervacije", icon: ClipboardCheck },
    { label: "Kalendar", description: "Pogledaj raspored termina", path: "/kalendar", icon: Clock3 },
  ],
  profesor: [
    { label: "Zahtjevi studenata", description: "Obradi pristigle zahtjeve", path: "/zahtjevi", icon: ClipboardCheck },
    { label: "Novi termin", description: "Kreiraj termin za laboratorij", path: "/termini", icon: CalendarDays },
    { label: "Pregled opreme", description: "Provjeri dostupnost resursa", path: "/oprema", icon: MonitorCog },
  ],
  tehnicar: [
    { label: "Kvarovi opreme", description: "Obradi prijavljene probleme", path: "/kvarovi", icon: Wrench },
    { label: "Upravljanje opremom", description: "Ažuriraj inventar laboratorija", path: "/oprema", icon: MonitorCog },
    { label: "Termini", description: "Pregledaj današnje korištenje", path: "/termini", icon: CalendarDays },
  ],
  admin: [
    { label: "Dodaj korisnika", description: "Kreiraj nalog i dodijeli ulogu", path: "/korisnici", icon: Users },
    { label: "Uredi prostore", description: "Dodaj objekte i kabinete", path: "/objekti", icon: Building2 },
    { label: "Pregled kalendara", description: "Provjeri zauzetost laboratorija", path: "/kalendar", icon: CalendarDays },
  ],
};

const STAT_ICON_BY_TYPE = {
  users: Users,
  buildings: Building2,
  rooms: PackageOpen,
  equipment: MonitorCog,
  calendar: CalendarDays,
  requests: ClipboardCheck,
  faults: Wrench,
};

const BADGE_KLASA = {
  odobreno: "zeleno",
  odobren: "zeleno",
  "na cekanju": "zuto",
  nacekanju: "zuto",
  prijavljen: "crveno",
  kvar: "crveno",
  "u obradi": "amber",
  rijeseno: "zeleno",
  "riješeno": "zeleno",
  "u popravci": "amber",
  aktivan: "zeleno",
  odbijeno: "crveno",
  odbijen: "crveno",
  rezervisan: "plavo",
  slobodan: "sivo",
  otkazan: "crveno",
};

function normalizeStatusLabel(value) {
  return (value || "").toString().trim().toLowerCase();
}

function getBadgeClass(value) {
  return BADGE_KLASA[normalizeStatusLabel(value)] || "";
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("de-DE");
}

function formatTimeRange(start, end) {
  if (!start || !end) return "N/A";
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
}

function isUpcomingTermin(termin) {
  if (!termin?.datum || !termin?.vrijemeKraja) {
    return false;
  }

  const terminEnd = new Date(`${termin.datum.split("T")[0]}T${termin.vrijemeKraja}`);
  return terminEnd > new Date();
}

function isTerminToday(termin) {
  if (!termin?.datum) {
    return false;
  }

  const today = new Date();
  const date = new Date(termin.datum);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const uloga = getCurrentRole();
  const tekst = DASHBOARD_TEXT_BY_ROLE[uloga] || DASHBOARD_TEXT_BY_ROLE.student;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [statCards, setStatCards] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [evidencije, setEvidencije] = useState([]);
  const [loadingEvidencije, setLoadingEvidencije] = useState(false);
  const [opremaList, setOpremaList] = useState([]);
  const [adminOverview, setAdminOverview] = useState(null);

  const healthStats = useMemo(() => {
    if (!Array.isArray(opremaList) || opremaList.length === 0) {
      return null;
    }
    const total = opremaList.length;
    const ispravno = opremaList.filter((o) => Number(o.stanje) === 1).length;
    const uKvaru = opremaList.filter((o) => Number(o.stanje) === 2).length;
    const naServisu = opremaList.filter((o) => Number(o.stanje) === 3).length;
    const otpisano = opremaList.filter((o) => Number(o.stanje) === 4).length;

    const procenat = total > 0 ? Math.round((ispravno / total) * 100) : 0;

    let healthColor = "#10b981"; // green
    if (procenat < 50) {
      healthColor = "#ef4444"; // red
    } else if (procenat < 80) {
      healthColor = "#f59e0b"; // amber
    }

    return {
      total,
      ispravno,
      uKvaru,
      naServisu,
      otpisano,
      procenat,
      healthColor,
    };
  }, [opremaList]);


  useEffect(() => {
    loadDashboard();
  }, [uloga]);

  async function loadDashboard() {
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (uloga === "student") {
        await loadStudentDashboard();
      } else if (uloga === "profesor") {
        await loadProfesorDashboard();
      } else if (uloga === "tehnicar") {
        await loadTehnicarDashboard();
      } else if (uloga === "admin") {
        await loadAdminDashboard();
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || error?.response?.data?.Message || "Neuspjesno ucitavanje dashboard podataka.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentDashboard() {
    const [mojeResponse, dostupniResponse] = await Promise.all([
      api.get("/Rezervacija/moje"),
      api.get("/Rezervacija/dostupni-studentima"),
    ]);

    const mojeRezervacije = Array.isArray(mojeResponse.data)
      ? mojeResponse.data.filter(isUpcomingTermin)
      : [];
    const dostupniTermini = Array.isArray(dostupniResponse.data)
      ? dostupniResponse.data.filter(isUpcomingTermin)
      : [];

    const pendingRequests = dostupniTermini.filter(
      (termin) => termin.statusPrijave === "NaCekanju",
    ).length;

    setStatCards([
      { label: "Aktivne rezervacije", vrijednost: String(mojeRezervacije.length), klasa: "blue", icon: "calendar", detail: "Predstojeći termini" },
      { label: "Dostupni termini", vrijednost: String(dostupniTermini.filter((termin) => !termin.statusPrijave || termin.statusPrijave === "Otkazan").length), klasa: "green", icon: "rooms", detail: "Otvoreno za prijavu" },
      { label: "Zahtjevi na čekanju", vrijednost: String(pendingRequests), klasa: "amber", icon: "requests", detail: "Čekaju odobrenje" },
    ]);

    setTableData({
      naslov: tekst.tabelaNaslov,
      kolone: tekst.tabelaKolone,
      redovi: mojeRezervacije.slice(0, 5).map((termin) => ([
        termin.kabinetNaziv,
        formatDate(termin.datum),
        formatTimeRange(termin.vrijemePocetka, termin.vrijemeKraja),
        termin.statusTermina,
      ])),
      emptyMessage: "Nemate aktivnih rezervacija.",
    });
  }

  async function loadProfesorDashboard() {
    const [mojeResponse, zahtjeviResponse, opremaResponse] = await Promise.all([
      api.get("/Rezervacija/moje"),
      api.get("/Rezervacija/dolazni-zahtjevi"),
      api.get("/Oprema"),
    ]);

    const mojeRezervacije = Array.isArray(mojeResponse.data)
      ? mojeResponse.data.filter(isUpcomingTermin)
      : [];
    const dolazniZahtjevi = Array.isArray(zahtjeviResponse.data)
      ? zahtjeviResponse.data
      : [];
    const oprema = Array.isArray(opremaResponse.data) ? opremaResponse.data : [];
    setOpremaList(oprema);

    const javniTermini = mojeRezervacije.filter((termin) => termin.vidljivoStudentima).length;

    setStatCards([
      { label: "Zahtjevi na čekanju", vrijednost: String(dolazniZahtjevi.length), klasa: "amber", icon: "requests", detail: "Potrebna obrada" },
      { label: "Aktivne rezervacije", vrijednost: String(mojeRezervacije.length), klasa: "blue", icon: "calendar", detail: "Predstojeći termini" },
      { label: "Javni termini", vrijednost: String(javniTermini), klasa: "green", icon: "rooms", detail: "Vidljivo studentima" },
      { label: "Ukupna oprema", vrijednost: String(oprema.length), klasa: "violet", icon: "equipment", detail: "Evidentirani resursi" },
    ]);

    setTableData({
      naslov: tekst.tabelaNaslov,
      kolone: tekst.tabelaKolone,
      redovi: dolazniZahtjevi.slice(0, 5).map((zahtjev) => ([
        zahtjev.studentIme,
        zahtjev.kabinetNaziv,
        `${formatDate(zahtjev.datum)} ${zahtjev.vrijemePocetka.slice(0, 5)}`,
        zahtjev.statusZahtjeva,
      ])),

      emptyMessage: "Trenutno nema novih zahtjeva na cekanju.",
    });
  }

  async function loadTehnicarDashboard() {
    setLoadingEvidencije(true);
    try {
      const [terminiResponse, opremaResponse, evidencijeResponse] = await Promise.all([
        api.get("/Termin"),
        api.get("/Oprema"),
        api.get("/Evidencija"),
      ]);

      const termini = Array.isArray(terminiResponse.data) ? terminiResponse.data : [];
      const oprema = Array.isArray(opremaResponse.data) ? opremaResponse.data : [];
      const sveEvidencije = Array.isArray(evidencijeResponse.data) ? evidencijeResponse.data : [];

      setEvidencije(sveEvidencije);
      setOpremaList(oprema);

      const aktivniKvarovi = sveEvidencije.filter((evidencija) => evidencija.status === "Kvar").length;

      setStatCards([
        { label: "Termini danas", vrijednost: String(termini.filter(isTerminToday).length), klasa: "blue", icon: "calendar", detail: "Današnje korištenje" },
        { label: "Ukupna oprema", vrijednost: String(oprema.length), klasa: "violet", icon: "equipment", detail: "Evidentirani resursi" },
        { label: "Prijavljeni kvarovi", vrijednost: String(aktivniKvarovi), klasa: "red", icon: "faults", detail: "Zahtijevaju pažnju" },
      ]);
      setTableData(null);
    } finally {
      setLoadingEvidencije(false);
    }
  }

  async function loadAdminDashboard() {
    const [usersResponse, objektiResponse, kabinetiResponse, opremaResponse] = await Promise.all([
      api.get("/Auth/users"),
      api.get("/Objekat"),
      api.get("/Kabinet"),
      api.get("/Oprema"),
    ]);
    const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];
    const objekti = Array.isArray(objektiResponse.data) ? objektiResponse.data : [];
    const kabineti = Array.isArray(kabinetiResponse.data) ? kabinetiResponse.data : [];
    const oprema = Array.isArray(opremaResponse.data) ? opremaResponse.data : [];
    setOpremaList(oprema);

    const aktivniObjekti = objekti.filter((objekat) => Array.isArray(objekat.kabineti) && objekat.kabineti.length > 0).length;

    setAdminOverview({
      users: users.length,
      objekti: objekti.length,
      aktivniObjekti,
      kabineti: kabineti.length,
      oprema: oprema.length,
    });

    setStatCards([
      { label: "Ukupno korisnika", vrijednost: String(users.length), klasa: "blue", icon: "users", detail: "Aktivni nalozi" },
      { label: "Objekti", vrijednost: String(objekti.length), klasa: "green", icon: "buildings", detail: `${aktivniObjekti} s kabinetima` },
      { label: "Kabineti", vrijednost: String(kabineti.length), klasa: "amber", icon: "rooms", detail: "Laboratorijski prostori" },
      { label: "Oprema", vrijednost: String(oprema.length), klasa: "violet", icon: "equipment", detail: "Evidentirani resursi" },
    ]);
    setTableData(null);
  }

  async function handleEvidencijaStatus(id, noviStatus) {
    try {
      await api.put(`/Evidencija/${id}`, { status: noviStatus });
      await loadDashboard();
    } catch (error) {
      console.error("Greska pri azuriranju statusa:", error);
    }
  }

  async function handleEvidencijaDelete(id) {
    if (!window.confirm("Da li ste sigurni da zelite obrisati ovaj kvar?")) return;

    try {
      await api.delete(`/Evidencija/${id}`);
      await loadDashboard();
    } catch (error) {
      console.error("Greska pri brisanju:", error);
    }
  }

  return (
    <Layout>
      <div className="dashboard-page">
        <div className="dashboard-heading">
          <div>
            <span className="dashboard-eyebrow">Radni pregled</span>
            <h1>{tekst.naslov}</h1>
            <p>{tekst.opis}</p>
          </div>
          <div className="dashboard-date">
            <CalendarDays size={18} aria-hidden="true" />
            <span>{new Date().toLocaleDateString("bs-BA", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
        </div>

        {message.text && (
          <p className={message.type === "error" ? "form-error" : "form-success"}>
            {message.text}
          </p>
        )}

        <div className="dashboard-stats">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
              <div className="stat-card dashboard-skeleton" key={index} aria-hidden="true" />
            ))
            : statCards.map((stat) => {
              const StatIcon = STAT_ICON_BY_TYPE[stat.icon] || Activity;
              return (
                <div key={stat.label} className={`stat-card ${stat.klasa}`}>
                  <div className="stat-card-topline">
                    <span className="stat-icon"><StatIcon size={20} aria-hidden="true" /></span>
                    <span className="stat-detail">{stat.detail}</span>
                  </div>
                  <div className="stat-value">{stat.vrijednost}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              );
            })}
        </div>

        <div className="dashboard-content-grid">
          <div className="dashboard-primary-column">
            {uloga === "admin" && adminOverview && (
              <section className="dashboard-panel setup-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-panel-kicker">Osnovne postavke</span>
                    <h2>Spremnost sistema</h2>
                    <p>Pratite šta je potrebno za svakodnevno korištenje laboratorija.</p>
                  </div>
                  <span className={`setup-score ${adminOverview.objekti > 0 && adminOverview.kabineti > 0 ? "complete" : ""}`}>
                    {[
                      adminOverview.users > 1,
                      adminOverview.objekti > 0,
                      adminOverview.kabineti > 0,
                    ].filter(Boolean).length}/3
                  </span>
                </div>

                <div className="setup-list">
                  <button type="button" className="setup-row" onClick={() => navigate("/korisnici")}>
                    <span className={`setup-status ${adminOverview.users > 1 ? "done" : ""}`}>
                      {adminOverview.users > 1 ? <CheckCircle2 size={19} /> : <Users size={19} />}
                    </span>
                    <span className="setup-copy">
                      <strong>Korisnički nalozi</strong>
                      <small>{adminOverview.users > 1 ? `${adminOverview.users} korisnika spremno za rad` : "Dodajte profesore, studente i tehničare"}</small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="setup-row" onClick={() => navigate("/objekti")}>
                    <span className={`setup-status ${adminOverview.objekti > 0 ? "done" : ""}`}>
                      {adminOverview.objekti > 0 ? <CheckCircle2 size={19} /> : <Building2 size={19} />}
                    </span>
                    <span className="setup-copy">
                      <strong>Objekti fakulteta</strong>
                      <small>{adminOverview.objekti > 0 ? `${adminOverview.objekti} objekata evidentirano` : "Unesite zgrade i njihovo radno vrijeme"}</small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="setup-row" onClick={() => navigate("/objekti")}>
                    <span className={`setup-status ${adminOverview.kabineti > 0 ? "done" : ""}`}>
                      {adminOverview.kabineti > 0 ? <CheckCircle2 size={19} /> : <PackageOpen size={19} />}
                    </span>
                    <span className="setup-copy">
                      <strong>Laboratorijski kabineti</strong>
                      <small>{adminOverview.kabineti > 0 ? `${adminOverview.kabineti} kabineta dostupno` : "Dodajte prvi kabinet unutar objekta"}</small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

        {uloga === "tehnicar" && (
          <div className="table-wrapper dashboard-table">
            <div className="table-header">
              <h2>Prijavljeni kvarovi</h2>
              <button type="button" className="table-link" onClick={() => navigate("/kvarovi")}>Svi kvarovi <ArrowRight size={16} /></button>
            </div>
            {loading || loadingEvidencije ? (
              <p className="dashboard-loading-copy">Učitavanje...</p>
            ) : evidencije.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Oprema</th>
                    <th>Prijavio</th>
                    <th>Komentar</th>
                    <th>Status</th>
                    <th>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {evidencije.map((evidencija) => (
                    <tr key={evidencija.id}>
                      <td data-label="Oprema">{evidencija.opremaNaziv}</td>
                      <td data-label="Prijavio">{evidencija.korisnikImePrezime}</td>
                      <td data-label="Komentar">{evidencija.komentar}</td>
                      <td data-label="Status">
                        <span className={`badge ${getBadgeClass(evidencija.status)}`}>
                          {evidencija.status}
                        </span>
                      </td>
                      <td data-label="Akcije">
                        <div style={{ display: "flex", gap: "6px" }}>
                          {evidencija.status !== "Riješeno" && (
                            <button
                              className="users-action-btn"
                              onClick={() => handleEvidencijaStatus(evidencija.id, "Riješeno")}
                            >
                              Rijesi
                            </button>
                          )}
                          {evidencija.status !== "U obradi" && evidencija.status !== "Riješeno" && (
                            <button
                              className="users-action-btn"
                              onClick={() => handleEvidencijaStatus(evidencija.id, "U obradi")}
                            >
                              Obrada
                            </button>
                          )}
                          <button
                            className="users-action-btn warn"
                            onClick={() => handleEvidencijaDelete(evidencija.id)}
                          >
                            Obrisi
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="dashboard-empty-copy">
                Nema prijavljenih kvarova.
              </p>
            )}
          </div>
        )}

        {uloga !== "tehnicar" && tableData && (
          <div className="table-wrapper dashboard-table">
            <div className="table-header">
              <h2>{tableData.naslov}</h2>
              <button
                type="button"
                className="table-link"
                onClick={() => navigate(uloga === "student" ? "/rezervacije" : "/zahtjevi")}
              >
                Prikaži sve <ArrowRight size={16} />
              </button>
            </div>
            {loading ? (
              <p className="dashboard-loading-copy">Učitavanje...</p>
            ) : tableData.redovi.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    {tableData.kolone.map((kolona, index) => (
                      <th key={index}>{kolona}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.redovi.map((red, rowIndex) => (
                    <tr key={rowIndex}>
                      {red.map((celija, cellIndex) => (
                        <td key={cellIndex} data-label={tableData.kolone[cellIndex]}>
                          {getBadgeClass(celija)
                            ? <span className={`badge ${getBadgeClass(celija)}`}>{celija}</span>
                            : celija}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="dashboard-empty-copy">
                {tableData.emptyMessage}
              </p>
            )}
          </div>
        )}

          </div>

          <aside className="dashboard-secondary-column">
            <section className="dashboard-panel quick-actions-panel">
              <div className="dashboard-panel-header compact">
                <div>
                  <span className="dashboard-panel-kicker">Prečice</span>
                  <h2>Brze akcije</h2>
                </div>
              </div>
              <div className="quick-actions-list">
                {(QUICK_ACTIONS_BY_ROLE[uloga] || []).map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <button key={action.path} type="button" className="quick-action-row" onClick={() => navigate(action.path)}>
                      <span className="quick-action-icon"><ActionIcon size={19} aria-hidden="true" /></span>
                      <span>
                        <strong>{action.label}</strong>
                        <small>{action.description}</small>
                      </span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>

            {healthStats && (
              <section className="dashboard-panel health-widget-card">
                <div className="dashboard-panel-header compact">
                  <div>
                    <span className="dashboard-panel-kicker">Inventar</span>
                    <h2>Zdravlje laboratorije</h2>
                  </div>
                  <Activity size={20} aria-hidden="true" />
                </div>

                <div className="health-summary">
                  <div className="health-ring" style={{ "--health-progress": `${healthStats.procenat * 3.6}deg`, "--health-color": healthStats.healthColor }}>
                    <div><strong>{healthStats.procenat}%</strong><span>ispravno</span></div>
                  </div>
                  <div className="health-legend">
                    <div><span className="health-dot green" />Ispravna <strong>{healthStats.ispravno}</strong></div>
                    <div><span className="health-dot red" />U kvaru <strong>{healthStats.uKvaru}</strong></div>
                    <div><span className="health-dot amber" />Na servisu <strong>{healthStats.naServisu}</strong></div>
                    {healthStats.otpisano > 0 && <div><span className="health-dot gray" />Otpisana <strong>{healthStats.otpisano}</strong></div>}
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
