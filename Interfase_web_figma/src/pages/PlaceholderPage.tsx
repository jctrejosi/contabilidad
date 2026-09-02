interface Props {
  title: string;
  description: string;
  icon?: string;
  features?: string[];
}

export default function PlaceholderPage({ title, description, icon = '📋', features = [] }: Props) {
  return (
    <div className="p-4 max-w-screen-2xl">
      <div className="mb-4">
        <h1 className="text-base font-semibold text-gray-800">{title}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content area */}
        <div className="lg:col-span-2 bg-white rounded border border-gray-200">
          {/* Toolbar skeleton */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <div className="w-40 h-6 bg-gray-100 rounded animate-pulse" />
            <div className="w-28 h-6 bg-gray-100 rounded animate-pulse" />
            <div className="flex-1" />
            <div className="w-20 h-6 bg-gray-100 rounded animate-pulse" />
            <div className="w-24 h-6 bg-gray-200 rounded animate-pulse" style={{ backgroundColor: '#EFFAFF' }} />
          </div>
          {/* Table skeleton */}
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-20 h-4 bg-gray-100 rounded animate-pulse" />
                <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
                <div className="w-24 h-4 bg-gray-100 rounded animate-pulse" />
                <div className="w-20 h-4 bg-gray-100 rounded animate-pulse" />
                <div className="w-16 h-5 bg-gray-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="text-xs text-center text-gray-400 py-4 space-y-2">
              <div className="text-2xl">{icon}</div>
              <div className="font-medium text-gray-600">{title}</div>
              <div className="text-gray-400 max-w-sm mx-auto">{description}</div>
              <div className="text-xs text-gray-300">Implementación completa disponible en la versión de producción</div>
            </div>
          </div>
        </div>

        {/* Features panel */}
        {features.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">Funcionalidades incluidas</h3>
              <div className="space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">Acciones disponibles</h3>
              <div className="space-y-2">
                {['Crear', 'Editar', 'Buscar / Filtrar', 'Importar', 'Exportar XLSX', 'Imprimir', 'Ver detalle'].map(a => (
                  <button key={a} disabled className="w-full flex items-center justify-between px-3 py-1.5 text-xs border border-gray-100 rounded text-gray-400 cursor-not-allowed">
                    <span>{a}</span>
                    <span className="text-gray-200">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
