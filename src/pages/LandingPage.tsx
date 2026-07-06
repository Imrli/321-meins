import React from 'react';

const LandingPage: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: '#F5F5F5', 
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 24 }}>
          <div style={{ fontSize: 48, fontWeight: '800', color: '#1A2A3A' }}>321</div>
          <div style={{ fontSize: 20, fontWeight: '300', color: '#1A2A3A' }}>meins</div>
        </div>

        {/* Hauptslogan */}
        <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#1E1E1E', textAlign: 'center', marginBottom: 8 }}>
          Dein Auftrag per Auktion. Live. Fair. Günstig.
        </h1>

        {/* Unterslogan */}
        <p style={{ fontSize: 16, color: '#7F8C8D', textAlign: 'center', marginBottom: 32 }}>
          Anbieter unterbieten sich in Echtzeit – du sparst garantiert.
        </p>

        {/* Karte Kunden */}
        <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
            <span style={{ fontSize: 24 }}>👤</span>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1E1E1E', margin: 0 }}>Für Kund:innen</h2>
          </div>
          <div style={{ marginBottom: 20 }}>
            {[
              'Start- und Zielort, Art des Auftrags, Notizen',
              'Auktionsdauer vor Start wählbar (Tage, Stunden, Minuten, Sekunden)',
              'Live den niedrigsten Preis sehen',
              'Keine Gebote: nach 1 Stunde Auktion wiederholen'
            ].map((bullet, i) => (
              <div key={i} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
                <span style={{ color: '#E67E22', fontWeight: 'bold' }}>✓</span>
                <span style={{ fontSize: 15, color: '#1E1E1E' }}>{bullet}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="w-full rounded-full bg-[var(--color-accent-500)] py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
          >
            Als Kunde starten
          </button>
        </div>

        {/* Karte Transporteure */}
        <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
            <span style={{ fontSize: 24 }}>🚛</span>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1E1E1E', margin: 0 }}>Für Transporteure</h2>
          </div>
          <div style={{ marginBottom: 20 }}>
            {[
              'Live-Auktion: nur niedrigere Gebote in CHF',
              'Aktueller Führungs-Preis + dein letztes Gebot',
              'Hinweis, wenn du unterboten wirst'
            ].map((bullet, i) => (
              <div key={i} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
                <span style={{ color: '#E67E22', fontWeight: 'bold' }}>✓</span>
                <span style={{ fontSize: 15, color: '#1E1E1E' }}>{bullet}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="w-full rounded-full border-2 border-[var(--color-brand-700)] bg-transparent py-3.5 text-base font-bold text-[var(--color-brand-700)] transition-colors hover:bg-[var(--color-brand-700)] hover:text-white btn-action-shine"
          >
            Als Transporteur registrieren
          </button>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 12, color: '#7F8C8D', textAlign: 'center' }}>
          Sicher. Vermittelt. Keine versteckten Kosten.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;