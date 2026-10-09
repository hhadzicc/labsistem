import { useEffect, useMemo, useState, useRef } from "react";
import Layout from "../components/Layout";
import api from "../api/client";

const getLocalRole = () => localStorage.getItem("uloga") || "student";

const INIT_OBJEKAT = { lokacija: "", radnoVrijeme: "" };
const INIT_KABINET = { naziv: "", korisnikID: "", objekatID: null, kapacitet: "" };

function extractError(error, fallback) {
  const d = error?.response?.data;
  if (typeof d === "string" && d.trim()) return d;
  if (typeof d?.message === "string" && d.message.trim()) return d.message;
  return fallback;
}

function ProfAutocomplete({ korisnici, value, onChange, initialDisplayName = "", invalid = false, describedBy }) {
  const [inputVal, setInputVal] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!value) {
      setInputVal(initialDisplayName || "");
      return;
    }
    const found = korisnici.find(k => k.userId === Number(value));
    if (found) setInputVal(found.imePrezime);
    else setInputVal(initialDisplayName || "");
  }, [value, korisnici, initialDisplayName]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() =>
    !inputVal.trim()
      ? korisnici
      : korisnici.filter(k => k.imePrezime.toLowerCase().includes(inputVal.toLowerCase().trim()))
  , [inputVal, korisnici]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        value={inputVal}
        onChange={e => { setInputVal(e.target.value); onChange(""); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Ime i prezime profesora..."
        autoComplete="off"
        className={invalid ? "input-error" : ""}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "var(--card-bg, #fff)", border: "1px solid var(--border)",
          borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          maxHeight: "200px", overflowY: "auto"
        }}>
          {filtered.map(k => (
            <div
              key={k.userId}
              onMouseDown={() => { setInputVal(k.imePrezime); onChange(k.userId); setOpen(false); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: "14px", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover-bg, #f0f0f0)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {k.imePrezime}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && inputVal && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "var(--card-bg, #fff)", border: "1px solid var(--border)",
          borderRadius: "8px", padding: "8px 12px", fontSize: "13px", color: "var(--text-muted)"
        }}>
          Nema pronađenih profesora.
        </div>
      )}
    </div>
  );
}

export default function Objekti() {
  const [objekti, setObjekti] = useState([]);
  const [korisnici, setKorisnici] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [message, setMessage] = useState({ type: "", text: "" });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState({ type: "", text: "" });
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  
  // Story 1: state za detalje kabineta
  const [selectedKabinet, setSelectedKabinet] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const isAdmin = getLocalRole() === "admin";

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [objRes, korRes] = await Promise.all([
        api.get("/Objekat"),
        api.get("/Auth/users"),
      ]);
      setObjekti(objRes.data);
      setKorisnici(korRes.data.filter(k => k.role === "Profesor"));
    } catch (e) {
      setMessage({ type: "error", text: "Greška pri učitavanju podataka." });
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Story 1: otvaranje modala sa detaljima kabineta
  function openKabinetDetails(kabinet) {
    setSelectedKabinet(kabinet);
    setShowDetailsModal(true);
  }

  const filtered = useMemo(() => {
    const t = search.toLowerCase().trim();
    if (!t) return objekti;
    return objekti.filter(o =>
      o.lokacija.toLowerCase().includes(t) ||
      o.radnoVrijeme.toLowerCase().includes(t) ||
      o.kabineti?.some(k => k.naziv.toLowerCase().includes(t))
    );
  }, [objekti, search]);

  function openModal(type, data = {}) {
    setModal({ type, data });
    if (type === "objekat-create") setForm(INIT_OBJEKAT);
    else if (type === "objekat-edit") setForm({ lokacija: data.lokacija, radnoVrijeme: data.radnoVrijeme });
    else if (type === "kabinet-create") setForm({ ...INIT_KABINET, objekatID: data.objekatID });
    else if (type === "kabinet-edit") setForm({ naziv: data.naziv, korisnikID: data.korisnikID, objekatID: data.objekatID, kapacitet: data.kapacitet });
    setFormMsg({ type: "", text: "" });
    setFormErrors({});
    setTouched({});
    setSubmitted(false);
  }

  function closeModal() { setModal(null); setForm({}); setFormErrors({}); setTouched({}); setSubmitted(false); }

  function validateForm(values = form) {
    const errors = {};
    if (modal?.type?.startsWith("objekat")) {
      if (!values.lokacija?.trim()) errors.lokacija = "Unesite lokaciju objekta.";
      if (!values.radnoVrijeme?.trim()) {
        errors.radnoVrijeme = "Unesite radno vrijeme.";
      } else if (!/^([01]\d|2[0-3]):[0-5]\d\s*-\s*([01]\d|2[0-3]):[0-5]\d$/.test(values.radnoVrijeme.trim())) {
        errors.radnoVrijeme = "Koristite format 08:00 - 20:00.";
      }
    } else {
      if (!values.naziv?.trim()) errors.naziv = "Unesite naziv kabineta.";
      if (!values.korisnikID) errors.korisnikID = "Odaberite odgovornog profesora.";
      if (!Number.isInteger(Number(values.kapacitet)) || Number(values.kapacitet) < 1) {
        errors.kapacitet = "Kapacitet mora biti cijeli broj veći od nule.";
      }
    }
    return errors;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    const numericFields = ["korisnikID", "kapacitet"];
    const nextValue = numericFields.includes(name) ? (value === "" ? "" : Number(value)) : value;
    const nextForm = { ...form, [name]: nextValue };
    setForm(nextForm);
    setFormErrors(validateForm(nextForm));
    setFormMsg({ type: "", text: "" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setFormMsg({ type: "", text: "" });
    try {
      const { type, data } = modal;
      if (type === "objekat-create") {
        await api.post("/Objekat", form);
        setFormMsg({ type: "success", text: "Objekat dodan!" });
      } else if (type === "objekat-edit") {
        await api.put(`/Objekat/${data.id}`, form);
        setFormMsg({ type: "success", text: "Objekat ažuriran!" });
      } else if (type === "kabinet-create") {
        await api.post("/Kabinet", form);
        setFormMsg({ type: "success", text: "Kabinet dodan!" });
      } else if (type === "kabinet-edit") {
        await api.put(`/Kabinet/${data.id}`, form);
        setFormMsg({ type: "success", text: "Izmjene sačuvane!" });
      }
      await load();
      setTimeout(closeModal, 700);
    } catch (e) {
      setFormMsg({ type: "error", text: extractError(e, "Greška pri čuvanju.") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteObjekat(id) {
    if (!window.confirm("Obrisati objekat i sve kabinete u njemu?")) return;
    try {
      await api.delete(`/Objekat/${id}`);
      await load();
      setMessage({ type: "success", text: "Objekat obrisan." });
    } catch (e) {
      setMessage({ type: "error", text: extractError(e, "Greška pri brisanju.") });
    }
  }

  async function deleteKabinet(id) {
    if (!window.confirm("Obrisati ovaj kabinet?")) return;
    try {
      await api.delete(`/Kabinet/${id}`);
      await load();
      setMessage({ type: "success", text: "Kabinet obrisan." });
    } catch (e) {
      setMessage({ type: "error", text: extractError(e, "Greška pri brisanju.") });
    }
  }

  const modalTitle = {
    "objekat-create": "Novi objekat",
    "objekat-edit": "Uredi objekat",
    "kabinet-create": "Novi kabinet",
    "kabinet-edit": "Uredi kabinet",
  }[modal?.type] || "";

  const isKabinetModal = modal?.type?.startsWith("kabinet");

  return (
    <Layout>
      <div className="page-header">
        <h1>Objekti i kabineti</h1>
      </div>

      <div className="users-page">
        <div className="card users-toolbar" style={{ flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          {isAdmin && (
            <button className="button users-create-button" onClick={() => openModal("objekat-create")}>
              <span className="users-create-icon">+</span> Dodaj objekat
            </button>
          )}
          <div className="objects-search">
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              placeholder="Pretraži objekte i kabinete..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--input-bg)", color: "var(--text)", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {message.text && (
          <p className={message.type === "error" ? "form-error" : "form-success"} style={{ margin: "0 0 12px" }}>
            {message.text}
          </p>
        )}

        <div className="card users-list-card">
          {loading ? (
            <div className="users-empty-state">Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div className="users-empty-state">Nema pronađenih objekata.</div>
          ) : (
            filtered.map(objekat => (
              <div key={objekat.id} className="object-list-item">
                <div className="object-list-summary">
                  <button
                    onClick={() => toggleExpand(objekat.id)}
                    className="object-expand-button"
                    aria-label={expanded[objekat.id] ? "Sakrij kabinete" : "Prikaži kabinete"}
                  >
                    {expanded[objekat.id] ? "▾" : "▸"}
                  </button>
                  <div className="object-meta">
                    <strong>{objekat.lokacija}</strong>
                    <span>🕐 {objekat.radnoVrijeme}</span>
                    <span>📦 {objekat.kabineti?.length || 0} kabineta</span>
                  </div>
                  {isAdmin && (
                    <div className="users-actions object-actions">
                      <button className="users-action-btn" onClick={() => openModal("objekat-edit", objekat)}>✎ Uredi</button>
                      <button className="users-action-btn" onClick={() => openModal("kabinet-create", { objekatID: objekat.id })}>+ Kabinet</button>
                      <button className="users-action-btn warn" onClick={() => deleteObjekat(objekat.id)}>🗑 Briši</button>
                    </div>
                  )}
                </div>

                {expanded[objekat.id] && (
                  <div className="cabinet-list">
                    {!objekat.kabineti?.length ? (
                      <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "6px 0" }}>Nema kabineta u ovom objektu.</div>
                    ) : (
                      <>
                        <div className="users-list-header users-list-row cabinet-list-row" style={{ fontSize: "12px" }}>
                          <span>Naziv</span>
                          <span>Odgovorni profesor</span>
                          <span>Kapacitet</span>
                          {isAdmin && <span>Akcije</span>}
                        </div>
                        {objekat.kabineti.map(k => (
                          <div 
                            className="users-list-row users-list-item cabinet-list-row"
                            key={k.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => openKabinetDetails(k)}
                          >
                            <span data-label="Naziv" style={{ fontWeight: "600" }}>{k.naziv}</span>
                            <span data-label="Odgovorni profesor">{k.odgovorniKorisnik}</span>
                            <span data-label="Kapacitet">{k.kapacitet}</span>
                            {isAdmin && (
                              <span data-label="Akcije" onClick={e => e.stopPropagation()}>
                                <div className="users-actions">
                                  <button className="users-action-btn" onClick={() => openModal("kabinet-edit", k)}>✎ Uredi</button>
                                  <button className="users-action-btn warn" onClick={() => deleteKabinet(k.id)}>🗑 Briši</button>
                                </div>
                              </span>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Story 1: Modal za detalje kabineta */}
      {showDetailsModal && selectedKabinet && (
        <div className="users-modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="users-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="users-modal-header">
              <h2>Detalji kabineta: {selectedKabinet.naziv}</h2>
              <button className="users-modal-close" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            <div style={{ padding: "16px 0" }}>
              <div style={{ marginBottom: "12px" }}>
                <strong>Naziv:</strong> {selectedKabinet.naziv}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Odgovorni profesor:</strong> {selectedKabinet.odgovorniKorisnik}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Kapacitet:</strong> {selectedKabinet.kapacitet} studenata
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Lokacija (Objekat):</strong> {objekti.find(o => o.id === selectedKabinet.objekatID)?.lokacija || "N/A"}
              </div>
              <div>
                <strong>ID u sistemu:</strong> {selectedKabinet.id}
              </div>
            </div>
            <div className="users-modal-actions">
              <button className="button sekundarno" onClick={() => setShowDetailsModal(false)}>Zatvori</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal za create/edit objekta i kabineta */}
      {modal && (
        <div className="users-modal-overlay" onClick={closeModal}>
          <div className="users-modal" onClick={e => e.stopPropagation()}>
            <div className="users-modal-header">
              <h2>{modalTitle}</h2>
              <button className="users-modal-close" onClick={closeModal}>×</button>
            </div>
            {formMsg.text && (
              <p className={formMsg.type === "error" ? "form-error" : "form-success"}>{formMsg.text}</p>
            )}
            <form onSubmit={handleSubmit} noValidate>
              {!isKabinetModal ? (
                <>
                  <div className="form-group">
                    <label htmlFor="objekat-lokacija">Lokacija</label>
                    <input id="objekat-lokacija" name="lokacija" value={form.lokacija || ""} onChange={handleChange} onBlur={() => setTouched(prev => ({ ...prev, lokacija: true }))} className={(submitted || touched.lokacija) && formErrors.lokacija ? "input-error" : ""} aria-invalid={Boolean((submitted || touched.lokacija) && formErrors.lokacija)} aria-describedby="objekat-lokacija-error" maxLength={20} />
                    {(submitted || touched.lokacija) && formErrors.lokacija && <p className="field-error" id="objekat-lokacija-error">{formErrors.lokacija}</p>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="objekat-radno-vrijeme">Radno vrijeme</label>
                    <input id="objekat-radno-vrijeme" name="radnoVrijeme" value={form.radnoVrijeme || ""} onChange={handleChange} onBlur={() => setTouched(prev => ({ ...prev, radnoVrijeme: true }))} className={(submitted || touched.radnoVrijeme) && formErrors.radnoVrijeme ? "input-error" : ""} aria-invalid={Boolean((submitted || touched.radnoVrijeme) && formErrors.radnoVrijeme)} aria-describedby="objekat-radno-vrijeme-error" maxLength={20} placeholder="npr. 08:00 - 20:00" />
                    {(submitted || touched.radnoVrijeme) && formErrors.radnoVrijeme && <p className="field-error" id="objekat-radno-vrijeme-error">{formErrors.radnoVrijeme}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="kabinet-naziv">Naziv kabineta</label>
                    <input id="kabinet-naziv" name="naziv" value={form.naziv || ""} onChange={handleChange} onBlur={() => setTouched(prev => ({ ...prev, naziv: true }))} className={(submitted || touched.naziv) && formErrors.naziv ? "input-error" : ""} aria-invalid={Boolean((submitted || touched.naziv) && formErrors.naziv)} aria-describedby="kabinet-naziv-error" />
                    {(submitted || touched.naziv) && formErrors.naziv && <p className="field-error" id="kabinet-naziv-error">{formErrors.naziv}</p>}
                  </div>
                  <div className="form-group">
                    <label>Odgovorni profesor</label>
                    <ProfAutocomplete
                      korisnici={korisnici}
                      value={form.korisnikID}
                      onChange={val => {
                        const nextForm = { ...form, korisnikID: val };
                        setForm(nextForm);
                        setTouched(prev => ({ ...prev, korisnikID: true }));
                        setFormErrors(validateForm(nextForm));
                      }}
                      initialDisplayName={modal?.data?.odgovorniKorisnik || ""}
                      invalid={Boolean((submitted || touched.korisnikID) && formErrors.korisnikID)}
                      describedBy="kabinet-profesor-error"
                    />
                    {(submitted || touched.korisnikID) && formErrors.korisnikID && <p className="field-error" id="kabinet-profesor-error">{formErrors.korisnikID}</p>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="kabinet-kapacitet">Kapacitet</label>
                    <input id="kabinet-kapacitet" type="number" name="kapacitet" value={form.kapacitet || ""} onChange={handleChange} onBlur={() => setTouched(prev => ({ ...prev, kapacitet: true }))} className={(submitted || touched.kapacitet) && formErrors.kapacitet ? "input-error" : ""} aria-invalid={Boolean((submitted || touched.kapacitet) && formErrors.kapacitet)} aria-describedby="kabinet-kapacitet-error" min="1" step="1" />
                    {(submitted || touched.kapacitet) && formErrors.kapacitet && <p className="field-error" id="kabinet-kapacitet-error">{formErrors.kapacitet}</p>}
                  </div>
                </>
              )}
              <div className="users-modal-actions">
                <button className="button" type="submit" disabled={saving}>
                  {saving ? "Slanje..." : "Sačuvaj"}
                </button>
                <button className="button sekundarno" type="button" onClick={closeModal}>Odustani</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
