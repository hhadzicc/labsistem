import { useEffect, useRef, useState } from "react";
import api from "../api/client";

export default function NotifikacijaBell() {
  const [broj, setBroj] = useState(0);
  const [lista, setLista] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    ucitajBroj();
    const interval = setInterval(ucitajBroj, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function ucitajBroj() {
    try {
      const res = await api.get("/Obavijest/broj");
      setBroj(res.data.broj);
    } catch {}
  }

  async function toggleOpen() {
    if (!open) {
      try {
        const res = await api.get("/Obavijest");
        setLista(res.data);
      } catch {}
    }
    setOpen(prev => !prev);
  }

  async function oznaciSve() {
    try {
      await api.put("/Obavijest/sve-procitane");
      setBroj(0);
      setLista(prev => prev.map(n => ({ ...n, dostupnost: true })));
    } catch {}
  }

  async function oznaciJednu(id) {
    try {
      await api.put(`/Obavijest/${id}/procitana`);
      setLista(prev => prev.map(n => n.id === id ? { ...n, dostupnost: true } : n));
      setBroj(prev => Math.max(0, prev - 1));
    } catch {}
  }

  async function obrisiJednu(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/Obavijest/${id}`);
      const brisana = lista.find(n => n.id === id);
      setLista(prev => prev.filter(n => n.id !== id));
      if (brisana && !brisana.dostupnost) setBroj(prev => Math.max(0, prev - 1));
    } catch {}
  }

  async function obrisiSve() {
    try {
      await api.delete("/Obavijest/sve");
      setLista([]);
      setBroj(0);
    } catch {}
  }

  function formatVrijeme(iso) {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  return (
    <div ref={ref} className="notification-bell">
      <button
        onClick={toggleOpen}
        className="notification-trigger"
        aria-label="Obavijesti"
        aria-expanded={open}
        title="Obavijesti"
      >
        {/* SVG ikonica */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        {broj > 0 && (
          <span className="notification-count">
            {broj > 9 ? "9+" : broj}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          {/* Header */}
          <div className="notification-header">
            <span style={{ fontWeight: "700", fontSize: "14px" }}>Obavijesti</span>
            <div className="notification-header-actions">
              {broj > 0 && (
                <button onClick={oznaciSve} className="notification-text-button">
                  Označi sve
                </button>
              )}
              {lista.length > 0 && (
                <button onClick={obrisiSve} className="notification-text-button danger">
                  Obriši sve
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="notification-list">
            {lista.length === 0 ? (
              <div style={{
                padding: "24px 16px", textAlign: "center",
                color: "var(--text-muted)", fontSize: "13px"
              }}>
                Nema obavijesti.
              </div>
            ) : (
              lista.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.dostupnost && oznaciJednu(n.id)}
                  className={`notification-item${n.dostupnost ? "" : " unread"}`}
                >
                  <div className="notification-item-body">
                    <div className="notification-message">
                      {!n.dostupnost && (
                        <span className="notification-unread-dot" />
                      )}
                      {n.novosti}
                    </div>
                    <div className="notification-time">
                      {formatVrijeme(n.datumKreiranja)}
                    </div>
                  </div>
                  {/* Dugme za brisanje */}
                  <button
                    onClick={(e) => obrisiJednu(n.id, e)}
                    title="Obriši"
                    className="notification-delete"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
