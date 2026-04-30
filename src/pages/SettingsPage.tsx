import { useAppStore } from '../store/appStore';
import { Trash2, FlaskConical } from 'lucide-react';
import { seedHorses, buildSeedResults, buildSeedValuations } from '../utils/seedData';

export default function SettingsPage() {
  const { horses, valuations, results, addHorse, addResults, addValuation } = useAppStore();

  const handleLoadSeed = () => {
    const existingIds = new Set(horses.map((h) => h.id));
    const newHorses = seedHorses.filter((h) => !existingIds.has(h.id));
    newHorses.forEach(addHorse);
    const seedResults = buildSeedResults();
    const existingResultIds = new Set(results.map((r) => r.id));
    const newResults = seedResults.filter((r) => !existingResultIds.has(r.id));
    addResults(newResults);
    const seedVals = buildSeedValuations(seedResults);
    seedVals.forEach(addValuation);
    alert(`✅ Cargados: ${newHorses.length} caballos, ${newResults.length} resultados, ${seedVals.length} valoraciones.`);
  };

  const handleClearAll = () => {
    if (confirm('¿Borrar todos los datos locales? Esta acción no se puede deshacer.')) {
      localStorage.removeItem('equivalue-storage');
      window.location.reload();
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 700 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#111111', letterSpacing: '-0.5px' }}>Configuración</h1>
      <p style={{ margin: '0 0 28px', color: '#888888', fontSize: 14 }}>Gestión de datos locales y preferencias.</p>

      <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111111' }}>Estado de datos locales</h2>
        </div>
        {[
          { label: 'Caballos', value: horses.length },
          { label: 'Valoraciones', value: valuations.length },
          { label: 'Resultados de competencia', value: results.length },
        ].map((r) => (
          <div key={r.label} style={{ padding: '12px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: '#888888' }}>{r.label}</span>
            <span style={{ fontWeight: 700, color: '#111111' }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Seed data */}
      <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 8px', color: '#22C55E', fontSize: 14, fontWeight: 700 }}>Datos de prueba</h3>
        <p style={{ color: '#888888', fontSize: 13, margin: '0 0 14px' }}>
          Carga 10 caballos reales con resultados y valoraciones generadas para explorar la plataforma.
        </p>
        <button
          onClick={handleLoadSeed}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#F0FDF4', color: '#22C55E', border: '1px solid #BBF7D0',
            borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          <FlaskConical size={14} /> Cargar 10 caballos de prueba
        </button>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #FECACA', borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: '0 0 10px', color: '#EF4444', fontSize: 14, fontWeight: 700 }}>Zona de peligro</h3>
        <p style={{ color: '#888888', fontSize: 13, margin: '0 0 16px' }}>
          Borrar todos los datos locales: caballos, valoraciones y resultados guardados en este dispositivo.
        </p>
        <button
          onClick={handleClearAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA',
            borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          <Trash2 size={14} /> Borrar todos los datos
        </button>
      </div>

      <div style={{ marginTop: 28, fontSize: 12, color: '#888888', lineHeight: 1.7 }}>
        <strong style={{ color: '#555555' }}>EquiValue AI v1.0.0</strong><br />
        Plataforma de valoración para caballos de salto.<br />
        Datos almacenados localmente (localStorage) en este dispositivo.<br />
        Fuentes: FEI, Jumpr, FPH Brazil, entradas manuales.
      </div>
    </div>
  );
}
